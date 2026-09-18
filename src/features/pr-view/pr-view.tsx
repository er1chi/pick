import { basename } from "node:path";
import type { RepositoryAppContextState } from "@/context/app-context";
import { PaneStore, requestPaneFocus } from "@/context/active-pane-context";
import type { LoadState } from "@/features/pr-view/load-state";
import { patchFileIndex } from "@/features/pr-view/patch-file-index";
import {
  checkLine,
  collectionAvailability,
  commentBody,
  commentMetaLine,
  commitMessage,
  commitMetaLine,
  isRenderableCollection,
  isRenderableReviewerRequests,
  linkedIssueLine,
  operationErrorDescription,
  overviewMetaLine,
  persistentMetadataLines,
  presentRepositoryName,
  presentText,
  projectLine,
  pullRequestTitleLine,
  reviewBody,
  reviewCommentMetaLine,
  reviewMetaLine,
  reviewerAvailability,
  reviewerNames,
} from "@/features/pr-view/pr-view-display";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
  type ForgeSection,
  type PullRequestCheck,
  type PullRequestCommit,
  type PullRequestComment,
  type PullRequestDetails,
  type PullRequestLinkedIssue,
  type PullRequestOverview,
  type PullRequestPatch,
  type PullRequestProject,
  type PullRequestReview,
  type PullRequestReviewComment,
  type PullRequestReviewerRequests,
  type PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { formatPresentTimestamp } from "@/utils/format-timestamp";
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import type { JSX } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import type { FileDiffMetadata } from "@pierre/diffs";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";
import type { Accessor } from "solid-js";
import {
  prewarmSplitHighlights,
  SplitFileDiff,
  type SplitFileDiffScrollTarget,
} from "@/packages/pierre/solid/diffs";

export interface PrViewProps {
  readonly state: RepositoryAppContextState;
  readonly titles: PrTitles;
  readonly content: PrViewContent;
}

// The main pane gives up the fixed sidebar (32), its own border (2), and its
// horizontal padding (3) from the terminal width. Header and metadata lines are
// bounded by that budget so they truncate at the end instead of wrapping.
const MAIN_PANE_CHROME = 37;
// The top context row shares its width with the close affordances. The diff
// affordance only appears once a file or commit context is selected, so the
// reserved width tracks whichever affordances are actually shown.
const CLOSE_PR_LABEL = "[x] Close PR";
const CLOSE_DIFF_LABEL = "[o] Close diff";
const CLOSE_AFFORDANCE_GAP = 1;

function endTruncate(text: string, maxWidth: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxWidth) {
    return text;
  }
  let kept = "";
  for (let index = 0; index < maxWidth - 1; index += 1) {
    kept += characters[index] ?? "";
  }
  return maxWidth > 0 ? `${kept}…` : "";
}

interface PersistentHeaderProps {
  readonly repositoryName: string;
  readonly titleLine: string | undefined;
  readonly details: PullRequestDetails | undefined;
  readonly maxWidth: number;
}

function serviceName(
  kind: ApplicationContext.GitHub | ApplicationContext.Forgejo,
): string {
  return kind === ApplicationContext.GitHub ? "GitHub" : "Forgejo";
}

function initializationErrorDescription(
  error: ForgeInitializationError,
): string {
  const service = serviceName(error.kind);
  if (error.code === ForgeInitializationErrorCode.ExecutableUnavailable) {
    return `${service} CLI is unavailable.`;
  }
  return `${service} CLI version check failed.`;
}

function forgeInitializationError(
  state: RepositoryAppContextState,
): ForgeInitializationError | undefined {
  return state.kind === ApplicationContext.Local ? undefined : state.forgeError;
}

function arrayItems<T>(section: ForgeSection<readonly T[]>): readonly T[] {
  return section.status === "available" ? section.value : [];
}

function detailsValue(
  state: LoadState<PullRequestDetails>,
): PullRequestDetails | undefined {
  return state.value;
}

function detailsError(
  state: LoadState<PullRequestDetails>,
): string | undefined {
  return state.status === "error"
    ? operationErrorDescription(state.error)
    : undefined;
}

function sectionHeading(label: string, status: string): JSX.Element {
  return (
    <text fg={colors.foreground}>
      <strong>
        {label}: {status}
      </strong>
    </text>
  );
}

