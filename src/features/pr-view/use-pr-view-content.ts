import { createEffect, type Accessor } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { useViewContext, viewCommit } from "@/context/view-context";
import {
  createCachedQuery,
  type CachedQuery,
  type Fetcher,
} from "@/features/pr-view/cached-query";
import { visibleValue, type LoadState } from "@/features/pr-view/load-state";

import type { Result as ResultType } from "better-result";
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
  /** The selected commit's patch when a commit is selected, otherwise the pull
   * request diff patch. The Files pane and the main diff both read this. */
  readonly currentPatch: Accessor<DiffLoadState>;
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

export function usePrViewContent(): PrViewContent {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();

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

  function currentSelection(): Selection | undefined {
    const state = forgeContext.state();
    const opened = viewContext.view();
    if (state.forge === undefined || opened === undefined) {
      return undefined;
    }

    return {
      forge: state.forge,
      number: opened.number,
      cacheKey: `${state.kind}:${opened.id}`,
    };
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
    const opened = viewContext.view();
    if (opened !== undefined && viewCommit(opened) !== undefined) {
      return commitPatch.state();
    }
    return diff.state();
  }

  createEffect(() => {
    const opened = viewContext.view();
    const selection = currentSelection();
    if (selection === undefined) {
      resetEager();
      commitPatch.reset();
      return;
    }

    loadEager(selection);

    const sha = opened === undefined ? undefined : viewCommit(opened);
    if (sha !== undefined) {
      loadCommitPatch(selection, sha);
    } else {
      commitPatch.reset();
    }
  });

  function retry(): void {
    const opened = viewContext.view();
    const selection = currentSelection();
    if (selection === undefined) {
      return;
    }
    loadEager(selection, true);
    const sha = opened === undefined ? undefined : viewCommit(opened);
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
    currentPatch,
    retry,
  };
}
