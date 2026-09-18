# PR view quality plan

Plan for the six structural findings on `feat/pr-view` vs `main`. Behavior stays the same unless a finding itself is an invariant bug (Forgejo Files pane stranded despite a loaded patch). No new tests unless explicitly requested. Verify with `pnpm typecheck`, `pnpm lint`, `pnpm duplication`, and `bun test`.

Do **not** split files first. The 1k-line files are a symptom. The code-judo moves below delete whole categories of branching; the leftover modules then split along real screens and adapters.

```
2 typed forge methods
        │
        ├─► 5 query table + Forgejo view cache
        │
        └─► 3 patch-derived file list ──► 4 MainView model
                                              │
                                              ▼
                                    1 leftover decomposition
```

Issue 6 lands in the same diffs as the files they touch. Do not open a dedicated “helpers” pass that only shuffles wrappers.

---

## Locked decisions

These are the review’s judo moves, not open design questions:

- **Typed adapter methods**, not a generic `getPullRequestResource<K>`. The adapter interface may get longer. Callers and the view get smaller. That is the trade.
- **The current patch is the file list.** GitHub’s files JSON is not a second tree. If nothing else reads `PullRequestFile` after the tree switch, delete the fetch.
- **One `MainView` value**, not two independent optionals reconstructed with nested `Show`.
- **Queries are a table of typed cached fetches**, not eight named loaders plus a tagged-union dispatcher.
- **Split files after those moves**, so we extract the resulting modules rather than relocating the current mess.

---

## Issue 2 — Delete `PullRequestResource`

**Why first.** Every other finding re-narrows this union. Until the forge seam returns the type the caller asked for, the query layer and overview screen cannot get simpler.

### Current shape

`ForgeAdapter.getPullRequestResource(number, kind)` returns `PullRequestResource`, a tagged union of details / diff / commits / reviews / checks / development.

Callers already know `kind`:

- `use-pr-view-content.ts` fetchers call with `"details"` / `"diff"` / `"commits"` / `"reviews"` / … then check `result.value.kind` and invent an `incompatible` error on mismatch.
- `OverviewScreen` checks `resource.kind` again and renders `<></>` on mismatch.

`ForgeService` also keeps a runtime `resourceKinds` list and an `invalidRequest` for unknown kinds that TypeScript already excludes.

That empty-fragment fallback is a silent paper-over of an invariant the types should have enforced.

### Target seam

Replace the one dispatcher with typed methods on `ForgeAdapter` and `ForgeService`:

```ts
getPullRequestDetails(number, options?)
getPullRequestDiff(number, options?)      // after issue 3 this is the patch
getPullRequestCommits(number, options?)
getPullRequestReviews(number, options?)
getPullRequestChecks(number, options?)
getPullRequestDevelopment(number, options?)
```

Keep `getPullRequestOverview` and `getCommitPatch` as they are.

Return the inner value, not `{ kind, value }`:

| Method      | Returns                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| details     | `PullRequestDetails`                                                                                              |
| diff        | `ForgeSection<PullRequestPatch>` after issue 3; until then `PullRequestDiffResource` is acceptable as a temporary |
| commits     | `ForgeSection<readonly PullRequestCommit[]>`                                                                      |
| reviews     | `PullRequestReviewsResource` (the three sections, untagged)                                                       |
| checks      | `ForgeSection<readonly PullRequestCheck[]>`                                                                       |
| development | `{ projects, linkedIssues }` untagged                                                                             |

Delete:

- `PullRequestResource`
- `PullRequestResourceKind`
- `PullRequestResourceMap`
- `resourceKinds`
- unknown-kind `invalidRequest` branches in `ForgeService`, `GithubService.readGithubResource`, `ForgejoService.readForgejoResource`
- fetcher re-narrowing in `use-pr-view-content.ts`
- `OverviewScreen` empty-fragment kind checks

Number validation stays in `ForgeService` and is applied uniformly to every method. Adapters do not re-validate the number.

### Files