/**
 * Metadata and other incidental lines must occupy exactly one visual row, so
 * they are bounded to a one-row box and truncated at the end instead of
 * wrapping into adjacent rows.
 */
function renderMutedLine(
  line: string | undefined,
  maxWidth?: number,
): JSX.Element {
  return (
    <Show when={line}>
      {(value: Accessor<string>) =>
        oneLine(
          <text fg={colors.muted} wrapMode="none" truncate>
            {maxWidth === undefined ? value() : endTruncate(value(), maxWidth)}
          </text>,
        )
      }
    </Show>
  );
}

function oneLine(content: JSX.Element): JSX.Element {
  return (
    <box width="100%" height={1} flexGrow={0} flexShrink={0} overflow="hidden">
      {content}
    </box>
  );
}

function renderStackedItem(
  meta: string | undefined,
  body: string | undefined,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderMutedLine(meta)}
      <Show when={body}>
        {(value: Accessor<string>) => (
          <text fg={colors.foreground}>{value()}</text>
        )}
      </Show>
    </box>
  );
}

function renderCollectionSection<T>(
  label: string,
  section: ForgeSection<readonly T[]>,
  renderItem: (item: T) => JSX.Element,
): JSX.Element {
  return (
    <Show when={isRenderableCollection(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading(label, collectionAvailability(section))}
        <For each={arrayItems(section)}>{renderItem}</For>
      </box>
    </Show>
  );
}

function renderComments(
  section: ForgeSection<readonly PullRequestComment[]>,
): JSX.Element {
  return renderCollectionSection("Conversation", section, (comment) =>
    renderStackedItem(commentMetaLine(comment), commentBody(comment)),
  );
}

function renderOverview(
  summary: PullRequestSummary,
  overview: PullRequestOverview,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderMutedLine(overviewMetaLine(summary))}
      <Show when={presentText(overview.body)}>
        {(body: Accessor<string>) => (
          <box flexDirection="column" gap={1}>
            <text fg={colors.foreground}>
              <strong>Description</strong>
            </text>
            <text fg={colors.muted}>{body()}</text>
          </box>
        )}
      </Show>
      {renderComments(overview.conversationComments)}
    </box>
  );
}

function headerRow(content: JSX.Element): JSX.Element {
  return (
    <box height={1} width="100%" flexGrow={0} flexShrink={0} overflow="hidden">
      {content}
    </box>
  );
}

function PersistentHeader(props: PersistentHeaderProps): JSX.Element {
  const metadataLines = () =>
    props.details === undefined
      ? []
      : [...persistentMetadataLines(props.details)];
  const rowCount = () =>
    1 + (props.titleLine === undefined ? 0 : 1) + metadataLines().length;

  return (
    <box
      flexDirection="column"
      width="100%"
      height={rowCount()}
      flexGrow={0}
      flexShrink={0}
      overflow="hidden"
    >
      {headerRow(
        <text fg={colors.foreground} wrapMode="none" truncate>
          <strong>{endTruncate(props.repositoryName, props.maxWidth)}</strong>
        </text>,
      )}
      <Show when={props.titleLine}>
        {(title: Accessor<string>) =>
          headerRow(
            <text fg={colors.foreground} wrapMode="none" truncate>
              <strong>{endTruncate(title(), props.maxWidth)}</strong>
            </text>,
          )
        }
      </Show>
      <For each={metadataLines()}>
        {(line) =>
          headerRow(
            <text fg={colors.muted} wrapMode="none" truncate>
              {endTruncate(line, props.maxWidth)}
            </text>,
          )
        }
      </For>
    </box>
  );
}

function renderRequestedReviewers(
  section: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <Show when={isRenderableReviewerRequests(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading("Requested reviewers", reviewerAvailability(section))}
        {renderMutedLine(reviewerNames(section))}
      </box>
    </Show>
  );
}

function renderReviews(
  reviews: ForgeSection<readonly PullRequestReview[]>,
  reviewComments: ForgeSection<readonly PullRequestReviewComment[]>,
  requestedReviewers: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderCollectionSection("Submitted reviews", reviews, (review) =>
        renderStackedItem(reviewMetaLine(review), reviewBody(review)),
      )}
      {renderCollectionSection("Inline comments", reviewComments, (comment) =>
        renderStackedItem(reviewCommentMetaLine(comment), commentBody(comment)),
      )}
      {renderRequestedReviewers(requestedReviewers)}
    </box>
  );
}

