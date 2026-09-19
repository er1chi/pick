import { createEffect, createSignal, type Accessor } from "solid-js";
import { useAppContext } from "@/context/app-context";
import {
  createCachedQuery,
  type CachedQuery,
  type Fetcher,
} from "@/features/pr-view/cached-query";
import { visibleValue, type LoadState } from "@/features/pr-view/load-state";

import type { Result as ResultType } from "better-result";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { ForgeService } from "@/services/forge/forge-service";
import type {
  ForgeOperationError,
  ForgeSection,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestOverview,
  PullRequestPatch,
  PullRequestReviewsResource,
} from "@/services/forge/types";

type OverviewLoadState = LoadState<PullRequestOverview>;
type DetailsLoadState = LoadState<PullRequestDetails>;
type DiffLoadState = LoadState<ForgeSection<PullRequestPatch>>;
type CommitsLoadState = LoadState<ForgeSection<readonly PullRequestCommit[]>>;
type ReviewsLoadState = LoadState<PullRequestReviewsResource>;
type ChecksLoadState = LoadState<ForgeSection<readonly PullRequestCheck[]>>;
type DevelopmentLoadState = LoadState<PullRequestDevelopment>;

/** The three main-pane screens. `usePrViewContent` owns the one value that
 * selects between them; callers derive a path or sha from it. */
export type MainView =
  | { readonly kind: "overview" }
  | { readonly kind: "commit"; readonly sha: string }
  | {
      readonly kind: "diff";
      readonly path: string;
      readonly commit?: string;
    };

/** The commit a view is anchored to, if any (commit context or a commit
 * diff). Overview and commit-free diffs return `undefined`. */
export function mainViewCommit(view: MainView): string | undefined {
  if (view.kind === "commit") {
    return view.sha;
  }
  return view.kind === "diff" ? view.commit : undefined;
}

export interface PrViewContent {
  readonly overview: Accessor<OverviewLoadState>;
  readonly details: Accessor<DetailsLoadState>;
  readonly commits: Accessor<readonly PullRequestCommit[]>;
  readonly commitsState: Accessor<CommitsLoadState>;
  /** Reviews/checks/development are independent eager queries so the unified
   * main screen can show every PR section concurrently. */
  readonly reviews: Accessor<ReviewsLoadState>;
  readonly checks: Accessor<ChecksLoadState>;
  readonly development: Accessor<DevelopmentLoadState>;
  /** The one main-pane view: overview, commit context, or a file diff. */
  readonly view: Accessor<MainView>;
  readonly selectFile: (path: string) => void;
  /**
   * `selectCommit(sha)` shows that commit's context and eagerly loads its
   * patch; `selectCommit(undefined)` returns to the overview.
   */
  readonly selectCommit: (sha: string | undefined) => void;
  /** The selected commit's patch when a commit is selected, otherwise the pull
   * request diff patch. The Files pane and the main diff both read this. */
  readonly currentPatch: Accessor<DiffLoadState>;
  /** Clears commit, file, and commit-patch state for the open PR. */
  readonly clearSelection: () => void;
  readonly retry: () => void;
}

interface Selection {
  readonly forge: ForgeService;
  readonly number: number;
  readonly cacheKey: string;
}

function sectionFailed(section: ForgeSection<unknown>): boolean {
  return section.status === "failed";
}

function reviewsFailed(resource: PullRequestReviewsResource): boolean {
  return (
    sectionFailed(resource.reviews) ||
    sectionFailed(resource.reviewComments) ||
    sectionFailed(resource.requestedReviewers)
  );
}

function developmentFailed(resource: PullRequestDevelopment): boolean {
  return (
    sectionFailed(resource.projects) || sectionFailed(resource.linkedIssues)
  );
}

function forgeFetcher<T>(
  run: (signal: AbortSignal) => Promise<ResultType<T, ForgeOperationError>>,
): Fetcher<T> {
  return (signal) => run(signal);
}

function overviewFetcher(selection: Selection): Fetcher<PullRequestOverview> {
  const { forge, number } = selection;
  return forgeFetcher((signal) =>
    forge.getPullRequestOverview(number, { signal }),
  );
}

function detailsFetcher(selection: Selection): Fetcher<PullRequestDetails> {
  const { forge, number } = selection;
  return forgeFetcher((signal) =>
    forge.getPullRequestDetails(number, { signal }),
  );
}

function diffFetcher(
  selection: Selection,
): Fetcher<ForgeSection<PullRequestPatch>> {
  const { forge, number } = selection;
  return forgeFetcher((signal) => forge.getPullRequestDiff(number, { signal }));
}

function commitsFetcher(
  selection: Selection,
): Fetcher<ForgeSection<readonly PullRequestCommit[]>> {
  const { forge, number } = selection;
  return forgeFetcher((signal) =>
    forge.getPullRequestCommits(number, { signal }),
  );
}

function reviewsFetcher(
  selection: Selection,
): Fetcher<PullRequestReviewsResource> {
  const { forge, number } = selection;
  return forgeFetcher((signal) =>
    forge.getPullRequestReviews(number, { signal }),
  );
}

function checksFetcher(
  selection: Selection,
): Fetcher<ForgeSection<readonly PullRequestCheck[]>> {
  const { forge, number } = selection;
  return forgeFetcher((signal) =>
    forge.getPullRequestChecks(number, { signal }),
  );
}

function developmentFetcher(
  selection: Selection,
): Fetcher<PullRequestDevelopment> {
  const { forge, number } = selection;
  return forgeFetcher((signal) =>
    forge.getPullRequestDevelopment(number, { signal }),
  );
}