- `src/services/forge/types.ts` — shrink the public interface
- `src/services/forge/forge-service.ts` — one forwarding method per resource
- `src/services/forge/github-service.ts` — delete `readGithubResource`; expose the existing `get*Resource` methods as the adapter implementation
- `src/services/forge/forgejo-service.ts` — same
- `src/features/pr-view/use-pr-view-content.ts` — fetchers call the typed method and return the value
- `src/features/pr-view/pr-view.tsx` — `ResourceSection` renderers receive the inner type

GitHub already has `getDetailsResource`, `readGithubDiffResource`, `getCommitsResource`, `getReviewsResource`, `getChecksResource`, `getDevelopmentResource`. The dispatcher in `readGithubResource` is a pass-through. Delete it; do not wrap it.

### Acceptance

- No `PullRequestResource` / `resourceKind` in the tree.
- No `resource.kind === …` checks in the view.
- Opening a PR still loads overview, details, diff, commits, reviews, checks, and development concurrently.
- Unsupported Forgejo sections still render as unsupported, not as query errors.

---

## Issue 5 — Query table, after typed methods

**Depends on issue 2.** Do not build a table that still stores `PullRequestResource`.

### Current shape

`usePrViewContent` creates eight `createCachedQuery` instances, eight `loadX` functions, and repeats that list in the effect and in `retry()`. Reviews / checks / development cache the tagged union, which is why the view inspects `.kind`.

Forgejo also calls `getView` independently for overview, details, and requested reviewers — three CLI round-trips for one payload.

### Target shape

**App query module.** One descriptor table for the eager PR queries. `commitPatch` stays beside the table because its key includes the SHA and it is dropped when the commit is cleared.

```ts
interface EagerQuery<T> {
  readonly query: CachedQuery<T>;
  readonly fetch: (selection: Selection) => Fetcher<T>;
  readonly isCacheable: (value: T) => boolean;
}
```

The effect and `retry()` iterate the table. Adding a section is one row, not four edits.

Do **not** invent a generic `getPullRequestResource` dispatcher to feed the table. Each row calls a typed forge method from issue 2.

Cache the inner values:

- `reviews: CachedQuery<PullRequestReviewsResource>`
- `checks: CachedQuery<ForgeSection<readonly PullRequestCheck[]>>`
- `development: CachedQuery<{ projects, linkedIssues }>`

`resourceFailed` becomes three small `sectionFailed` predicates, or one helper over `ForgeSection`. Delete the kind switch.

**Forgejo adapter, not the UI.** Cache `getView(number, repo)` inside `ForgejoService` the same way `createCachedForgeRepositoryReader` caches the repo. Overview, details, and requested reviewers become projections of one payload. Respect abort: a cancelled call must not poison the cache; a successful payload may be reused across in-flight sections of the same PR.

GitHub does not share that payload. Do not force a shared “view cache” onto `ForgeAdapter`.

### Files

- `src/features/pr-view/use-pr-view-content.ts`
- `src/features/pr-view/cached-query.ts` — only if the table needs a tiny helper; do not add a wrapper that `show`/`reset` already cover
- `src/services/forge/forgejo-service.ts` — view cache is an internal seam

### Acceptance

- One list of eager queries drives load and retry.
- Reviews / checks / development types in `PrViewContent` are the inner values.
- Forgejo overview + details + requested reviewers share one `pr view` CLI call per PR (retry / PR change still refetch).
- Selection key changes still reset every query and drop commit/file selection.

---

## Issue 3 — One file list, derived from the patch

**Can start in parallel with issue 5 once issue 2 has landed, or immediately after.** Independent of the query table as long as `diff` still exposes a patch section.

### Current shape

The Files pane has two sources of truth:

- PR-level: GitHub `files` JSON (`pullRequestFiles` → `content.diff().files`)
- Commit-level: parsed patch (`commitPatchFiles` → `patchFileIndex`)

Forgejo’s PR files section is hard-coded `unsupported` (“CLI does not provide structured changed files”) even when `readPatch` already loaded a patch. That is why the Files pane can sit empty next to a renderable diff.