function renderChecks(
  section: ForgeSection<readonly PullRequestCheck[]>,
): JSX.Element {
  return renderCollectionSection("Checks", section, (check) =>
    renderMutedLine(checkLine(check)),
  );
}

function renderDevelopment(
  projects: ForgeSection<readonly PullRequestProject[]>,
  linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderCollectionSection("Projects", projects, (project) =>
        renderMutedLine(projectLine(project)),
      )}
      {renderCollectionSection("Closing issues", linkedIssues, (issue) =>
        renderMutedLine(linkedIssueLine(issue)),
      )}
    </box>
  );
}

interface ResourceSectionProps<T> {
  readonly label: string;
  readonly state: LoadState<T>;
  readonly render: (value: T) => JSX.Element;
}

/**
 * Renders one independent PR section. Loading and query-level errors are shown
 * here; per-collection failure/unsupported states are handled by the section
 * renderers through their ForgeSection values.
 */
function ResourceSection<T>(props: ResourceSectionProps<T>): JSX.Element {
  const error = (): string | undefined =>
    props.state.status === "error"
      ? operationErrorDescription(props.state.error)
      : undefined;

  return (
    <box flexDirection="column" gap={0}>
      <Show when={props.state.status === "loading"}>
        <text fg={colors.muted}>Loading {props.label}…</text>
      </Show>
      <Show when={error()}>
        {(text: Accessor<string>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>Could not load {props.label}.</text>
            <text fg={colors.dim}>{text()}</text>
            <text fg={colors.muted}>Press r to retry.</text>
          </box>
        )}
      </Show>
      <Show keyed when={props.state.value}>
        {(value: T) => props.render(value)}
      </Show>
    </box>
  );
}

interface OverviewScreenProps {
  readonly content: PrViewContent;
  readonly summary: Accessor<PullRequestSummary | undefined>;
}

function OverviewScreen(props: OverviewScreenProps): JSX.Element {
  return (
    <box flexDirection="column" gap={1} width="100%">
      <ResourceSection
        label="pull request overview"
        state={props.content.overview()}
        render={(overview) => (
          <Show keyed when={props.summary()}>
            {(item: PullRequestSummary) => renderOverview(item, overview)}
          </Show>
        )}
      />
      <ResourceSection
        label="reviews"
        state={props.content.reviews()}
        render={(resource) =>
          resource.kind === "reviews" ? (
            renderReviews(
              resource.value.reviews,
              resource.value.reviewComments,
              resource.value.requestedReviewers,
            )
          ) : (
            <></>
          )
        }
      />
      <ResourceSection
        label="checks"
        state={props.content.checks()}
        render={(resource) =>
          resource.kind === "checks" ? (
            renderChecks(resource.value.checks)
          ) : (
            <></>
          )
        }
      />
      <ResourceSection
        label="development"
        state={props.content.development()}
        render={(resource) =>
          resource.kind === "development" ? (
            renderDevelopment(
              resource.value.projects,
              resource.value.linkedIssues,
            )
          ) : (
            <></>
          )
        }
      />
    </box>
  );
}

const lockFileNames = new Set([
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "composer.lock",
  "Gemfile.lock",
  "go.sum",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
]);

function isLockFile(path: string): boolean {
  const separator = path.lastIndexOf("/");
  return lockFileNames.has(separator < 0 ? path : path.slice(separator + 1));
}

function fileDiffName(fileDiff: FileDiffMetadata): string {
  if (fileDiff.prevName === undefined) {
    return fileDiff.name;
  }
  return `${fileDiff.prevName} → ${fileDiff.name}`;
}

function fileDiffsForPatch(
  section: ForgeSection<PullRequestPatch> | undefined,
  path: string | undefined,
): readonly FileDiffMetadata[] {
  if (path === undefined) {
    return [];
  }
  const fileDiff = patchFileIndex(section).byPath.get(path);
  return fileDiff === undefined ? [] : [fileDiff];
}

function patchSectionNotice(
  section: ForgeSection<PullRequestPatch>,
): string | undefined {
  switch (section.status) {
    case "unsupported":
      return section.reason.diagnostic;
    case "failed":
      return `Could not load patch: ${operationErrorDescription(section.error)}`;
    default:
      return undefined;
  }
}

const lockedNotice =
  "Lock file contents are hidden by default. Press e to show them.";