function commitPatchFetcher(
  selection: Selection,
  sha: string,
): Fetcher<ForgeSection<PullRequestPatch>> {
  const { forge } = selection;
  return forgeFetcher((signal) => forge.getCommitPatch(sha, { signal }));
}

interface EagerRow {
  show: (selection: Selection, force?: boolean) => void;
  reset: () => void;
}

/** Binds one eager cached query to the fetcher that loads it for a selection. */
function eagerRow<T>(
  query: CachedQuery<T>,
  fetch: (selection: Selection) => Fetcher<T>,
): EagerRow {
  return {
    show: (selection, force = false) =>
      query.show(selection.cacheKey, fetch(selection), force),
    reset: () => query.reset(),
  };
}

export function usePrViewContent(titles: PrTitles): PrViewContent {
  const appContext = useAppContext();

  const overview = createCachedQuery<PullRequestOverview>({
    isCacheable: (value) => !sectionFailed(value.conversationComments),
  });
  const details = createCachedQuery<PullRequestDetails>({
    isCacheable: () => true,
  });
  const diff = createCachedQuery<ForgeSection<PullRequestPatch>>({
    isCacheable: (section) => !sectionFailed(section),
  });
  const commits = createCachedQuery<ForgeSection<readonly PullRequestCommit[]>>(
    {
      isCacheable: (section) => section.status !== "failed",
    },
  );
  const reviews = createCachedQuery<PullRequestReviewsResource>({
    isCacheable: (value) => !reviewsFailed(value),
  });
  const checks = createCachedQuery<ForgeSection<readonly PullRequestCheck[]>>({
    isCacheable: (section) => !sectionFailed(section),
  });
  const development = createCachedQuery<PullRequestDevelopment>({
    isCacheable: (value) => !developmentFailed(value),
  });
  const commitPatch = createCachedQuery<ForgeSection<PullRequestPatch>>({
    isCacheable: (section) => section.status !== "failed",
  });

  const eagerRows: readonly EagerRow[] = [
    eagerRow(overview, overviewFetcher),
    eagerRow(details, detailsFetcher),
    eagerRow(diff, diffFetcher),
    eagerRow(commits, commitsFetcher),
    eagerRow(reviews, reviewsFetcher),
    eagerRow(checks, checksFetcher),
    eagerRow(development, developmentFetcher),
  ];

  function loadEager(selection: Selection, force = false): void {
    for (const row of eagerRows) {
      row.show(selection, force);
    }
  }

  function resetEager(): void {
    for (const row of eagerRows) {
      row.reset();
    }
  }

  const [view, setView] = createSignal<MainView>({ kind: "overview" });
  let selectedKey: string | undefined;

  function currentSelection(): Selection | undefined {
    const state = appContext.state();
    const number = titles.openedNumber();
    const list = visibleValue(titles.list());
    if (state.forge === undefined || number === null || list === undefined) {
      return undefined;
    }

    const { repository } = list;
    const contextKey = [
      state.kind,
      state.cwd,
      repository.url ?? repository.fullName,
      repository.fullName,
    ].join(":");
    return { forge: state.forge, number, cacheKey: `${contextKey}#${number}` };
  }

  function loadCommitPatch(
    selection: Selection,
    sha: string,
    force = false,
  ): void {
    commitPatch.show(
      `${selection.cacheKey}#${sha}`,
      commitPatchFetcher(selection, sha),
      force,
    );
  }

  function commitsValue(): readonly PullRequestCommit[] {
    const section = visibleValue(commits.state());
    return section?.status === "available" ? section.value : [];
  }

  // Selection is only ever explicit: opening a PR starts on the overview.
  // The Files pane and the main diff must never disagree about which patch
  // they show, so both derive it from the one view value.
  function currentPatch(): DiffLoadState {
    return mainViewCommit(view()) === undefined
      ? diff.state()
      : commitPatch.state();
  }

  // The single source of truth for what should be loaded right now. `show`
  // ignores repeat calls for the same key, so this can run on every list or
  // context change. A key change means a different PR or repository: all
  // selection and pending query state is dropped before the new key loads.
  createEffect(() => {
    const selection = currentSelection();
    const key = selection?.cacheKey;
    if (key !== selectedKey) {
      selectedKey = key;
      clearSelection();
    }

    if (selection === undefined) {
      resetEager();
      commitPatch.reset();
      return;
    }

    loadEager(selection);

    // A selected commit's patch is independent of any screen, so it loads
    // eagerly here and is dropped as soon as the commit is cleared.
    const sha = mainViewCommit(view());
    if (sha !== undefined) {
      loadCommitPatch(selection, sha);
    } else {
      commitPatch.reset();
    }
  });

  // Selecting a commit switches to its context and clears any open file.
  // `selectFile` keeps the current commit context, if there is one.
  function selectCommit(sha: string | undefined): void {
    setView(sha === undefined ? { kind: "overview" } : { kind: "commit", sha });
  }

  function selectFile(path: string): void {
    const commit = mainViewCommit(view());
    setView(
      commit === undefined
        ? { kind: "diff", path }
        : { kind: "diff", path, commit },
    );
  }

  function clearSelection(): void {
    setView({ kind: "overview" });
    commitPatch.reset();
  }

  function retry(): void {
    const selection = currentSelection();
    if (selection === undefined) {
      return;
    }
    loadEager(selection, true);
    const sha = mainViewCommit(view());
    if (sha !== undefined) {
      loadCommitPatch(selection, sha, true);
    }
  }

  return {
    overview: overview.state,
    details: details.state,
    commits: commitsValue,
    commitsState: commits.state,
    reviews: reviews.state,
    checks: checks.state,
    development: development.state,
    view,
    selectFile,
    selectCommit,
    currentPatch,
    clearSelection,
    retry,
  };
}