`PullRequestDiffResource` is `{ patch, files }`. `diffFailed` treats a files-section failure as uncacheable even when the patch is fine. After the tree switch, `PullRequestFile` is only produced by GitHub `normalizeFiles` and consumed by the sidebar. Nothing else reads status / additions / deletions.

### Target shape

The current patch **is** the file list.

```ts
function currentPatch(
  content: PrViewContent,
): LoadState<ForgeSection<PullRequestPatch>>;
```

- No commit selected → PR diff patch
- Commit selected → that commit’s patch

`FilesBox` always does `patchFileIndex(section).files.map(file => file.name)`. `pullRequestFiles` and `commitPatchFiles` collapse into one path.

Then delete the second tree:

- Remove `files` from `PullRequestDiffResource`, or delete `PullRequestDiffResource` and let `getPullRequestDiff` return `ForgeSection<PullRequestPatch>`
- Stop GitHub `readGithubDiffResource` from fetching `/pulls/{n}/files`
- Stop Forgejo from returning a fake unsupported files section
- `diffFailed` / cacheability key only on the patch section

`patchFileIndex` stays the canonical parser. Do not add a parallel “structured files” model unless a later feature needs GitHub’s status/additions metadata. If that happens, it is overlay data keyed by path, not a second tree.

### Risk to verify before deleting the GitHub files fetch

GitHub’s files JSON can include paths that a patch parse omits (some binary / submodule / empty-rename cases). Before dropping the fetch, open a PR that has a rename, a lockfile, and a binary file, and confirm `patchFileIndex(prPatch).files` matches the Files pane you see today. If a real gap appears, keep the GitHub files fetch as **optional path metadata** merged by path, still with the patch as the default list. Do not keep two independent `FilesView` functions.

### Files

- `src/features/sidebar/sidebar.tsx` — `FilesView` derivation
- `src/features/pr-view/use-pr-view-content.ts` — `currentPatch()` (or equivalent) on `PrViewContent`
- `src/features/pr-view/pr-view.tsx` — `SelectedDiffBody` uses the same patch source as the tree
- `src/services/forge/types.ts` — drop or shrink `PullRequestDiffResource` / `PullRequestFile` if unused
- `src/services/forge/github-service.ts` — drop files JSON + `normalizeFiles` / `normalizeFileStatus` / `fileSchema` if unused
- `src/services/forge/forgejo-service.ts` — drop the unsupported files stub

### Acceptance

- GitHub PR Files pane still lists the changed paths.
- Forgejo PR Files pane lists paths from the loaded patch instead of the unsupported message.
- Selecting a commit still rebuilds the tree from that commit’s patch.
- `clearSelection` / `selectCommit(undefined)` returns the tree to the PR patch.
- Main diff and Files pane never disagree about which patch they are showing.

---

## Issue 4 — `MainView` instead of two optionals

**Depends on issue 3** enough that `SelectedDiffBody` should already read one patch. Can be the same diff as issue 3 if the patch helper is in place.

### Current shape

`selectedFile` and `selectedCommit` are independent `string | undefined`s. `PrView` reconstructs the screen with nested `Show` (file → commit → overview). `SelectedDiffBody` repeats `fromCommit()` for notices, headers, and patch source. `contextBanner` repeats the same combination.

That is incidental control flow. The product has three screens.

### Target model

One value, owned by `usePrViewContent`:

```ts
type MainView =
  | { readonly kind: "overview" }
  | { readonly kind: "commit"; readonly sha: string }
  | { readonly kind: "diff"; readonly path: string; readonly commit?: string };
```

Keep today’s activation rules:

| Action                                        | Next view                                          |
| --------------------------------------------- | -------------------------------------------------- |
| Open PR / `clearSelection`                    | `{ kind: "overview" }`                             |
| `selectCommit(sha)`                           | `{ kind: "commit", sha }` (file cleared, as today) |
| `selectFile(path)` with no commit             | `{ kind: "diff", path }`                           |
| `selectFile(path)` while a commit is selected | `{ kind: "diff", path, commit: sha }`              |
| Close diff (`o`)                              | `{ kind: "overview" }`                             |