interface SelectedDiffProps {
  readonly content: PrViewContent;
  readonly path: string;
  readonly commit: PullRequestCommit | undefined;
  readonly revealLocked: boolean;
  readonly maxWidth: number;
  readonly setDiffScroll: (
    target: SplitFileDiffScrollTarget | undefined,
  ) => void;
}

function SelectedDiffBody(props: SelectedDiffProps): JSX.Element {
  const fromCommit = () => props.content.selectedCommit() !== undefined;
  const fileDiffs = createMemo(() =>
    fromCommit()
      ? fileDiffsForPatch(props.content.commitPatch().value, props.path)
      : fileDiffsForPatch(props.content.diff()?.patch, props.path),
  );

  const notice = (): string | undefined => {
    if (fromCommit()) {
      const state = props.content.commitPatch();
      if (state.status === "loading") {
        return "Loading commit diff…";
      }
      if (state.status === "error") {
        return `Could not load commit diff: ${operationErrorDescription(state.error)}`;
      }
      if (state.value === undefined) {
        return "Loading commit diff…";
      }
      const sectionNotice = patchSectionNotice(state.value);
      if (sectionNotice !== undefined) {
        return sectionNotice;
      }
    } else {
      const diff = props.content.diff();
      if (diff === undefined) {
        return "Loading pull request diff…";
      }
      const sectionNotice = patchSectionNotice(diff.patch);
      if (sectionNotice !== undefined) {
        return sectionNotice;
      }
    }
    if (fileDiffs().length === 0) {
      return "No patch is available for the selected file.";
    }
    return undefined;
  };

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
      width="100%"
      gap={1}
    >
      <Show when={props.content.selectedCommit()} keyed>
        {(sha: string) => (
          <scrollbox
            flexGrow={1}
            flexBasis={0}
            flexShrink={1}
            minHeight={3}
            width="100%"
          >
            <CommitContext
              sha={sha}
              commit={props.commit}
              hasFile
              maxWidth={props.maxWidth}
            />
          </scrollbox>
        )}
      </Show>
      <box
        flexDirection="column"
        width="100%"
        flexGrow={2}
        flexBasis={0}
        flexShrink={1}
        minHeight={fromCommit() ? 9 : 0}
      >
        {headerRow(
          <text fg={colors.dim} wrapMode="none" truncate>
            {endTruncate(
              fromCommit()
                ? `Commit diff · ${props.path}`
                : `Pull request diff · ${props.path}`,
              props.maxWidth,
            )}
          </text>,
        )}
        <Show
          when={notice()}
          fallback={
            <For each={fileDiffs()}>
              {(fileDiff) => (
                <box
                  flexDirection="column"
                  width="100%"
                  flexGrow={1}
                  flexShrink={1}
                  minHeight={0}
                >
                  {oneLine(
                    <text fg={colors.foreground} wrapMode="none" truncate>
                      {fileDiffName(fileDiff)}
                    </text>,
                  )}
                  <Show
                    when={props.revealLocked || !isLockFile(fileDiff.name)}
                    fallback={<text fg={colors.dim}>{lockedNotice}</text>}
                  >
                    <SplitFileDiff
                      fileDiff={fileDiff}
                      scrollTargetRef={props.setDiffScroll}
                    />
                  </Show>
                </box>
              )}
            </For>
          }
        >
          {(text: Accessor<string>) => <text fg={colors.muted}>{text()}</text>}
        </Show>
      </box>
    </box>
  );
}

function commitMessageLines(
  commit: PullRequestCommit | undefined,
): readonly string[] {
  const message = commit === undefined ? undefined : commitMessage(commit);
  if (message === undefined) {
    return [];
  }
  return message.split(/\r?\n/);
}

interface CommitContextProps {
  readonly sha: string;
  readonly commit: PullRequestCommit | undefined;
  readonly hasFile: boolean;
  readonly maxWidth: number;
}

