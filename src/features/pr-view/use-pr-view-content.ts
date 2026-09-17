import { useAppContext } from "@/context/app-context";
import {
  createCachedQuery,
  type Fetcher,
} from "@/features/pr-view/cached-query";
import type { LoadState } from "@/features/pr-view/load-state";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { ForgeService } from "@/services/forge/forge-service";
import {
  ForgeOperationErrorCode,
  type ForgeOperationError,
  type ForgeSection,
  type PullRequestCommit,
  type PullRequestDetails,
  type PullRequestDiffResource,
  type PullRequestOverview,
  type PullRequestPatch,
  type PullRequestResource,
  type PullRequestResourceKind,
} from "@/services/forge/types";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { createEffect, createSignal, type Accessor } from "solid-js";

type OverviewLoadState = LoadState<PullRequestOverview>;
type DetailsLoadState = LoadState<PullRequestDetails>;
type DiffLoadState = LoadState<PullRequestDiffResource>;
type CommitsLoadState = LoadState<ForgeSection<readonly PullRequestCommit[]>>;
type ResourceLoadState = LoadState<PullRequestResource>;

export interface PrViewContent {
  readonly overview: Accessor<OverviewLoadState>;
  readonly details: Accessor<DetailsLoadState>;
  readonly diff: Accessor<PullRequestDiffResource | undefined>;
  readonly diffState: Accessor<DiffLoadState>;
  readonly commits: Accessor<readonly PullRequestCommit[]>;
  readonly commitsState: Accessor<CommitsLoadState>;
  /** Reviews/checks/development are independent eager queries so the unified
   * main screen can show every PR section concurrently. */
  readonly reviews: Accessor<ResourceLoadState>;
  readonly checks: Accessor<ResourceLoadState>;
  readonly development: Accessor<ResourceLoadState>;
  /** `undefined` until the user picks a file; never defaulted to the first. */
  readonly selectedFile: Accessor<string | undefined>;
  readonly selectFile: (path: string) => void;
  /** `undefined` until the user picks a commit; never defaulted to the first. */
  readonly selectedCommit: Accessor<string | undefined>;
  /**
   * `selectCommit(sha)` clears the file selection and eagerly loads `sha`'s
   * patch; `selectCommit(undefined)` returns to PR-level files and drops the
   * commit patch.
   */
  readonly selectCommit: (sha: string | undefined) => void;
  readonly commitPatch: Accessor<LoadState<ForgeSection<PullRequestPatch>>>;
  /** Clears commit, file, and commit-patch state for the open PR. */
  readonly clearSelection: () => void;
  readonly retry: () => void;
}

type EagerResourceTab = Extract<
  PullRequestResourceKind,
  "reviews" | "checks" | "development"
>;

interface Selection {
  readonly forge: ForgeService;
  readonly number: number;
  readonly cacheKey: string;
}

function sectionFailed(section: ForgeSection<unknown>): boolean {
  return section.status === "failed";
}

function diffFailed(resource: PullRequestDiffResource): boolean {
  return sectionFailed(resource.patch) || sectionFailed(resource.files);
}

function resourceFailed(resource: PullRequestResource): boolean {
  switch (resource.kind) {
    case "details":
      return false;
    case "diff":
      return diffFailed(resource.value);
    case "commits":
      return sectionFailed(resource.value.commits);
    case "reviews":
      return (
        sectionFailed(resource.value.reviews) ||
        sectionFailed(resource.value.reviewComments) ||
        sectionFailed(resource.value.requestedReviewers)
      );
    case "checks":
      return sectionFailed(resource.value.checks);
    case "development":
      return (
        sectionFailed(resource.value.projects) ||
        sectionFailed(resource.value.linkedIssues)
      );
  }
}

function incompatible<T>(
  forge: ForgeService,
  diagnostic: string,
): ResultType<T, ForgeOperationError> {
  return Result.err<T, ForgeOperationError>({
    code: ForgeOperationErrorCode.IncompatibleResponse,
    kind: forge.kind,
    diagnostic,
  });
}