Replace `selectedFile` / `selectedCommit` accessors with:

- `view: Accessor<MainView>`
- `selectFile` / `selectCommit` / `clearSelection` as the only writers

Derive convenience if a caller still needs a path or sha (`view().kind === "diff" ? view().path : undefined`). Do not keep the two signals as a second source of truth.

`PrView` switches on `view().kind` once: overview screen, commit-only screen, selected diff. `SelectedDiffBody` takes a `diff` view value and does not re-test `fromCommit()`. Notices / headers / patch source all read `view.commit`.

`currentPatch()` from issue 3 is a function of `MainView` plus the two patch queries.

### Files

- `src/features/pr-view/use-pr-view-content.ts` — state model
- `src/features/pr-view/pr-view.tsx` — one switch instead of nested `Show`
- `src/features/sidebar/sidebar.tsx` — Files / Commits boxes read `view()` rather than the two optionals

### Acceptance

- Same keyboard behavior: Enter on a file opens a diff; Enter on a commit opens commit context and rebuilds files; `o` returns to overview; `x` closes the PR.
- No nested `when={selectedFile()} fallback={when={selectedCommit()}}`.
- Context banner, close-diff affordance, and focus/scroll effects key off `view().kind`.

---

## Issue 1 — Decompose the leftover large files

**Last among the structural moves.** After issues 2–4, `pr-view.tsx` and `github-service.ts` should already have lost dispatchers, kind checks, and dual file lists. Split what remains, still under 1k lines per file, along change pressure — not arbitrary line counts.

### `src/features/pr-view/pr-view.tsx` (1135, new file)

This module currently owns chrome, overview, commit context, lock-file policy, diff loading, focus, and keybindings.

Target files after `MainView` exists:

| File                  | Owns                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| `pr-view.tsx`         | Shell, bindings, focus, which `MainView` to mount                                 |
| `pr-view-header.tsx`  | Context banner, close affordances, `PersistentHeader`, details loading/error      |
| `overview-screen.tsx` | `ResourceSection` + overview / reviews / checks / development                     |
| `commit-context.tsx`  | Commit metadata block (used by commit-only and diff screens)                      |
| `selected-diff.tsx`   | Patch notices, lock-file gating, `SplitFileDiff`                                  |
| `pr-view-chrome.ts`   | `MAIN_PANE_CHROME`, close labels, `oneLine`, `endTruncate` until issue 6 moves it |

`NoPullRequest` can live next to the shell or in `pr-view-header.tsx`. Do not extract one-function files.

### `src/services/forge/github-service.ts` (150 → 1106)

Most of the bloat is schemas plus `normalize*` functions sitting under the adapter class. The class should own CLI orchestration only.

| File                  | Owns                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `github-service.ts`   | `GithubService`, `readSection`, command args, `Promise.all` fan-out      |
| `github-schemas.ts`   | arktype schemas                                                          |
| `github-normalize.ts` | payload → domain. **Input is the validated schema type, not `unknown`.** |

`readSection` must call `parseForgeSchema` (or equivalent) and then `normalize(validated)`. GitHub normalizers that currently take `unknown` and re-parse (`normalizeChecks`, `normalizeProjects`, `normalizeRequestedReviewers`, `normalizeLinkedIssues`) lose the second parse. That is issue 6, done in this split so the new files do not copy the muddy contract.

### `src/features/sidebar/sidebar.tsx` (735)

Already three boxes plus shared chrome. Split before the next interaction lands here:

| File                    | Owns                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `sidebar.tsx`           | Composer, numeric pane bindings, `SIDEBAR_WIDTH`                                         |
| `sidebar-box.tsx`       | `SidebarBox`, `SidebarScrollBox`, `useFocusWhenActive`, `useScrollIntoView`, `EmptyGate` |
| `files-box.tsx`         | Tree + patch-derived paths                                                               |
| `commits-box.tsx`       | Commit list + local highlight                                                            |
| `pull-requests-box.tsx` | Filter + list                                                                            |