function CommitContext(props: CommitContextProps): JSX.Element {
  const author = () => presentText(props.commit?.author?.login);
  const committer = () => presentText(props.commit?.committer?.login);
  const authoredAt = () => formatPresentTimestamp(props.commit?.authoredAt);
  const committedAt = () => formatPresentTimestamp(props.commit?.committedAt);
  const url = () => presentText(props.commit?.url);

  return (
    <box
      flexDirection="column"
      width="100%"
      gap={0}
      flexGrow={0}
      flexShrink={0}
    >
      {oneLine(
        <text fg={colors.foreground} wrapMode="none" truncate>
          <strong>{endTruncate(`Commit ${props.sha}`, props.maxWidth)}</strong>
        </text>,
      )}
      <Show when={props.commit}>
        {(commit: Accessor<PullRequestCommit>) =>
          renderMutedLine(commitMetaLine(commit()), props.maxWidth)
        }
      </Show>
      <Show when={props.commit === undefined}>
        {oneLine(
          <text fg={colors.dim} wrapMode="none" truncate>
            {endTruncate("Loading commit metadata…", props.maxWidth)}
          </text>,
        )}
      </Show>
      <For each={commitMessageLines(props.commit)}>
        {(line) => <text fg={colors.foreground}>{line}</text>}
      </For>
      {renderMutedLine(
        author() === undefined ? undefined : `Author: ${author()}`,
        props.maxWidth,
      )}
      {renderMutedLine(
        committer() === undefined ? undefined : `Committer: ${committer()}`,
        props.maxWidth,
      )}
      {renderMutedLine(
        authoredAt() === undefined ? undefined : `Authored: ${authoredAt()}`,
        props.maxWidth,
      )}
      {renderMutedLine(
        committedAt() === undefined ? undefined : `Committed: ${committedAt()}`,
        props.maxWidth,
      )}
      {renderMutedLine(url(), props.maxWidth)}
      <Show when={props.hasFile}>
        {oneLine(
          <text fg={colors.dim} wrapMode="none" truncate>
            {endTruncate("The diff below is from this commit.", props.maxWidth)}
          </text>,
        )}
      </Show>
    </box>
  );
}

function NoPullRequest(props: {
  readonly state: RepositoryAppContextState;
}): JSX.Element {
  const forgeError = () => forgeInitializationError(props.state);
  return (
    <box flexDirection="column" gap={1}>
      <Show when={props.state.kind === ApplicationContext.Local}>
        <text fg={colors.yellow}>
          <strong>Context: Local Git repository</strong>
        </text>
        <text fg={colors.muted}>
          Add a GitHub or Forgejo remote to initialize it.
        </text>
      </Show>
      <Show when={forgeError()}>
        {(error: Accessor<ForgeInitializationError>) => (
          <>
            <text fg={colors.yellow}>
              <strong>Context: CLI initialization error</strong>
            </text>
            <text fg={colors.muted}>
              {initializationErrorDescription(error())}
            </text>
          </>
        )}
      </Show>
      <Show
        when={
          props.state.kind !== ApplicationContext.Local &&
          forgeError() === undefined
        }
      >
        <text fg={colors.yellow}>
          <strong>Context: No pull request open</strong>
        </text>
        <text fg={colors.muted}>
          Select a pull request in the sidebar and press enter to open it.
        </text>
      </Show>
    </box>
  );
}