function forgeFetcher<T>(
  forge: ForgeService,
  fallback: string,
  run: (signal: AbortSignal) => Promise<ResultType<T, ForgeOperationError>>,
): Fetcher<T> {
  return (signal) =>
    Promise.resolve()
      .then(() => run(signal))
      .catch((cause: unknown) =>
        Result.err<T, ForgeOperationError>({
          code: ForgeOperationErrorCode.IncompatibleResponse,
          kind: forge.kind,
          diagnostic: cause instanceof Error ? cause.message : fallback,
        }),
      );
}

function overviewFetcher(selection: Selection): Fetcher<PullRequestOverview> {
  const { forge, number } = selection;
  return forgeFetcher(forge, "Could not load pull request overview", (signal) =>
    forge.getPullRequestOverview(number, { signal }),
  );
}

function detailsFetcher(selection: Selection): Fetcher<PullRequestDetails> {
  const { forge, number } = selection;
  return forgeFetcher(
    forge,
    "Could not load pull request details",
    async (signal) => {
      const result = await forge.getPullRequestResource(number, "details", {
        signal,
      });
      if (result.isErr()) {
        return Result.err<PullRequestDetails, ForgeOperationError>(
          result.error,
        );
      }
      return result.value.kind === "details"
        ? Result.ok(result.value.value.details)
        : incompatible(
            forge,
            "Details resource returned a different resource kind",
          );
    },
  );
}

function diffFetcher(selection: Selection): Fetcher<PullRequestDiffResource> {
  const { forge, number } = selection;
  return forgeFetcher(forge, "Could not load files changed", async (signal) => {
    const result = await forge.getPullRequestResource(number, "diff", {
      signal,
    });
    if (result.isErr()) {
      return Result.err<PullRequestDiffResource, ForgeOperationError>(
        result.error,
      );
    }
    return result.value.kind === "diff"
      ? Result.ok(result.value.value)
      : incompatible(forge, "Diff resource returned a different resource kind");
  });
}

function commitsFetcher(
  selection: Selection,
): Fetcher<ForgeSection<readonly PullRequestCommit[]>> {
  const { forge, number } = selection;
  return forgeFetcher(forge, "Could not load commits", async (signal) => {
    const result = await forge.getPullRequestResource(number, "commits", {
      signal,
    });
    if (result.isErr()) {
      return Result.err<
        ForgeSection<readonly PullRequestCommit[]>,
        ForgeOperationError
      >(result.error);
    }
    return result.value.kind === "commits"
      ? Result.ok(result.value.value.commits)
      : incompatible(
          forge,
          "Commits resource returned a different resource kind",
        );
  });
}

function resourceFetcher(
  selection: Selection,
  tab: EagerResourceTab,
): Fetcher<PullRequestResource> {
  const { forge, number } = selection;
  return forgeFetcher(forge, `Could not load ${tab}`, (signal) =>
    forge.getPullRequestResource(number, tab, { signal }),
  );
}

function commitPatchFetcher(
  selection: Selection,
  sha: string,
): Fetcher<ForgeSection<PullRequestPatch>> {
  const { forge } = selection;
  return forgeFetcher(forge, `Could not load commit ${sha}`, (signal) =>
    forge.getCommitPatch(sha, { signal }),
  );
}