### `src/services/forge/forgejo-service.ts` (693)

Not over 1k, but the same split pays off once the view cache lands: `forgejo-schemas.ts` / `forgejo-normalize.ts` / `forgejo-service.ts`. Do it if the service is still the place schemas and normalizers live after issue 5; do not split it just to match GitHub.

### Acceptance

- No file this work creates or grows crosses 1000 lines.
- `pr-view.tsx` is the shell: bindings, focus, `MainView` switch.
- GitHub schemas are not in the adapter class file.
- Sidebar boxes can change independently.

---

## Issue 6 — Canonical helpers and explicit contracts

Land these in the diffs that already touch the call sites. Do not keep identity wrappers “for later.”

### Truncation

`endTruncate` in `pr-view.tsx` duplicates `truncateEnd` in `selectable-row.tsx`. Promote one function to `src/utils/truncate.ts` (or next to `present-text.ts`). Both call sites use it. Delete the private copies.

### Labels

Forgejo `normalizeDetailsFields` inlines what `normalizeLabel` already does. Map `payload.labels` through `normalizeLabel`.

### Load state

`use-pr-titles.ts` redeclares `LoadState<PullRequestList>` as `PullRequestTitlesLoadState`. Use `LoadState<PullRequestList>`. Delete the local alias.

### Error text

`operationErrorDescription` switches on every `ForgeOperationErrorCode` and always returns `error.diagnostic`. Sidebar `errorDescription` is the same identity function.

Delete both. Callers use `error.diagnostic`. Prefixed messages (`Could not load patch: ${error.diagnostic}`) stay at the call site.

### List option validation

`ForgeService.getPullRequests` and `loadForgePullRequestList` both validate limit/state.

Canonical home is `ForgeService` (public interface). `loadForgePullRequestList` applies defaults and the `maxListLimit` cap, and assumes the public method already rejected illegal values. Adapters are not called except through `ForgeService`.

### Schema seam

`parseForgeSchema` in `adapter-helpers.ts` is the canonical parse. GitHub `readSection` currently inlines the same `schema(cause)` / `type.errors` check, then several normalizers parse **again**.

Contract:

1. Decode JSON.
2. `parseForgeSchema(kind, schema, cause, diagnostic)` → `Result<Raw, ForgeOperationError>`.
3. `normalize(raw: Raw) → Result<Domain, ForgeOperationError>`.

Normalizers never take `unknown`. If a decoder is still `(cause: unknown) => Result<Domain, …>` at the `executeForgeJson` seam, it is a one-line compose of parse + normalize, not a second schema.

Forgejo `normalizeViewPayload` / `normalizeList` / `normalizeComments` should use `parseForgeSchema` the same way `normalizeRepositoryPayload` already does.

### Acceptance

- One truncate helper.
- One label normalizer.
- One `LoadState` type.
- No identity error-description wrappers.
- List limit/state validated once at the public forge interface.
- Validated payload in, domain object out, at every GitHub/Forgejo JSON seam this branch owns.

---

## Suggested diffs (implementation order)

Work in this order so each diff deletes a concept instead of relocating it:

1. **Typed forge methods** (issue 2). Small UI follow-up: stop narrowing in fetchers and `OverviewScreen`.
2. **Query table + Forgejo view cache** (issue 5).
3. **Patch-derived file list** (issue 3), including the GitHub files-fetch decision after the rename/binary/lockfile check.
4. **`MainView`** (issue 4). Same diff as 3 is fine if the patch helper is already there.
5. **File splits** (issue 1) plus the issue 6 cleanups in those files.

Stop if a step would grow `pr-view.tsx` or `github-service.ts` further past 1k without the corresponding split in the same diff.

---

## Out of scope

- New features, new tests, and unrelated shell/theme work.
- A generic resource dispatcher “to keep the adapter small.”
- Keeping GitHub files JSON as a second tree “just in case.”
- Extracting pass-through wrappers (`operationErrorDescription`, `errorDescription`, `PullRequestTitlesLoadState`) into shared modules instead of deleting them.