export function PrView(props: PrViewProps) {
  const [pane, setPane] = PaneStore.use();
  const dimensions = useTerminalDimensions();
  const contentWidth = () =>
    Math.max(16, dimensions().width - MAIN_PANE_CHROME);
  const diffContextSelected = () =>
    selectedFile() !== undefined || selectedCommit() !== undefined;
  const closeAffordancesWidth = () =>
    CLOSE_PR_LABEL.length +
    (diffContextSelected()
      ? CLOSE_AFFORDANCE_GAP + CLOSE_DIFF_LABEL.length
      : 0);
  const contextTextWidth = () =>
    Math.max(8, contentWidth() - closeAffordancesWidth() - 1);
  const [contentBox, setContentBox] = createSignal<BoxRenderable | undefined>();
  const [overviewScroll, setOverviewScroll] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const [diffScroll, setDiffScroll] = createSignal<
    SplitFileDiffScrollTarget | undefined
  >();
  const [revealLocked, setRevealLocked] = createSignal(false);
  const focused = () => pane.active === "content";
  const currentState = () => props.state;
  const localName = () => basename(currentState().cwd) || currentState().cwd;
  const repositoryName = () =>
    props.titles.list().value?.repository.fullName ?? localName();
  const openedNumber = () => props.titles.openedNumber();
  const summary = () => {
    const number = openedNumber();
    if (number === null) {
      return undefined;
    }
    return props.titles
      .list()
      .value?.items.find((item) => item.number === number);
  };
  const currentDetails = () => detailsValue(props.content.details());
  const detailsLoading = () => props.content.details().status === "loading";
  const selectedFile = () => props.content.selectedFile();
  const selectedCommit = () => props.content.selectedCommit();
  const selectedCommitValue = createMemo(() => {
    const sha = selectedCommit();
    if (sha === undefined) {
      return undefined;
    }
    return props.content.commits().find((commit) => commit.sha === sha);
  });
  const headerRepositoryName = () =>
    presentRepositoryName(
      currentDetails()?.repository.fullName,
      repositoryName(),
    );
  const titleLine = () => {
    const item = summary();
    if (item === undefined) {
      return undefined;
    }
    return pullRequestTitleLine(item.title, item.number);
  };
  const headerKey = () => {
    const number = openedNumber();
    const details = currentDetails();
    const detailsKey =
      details === undefined ? "pending" : `ready:${details.number}`;
    return `${number ?? "none"}:${detailsKey}:${titleLine() ?? ""}:${headerRepositoryName()}`;
  };

  const contextBanner = (): string => {
    const commit = selectedCommit();
    const path = selectedFile();
    // The full SHA stays in the commit metadata below; the fixed context line
    // only needs a short, stable reference.
    const reference = commit === undefined ? undefined : commit.slice(0, 12);
    if (reference !== undefined && path !== undefined) {
      return `Context: Commit ${reference} · File ${path}`;
    }
    if (reference !== undefined) {
      return `Context: Commit ${reference}`;
    }
    if (path !== undefined) {
      return `Context: Pull request · File ${path}`;
    }
    return "Context: Pull request";
  };

  function scrollContent(lines: number): void {
    if (selectedFile() !== undefined) {
      diffScroll()?.scrollBy(lines);
      return;
    }
    const overview = overviewScroll();
    if (overview !== undefined) {
      overview.scrollTop += lines;
    }
  }

  const closeOpened = (): void => {
    props.content.clearSelection();
    props.titles.closeOpened();
    requestPaneFocus(pane, setPane, "pull-requests");
  };

  // Returns the Main pane from a file or commit diff to the PR overview
  // without leaving the pane. `clearSelection` also puts the Files pane back
  // on PR-level files; focus is re-asserted so it never drifts to the tree.
  const closeDiff = (): void => {
    props.content.clearSelection();
    const overview = overviewScroll();
    if (overview !== undefined) {
      overview.scrollTop = 0;
    }
    requestPaneFocus(pane, setPane, "content");
  };

  useBindings(() => ({
    target: contentBox,
    commands: [
      {
        name: "pr-view.scroll-down",
        run: () => scrollContent(1),
      },
      {
        name: "pr-view.scroll-up",
        run: () => scrollContent(-1),
      },
      {
        name: "pr-view.retry",
        run: () => props.content.retry(),
      },
      {
        name: "pr-view.toggle-locked-files",
        run: () => {
          setRevealLocked((current) => !current);
        },
      },
      {
        name: "pr-view.close",
        run: closeOpened,
      },
      {
        name: "pr-view.close-diff",
        run: closeDiff,
      },
    ],
    bindings: [
      { key: "j", cmd: "pr-view.scroll-down" },
      { key: "k", cmd: "pr-view.scroll-up" },
      { key: "r", cmd: "pr-view.retry" },
      { key: "e", cmd: "pr-view.toggle-locked-files" },
      { key: "x", cmd: "pr-view.close" },
      { key: "o", cmd: "pr-view.close-diff" },
    ],
  }));

  createEffect(() => {
    // Track the request token so an explicit focus request re-runs this even
    // when the content pane was already active.
    void pane.focusRequest;
    if (!focused()) {
      return;
    }
    const overview = overviewScroll();
    if (selectedFile() === undefined && overview !== undefined) {
      overview.focus();
      return;
    }
    contentBox()?.focus();
  });

  createEffect(() => {
    prewarmSplitHighlights(patchFileIndex(props.content.diff()?.patch).files);
    prewarmSplitHighlights(
      patchFileIndex(props.content.commitPatch().value).files,
    );
  });

  createEffect(
    on(
      () => `${selectedFile() ?? ""}|${selectedCommit() ?? ""}`,
      () => {
        if (selectedFile() !== undefined) {
          diffScroll()?.reset();
          return;
        }
        const overview = overviewScroll();
        if (overview !== undefined) {
          overview.scrollTop = 0;
        }
      },
      { defer: true },
    ),
  );

  return (
    <box
      ref={setContentBox}
      focusable
      focused={focused()}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minWidth={0}
      height="100%"
      overflow="hidden"
      gap={1}
      paddingLeft={2}
      paddingRight={1}
      border
      borderColor={colors.border}
      focusedBorderColor={colors.blue}
      title="[3] Main"
    >
      <Show
        when={openedNumber() !== null}
        fallback={<NoPullRequest state={currentState()} />}
      >
        <box
          flexDirection="column"
          gap={0}
          width="100%"
          flexGrow={0}
          flexShrink={0}
        >
          <box
            flexDirection="row"
            width="100%"
            height={1}
            flexGrow={0}
            flexShrink={0}
          >
            <box
              flexGrow={1}
              flexShrink={1}
              minWidth={0}
              height={1}
              overflow="hidden"
            >
              <text fg={colors.blue} wrapMode="none" truncate>
                <strong>
                  {endTruncate(contextBanner(), contextTextWidth())}
                </strong>
              </text>
            </box>
            <box
              flexShrink={0}
              height={1}
              flexDirection="row"
              gap={CLOSE_AFFORDANCE_GAP}
            >
              <Show when={diffContextSelected()}>
                <text fg={colors.red} wrapMode="none">
                  {CLOSE_DIFF_LABEL}
                </text>
              </Show>
              <text fg={colors.red} wrapMode="none">
                {CLOSE_PR_LABEL}
              </text>
            </box>
          </box>
          <Show keyed when={headerKey()}>
            {() => (
              <PersistentHeader
                repositoryName={headerRepositoryName()}
                titleLine={titleLine()}
                details={
                  selectedFile() === undefined ? currentDetails() : undefined
                }
                maxWidth={contentWidth()}
              />
            )}
          </Show>
          <Show when={detailsLoading() && currentDetails() === undefined}>
            {oneLine(
              <text fg={colors.muted} wrapMode="none" truncate>
                Loading details…
              </text>,
            )}
          </Show>
          <Show when={detailsError(props.content.details())}>
            {(error: Accessor<string>) => (
              <box flexDirection="column">
                {oneLine(
                  <text fg={colors.yellow} wrapMode="none" truncate>
                    Could not load pull request details.
                  </text>,
                )}
                {oneLine(
                  <text fg={colors.dim} wrapMode="none" truncate>
                    {error()}
                  </text>,
                )}
              </box>
            )}
          </Show>
        </box>
        <Show
          when={selectedFile()}
          keyed
          fallback={
            <Show
              when={selectedCommit()}
              keyed
              fallback={
                <scrollbox
                  ref={setOverviewScroll}
                  flexGrow={1}
                  flexShrink={1}
                  minHeight={0}
                  width="100%"
                  stickyScroll
                  stickyStart="top"
                >
                  <OverviewScreen content={props.content} summary={summary} />
                </scrollbox>
              }
            >
              {(sha: string) => (
                <scrollbox
                  ref={setOverviewScroll}
                  flexGrow={1}
                  flexShrink={1}
                  minHeight={0}
                  width="100%"
                >
                  <box flexDirection="column" width="100%" gap={1}>
                    <CommitContext
                      sha={sha}
                      commit={selectedCommitValue()}
                      hasFile={false}
                      maxWidth={contentWidth()}
                    />
                    <text fg={colors.yellow}>
                      Select a file in the sidebar to view this commit's
                      changes.
                    </text>
                  </box>
                </scrollbox>
              )}
            </Show>
          }
        >
          {(path: string) => (
            <SelectedDiffBody
              content={props.content}
              path={path}
              commit={selectedCommitValue()}
              revealLocked={revealLocked()}
              maxWidth={contentWidth()}
              setDiffScroll={setDiffScroll}
            />
          )}
        </Show>
        <box
          height={1}
          width="100%"
          flexGrow={0}
          flexShrink={0}
          overflow="hidden"
        >
          <text fg={colors.dim} wrapMode="none" truncate>
            {endTruncate(
              "j/k scroll · e lock files · r reload · x close PR",
              contentWidth(),
            )}
          </text>
        </box>
      </Show>
    </box>
  );
}
