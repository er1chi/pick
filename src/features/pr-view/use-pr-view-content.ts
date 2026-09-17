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

export type PullRequestTab =
  | "overview"
  | Exclude<PullRequestResourceKind, "details">;

export const pullRequestTabs: readonly PullRequestTab[] = [
  "overview",
  "diff",
  "commits",
  "reviews",
  "checks",
  "development",
];

export type OverviewLoadState = LoadState<PullRequestOverview>;
export type DetailsLoadState = LoadState<PullRequestDetails>;
export type DiffLoadState = LoadState<PullRequestDiffResource>;
export type CommitsLoadState = LoadState<
  ForgeSection<readonly PullRequestCommit[]>
>;

export interface PrViewContent {
  readonly activeTab: Accessor<PullRequestTab>;
  readonly overview: Accessor<OverviewLoadState>;
  readonly details: Accessor<DetailsLoadState>;
  /** Eagerly loaded alongside overview/details whenever a PR is opened. */
  readonly diff: Accessor<PullRequestDiffResource | undefined>;
  readonly diffState: Accessor<DiffLoadState>;
  /** Eagerly loaded alongside overview/details whenever a PR is opened. */
  readonly commits: Accessor<readonly PullRequestCommit[]>;
  readonly commitsState: Accessor<CommitsLoadState>;
  /** The generic resource query, used by reviews/checks/development. */
  readonly resource: Accessor<LoadState<PullRequestResource>>;
  readonly selectedFile: Accessor<string | undefined>;
  readonly selectFile: (path: string) => void;
  readonly selectedCommit: Accessor<string | undefined>;
  readonly selectCommit: (sha: string | undefined) => void;
  readonly commitPatch: Accessor<LoadState<ForgeSection<PullRequestPatch>>>;
  readonly selectTab: (tab: PullRequestTab) => void;
  readonly retry: () => void;
}

type GenericResourceTab = Extract<
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
  tab: GenericResourceTab,
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
  const [activeTab, setActiveTab] = createSignal<PullRequestTab>("overview");

  const overview = createCachedQuery<PullRequestOverview>({
    isCacheable: (value) => !sectionFailed(value.conversationComments),
  });
  const details = createCachedQuery<PullRequestDetails>({
    isCacheable: () => true,
  });
  // Diff and commits are eager, dedicated queries so Files and Commits can be
  // shown together regardless of which main tab is active.
  const diff = createCachedQuery<PullRequestDiffResource>({
    isCacheable: (value) => !diffFailed(value),
  });
  const commits = createCachedQuery<ForgeSection<readonly PullRequestCommit[]>>(
    {
      isCacheable: (section) => section.status !== "failed",
    },
  );
  const resource = createCachedQuery<PullRequestResource>({
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

  function loadResource(
    selection: Selection,
    tab: GenericResourceTab,
    force = false,
  ): void {
    resource.show(
      `${selection.cacheKey}:${tab}`,
      resourceFetcher(selection, tab),
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

  // The first changed file is the default selection, so the diff pane is never
  // empty once the list arrives.
  function selectedFile(): string | undefined {
    const explicit = selectedFilePath();
    if (explicit !== undefined) {
      return explicit;
    }
    const files = diff.state().value?.files;
    return files?.status === "available" ? files.value[0]?.path : undefined;
  }

  // Default to the first commit so the commit pane has content without an
  // explicit selection.
  function selectedCommit(): string | undefined {
    return selectedCommitSha() ?? commitsValue()[0]?.sha;
  }

  // The single source of truth for what should be loaded right now. `show`
  // ignores repeat calls for the same key, so this can run on every list or
  // context change.
  createEffect(() => {
    const selection = currentSelection();
    const key = selection?.cacheKey;
    if (key !== selectedKey) {
      selectedKey = key;
      setActiveTab("overview");
      setSelectedFilePath(undefined);
      setSelectedCommitSha(undefined);
      commitPatch.reset();
    }

    if (selection === undefined) {
      overview.reset();
      details.reset();
      diff.reset();
      commits.reset();
      resource.reset();
      return;
    }

    loadOverview(selection);
    loadDetails(selection);
    loadDiff(selection);
    loadCommits(selection);

    const tab = activeTab();
    if (tab === "reviews" || tab === "checks" || tab === "development") {
      loadResource(selection, tab);
    } else {
      resource.reset();
    }

    if (tab === "commits") {
      const sha = selectedCommit();
      if (sha !== undefined) {
        loadCommitPatch(selection, sha);
      }
    }
  });

  function selectTab(tab: PullRequestTab): void {
    setActiveTab(tab);
  }

  function retry(): void {
    const selection = currentSelection();
    if (selection === undefined) {
      return;
    }
    const tab = activeTab();
    switch (tab) {
      case "overview":
        loadOverview(selection, true);
        loadDetails(selection, true);
        return;
      case "diff":
        loadDiff(selection, true);
        return;
      case "commits": {
        loadCommits(selection, true);
        const sha = selectedCommit();
        if (sha !== undefined) {
          loadCommitPatch(selection, sha, true);
        }
        return;
      }
      default:
        loadResource(selection, tab, true);
    }
  }

  return {
    activeTab,
    overview: overview.state,
    details: details.state,
    diff: () => diff.state().value,
    diffState: diff.state,
    commits: commitsValue,
    commitsState: commits.state,
    resource: resource.state,
    selectedFile,
    selectFile: (path) => setSelectedFilePath(path),
    selectedCommit,
    selectCommit: (sha) => setSelectedCommitSha(sha),
    commitPatch: commitPatch.state,
    selectTab,
    retry,
  };
}