export function usePrViewContent(titles: PrTitles): PrViewContent {
  const appContext = useAppContext();

  const overview = createCachedQuery<PullRequestOverview>({
    isCacheable: (value) => !sectionFailed(value.conversationComments),
  });
  const details = createCachedQuery<PullRequestDetails>({
    isCacheable: () => true,
  });
  const diff = createCachedQuery<PullRequestDiffResource>({
    isCacheable: (value) => !diffFailed(value),
  });
  const commits = createCachedQuery<ForgeSection<readonly PullRequestCommit[]>>(
    {
      isCacheable: (section) => section.status !== "failed",
    },
  );
  const reviews = createCachedQuery<PullRequestResource>({
    isCacheable: (value) => !resourceFailed(value),
  });
  const checks = createCachedQuery<PullRequestResource>({
    isCacheable: (value) => !resourceFailed(value),
  });
  const development = createCachedQuery<PullRequestResource>({
    isCacheable: (value) => !resourceFailed(value),
  });
  const commitPatch = createCachedQuery<ForgeSection<PullRequestPatch>>({
    isCacheable: (section) => section.status !== "failed",
  });

  const [selectedFilePath, setSelectedFilePath] = createSignal<string>();
  const [selectedCommitSha, setSelectedCommitSha] = createSignal<string>();
  let selectedKey: string | undefined;

  function currentSelection(): Selection | undefined {
    const state = appContext.state();
    const number = titles.openedNumber();
    const list = titles.list().value;
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

  function loadOverview(selection: Selection, force = false): void {
    overview.show(selection.cacheKey, overviewFetcher(selection), force);
  }

  function loadDetails(selection: Selection, force = false): void {
    details.show(selection.cacheKey, detailsFetcher(selection), force);
  }

  function loadDiff(selection: Selection, force = false): void {
    diff.show(selection.cacheKey, diffFetcher(selection), force);
  }

  function loadCommits(selection: Selection, force = false): void {
    commits.show(selection.cacheKey, commitsFetcher(selection), force);
  }

  function loadReviews(selection: Selection, force = false): void {
    reviews.show(
      selection.cacheKey,
      resourceFetcher(selection, "reviews"),
      force,
    );
  }

  function loadChecks(selection: Selection, force = false): void {
    checks.show(
      selection.cacheKey,
      resourceFetcher(selection, "checks"),
      force,
    );
  }

  function loadDevelopment(selection: Selection, force = false): void {
    development.show(
      selection.cacheKey,
      resourceFetcher(selection, "development"),
      force,
    );
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
    const section = commits.state().value;
    return section?.status === "available" ? section.value : [];
  }

  // Selection is only ever explicit: opening a PR starts with neither a file
  // nor a commit selected.
  function selectedFile(): string | undefined {
    return selectedFilePath();
  }

  function selectedCommit(): string | undefined {
    return selectedCommitSha();
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
      setSelectedFilePath(undefined);
      setSelectedCommitSha(undefined);
      commitPatch.reset();
    }

    if (selection === undefined) {
      overview.reset();
      details.reset();
      diff.reset();
      commits.reset();
      reviews.reset();
      checks.reset();
      development.reset();
      commitPatch.reset();
      return;
    }

    loadOverview(selection);
    loadDetails(selection);
    loadDiff(selection);
    loadCommits(selection);
    loadReviews(selection);
    loadChecks(selection);
    loadDevelopment(selection);

    // A selected commit's patch is independent of any screen, so it loads
    // eagerly here and is dropped as soon as the commit is cleared.
    const sha = selectedCommitSha();
    if (sha !== undefined) {
      loadCommitPatch(selection, sha);
    } else {
      commitPatch.reset();
    }
  });

  // Selecting a commit always resets the file selection: the file tree then
  // derives from that commit rather than the PR-level diff. `selectFile` only
  // changes the file and keeps the current commit context.
  function selectCommit(sha: string | undefined): void {
    setSelectedCommitSha(sha);
    setSelectedFilePath(undefined);
  }

  function selectFile(path: string): void {
    setSelectedFilePath(path);
  }

  function clearSelection(): void {
    setSelectedCommitSha(undefined);
    setSelectedFilePath(undefined);
    commitPatch.reset();
  }

  function retry(): void {
    const selection = currentSelection();
    if (selection === undefined) {
      return;
    }
    loadOverview(selection, true);
    loadDetails(selection, true);
    loadDiff(selection, true);
    loadCommits(selection, true);
    loadReviews(selection, true);
    loadChecks(selection, true);
    loadDevelopment(selection, true);
    const sha = selectedCommitSha();
    if (sha !== undefined) {
      loadCommitPatch(selection, sha, true);
    }
  }

  return {
    overview: overview.state,
    details: details.state,
    diff: () => diff.state().value,
    diffState: diff.state,
    commits: commitsValue,
    commitsState: commits.state,
    reviews: reviews.state,
    checks: checks.state,
    development: development.state,
    selectedFile,
    selectFile,
    selectedCommit,
    selectCommit,
    commitPatch: commitPatch.state,
    clearSelection,
    retry,
  };
}
