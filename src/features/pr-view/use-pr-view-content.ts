import {
  useAppContext,
  type AppContextState,
  type ForgeContextError,
} from "@/context/app-context";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import { idleLoadState, isCancelled } from "@/features/pr-view/load-state";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import {
  ApplicationContext,
  ForgeOperationErrorCode,
  type ForgeKind,
  type ForgeSection,
  type PullRequestList,
  type PullRequestOverview,
  type PullRequestResource,
  type PullRequestResourceKind,
} from "@/services/forge/types";
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

export type PullRequestTab = "overview" | PullRequestResourceKind;

export const pullRequestTabs: readonly PullRequestTab[] = [
  "overview",
  "details",
  "diff",
  "commits",
  "reviews",
  "checks",
  "development",
];

export type OverviewLoadState =
  | {
      readonly status: "idle";
      readonly value: undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "loading";
      readonly value: PullRequestOverview | undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "ready";
      readonly value: PullRequestOverview;
      readonly error: undefined;
    }
  | {
      readonly status: "error";
      readonly value: PullRequestOverview | undefined;
      readonly error: ForgeContextError;
    };

type ResourceLoadState =
  | {
      readonly status: "idle";
      readonly value: undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "loading";
      readonly value: PullRequestResource | undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "ready";
      readonly value: PullRequestResource;
      readonly error: undefined;
    }
  | {
      readonly status: "error";
      readonly value: PullRequestResource | undefined;
      readonly error: ForgeContextError;
    };

export interface PrViewContent {
  readonly activeTab: Accessor<PullRequestTab>;
  readonly overview: Accessor<OverviewLoadState>;
  readonly resource: Accessor<ResourceLoadState>;
  readonly selectTab: (tab: PullRequestTab) => void;
  readonly retry: () => void;
}

interface Selection {
  readonly contextKey: string;
  readonly repositoryName: string;
  readonly number: number;
  readonly cacheKey: string;
  readonly selectionKey: string;
}

interface OverviewInFlight {
  readonly controller: AbortController;
  readonly promise: Promise<ResultType<PullRequestOverview, ForgeContextError>>;
  readonly background: boolean;
}

interface ResourceInFlight {
  readonly controller: AbortController;
  readonly promise: Promise<ResultType<PullRequestResource, ForgeContextError>>;
}

interface CancellableRequest<T> {
  readonly controller: AbortController;
  readonly promise: Promise<ResultType<T, ForgeContextError>>;
}

const overviewDebounceMs = 150;
const prefetchDelayMs = 250;

function operationError(
  cause: unknown,
  kind: ForgeKind,
  fallback: string,
): ForgeContextError {
  return {
    code: ForgeOperationErrorCode.IncompatibleResponse,
    kind,
    diagnostic: cause instanceof Error ? cause.message : fallback,
  };
}

function sectionFailed<T>(section: ForgeSection<T>): boolean {
  return section.status === "failed";
}

function overviewHasFailure(overview: PullRequestOverview): boolean {
  return sectionFailed(overview.conversationComments);
}

function resourceHasFailure(resource: PullRequestResource): boolean {
  switch (resource.kind) {
    case "details":
      return false;
    case "diff":
      return (
        sectionFailed(resource.value.patch) ||
        sectionFailed(resource.value.files)
      );
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

function listValue(
  state: ReturnType<PrTitles["list"]>,
): PullRequestList | undefined {
  return state.value;
}

function activeForgeKind(state: AppContextState): ForgeKind {
  return state.kind === ApplicationContext.Forgejo
    ? ApplicationContext.Forgejo
    : ApplicationContext.GitHub;
}

function createCancellableRequest<T>(
  execute: (signal: AbortSignal) => Promise<ResultType<T, ForgeContextError>>,
  kind: ForgeKind,
  fallback: string,
): CancellableRequest<T> {
  const controller = new AbortController();
  const promise = Promise.resolve()
    .then(() => execute(controller.signal))
    .catch((cause: unknown) =>
      Result.err<never, ForgeContextError>(
        operationError(cause, kind, fallback),
      ),
    );
  return { controller, promise };
}

function trackRequest<T, Request extends CancellableRequest<T>>(
  requests: Map<string, Request>,
  key: string,
  request: Request,
): Request {
  requests.set(key, request);
  void request.promise.then(
    () => forgetRequest(requests, key, request.promise),
    () => forgetRequest(requests, key, request.promise),
  );
  return request;
}

function forgetRequest<T, Request extends CancellableRequest<T>>(
  requests: Map<string, Request>,
  key: string,
  promise: Request["promise"],
): void {
  const current = requests.get(key);
  if (current?.promise === promise) {
    requests.delete(key);
  }
}

export function usePrViewContent(titles: PrTitles): PrViewContent {
  const appContext = useAppContext();
  const [activeTab, setActiveTab] = createSignal<PullRequestTab>("overview");
  const [overview, setOverview] =
    createSignal<OverviewLoadState>(idleLoadState());
  const [resource, setResource] =
    createSignal<ResourceLoadState>(idleLoadState());

  const overviewCache = new Map<string, PullRequestOverview>();
  const resourceCache = new Map<string, PullRequestResource>();
  const overviewInFlight = new Map<string, OverviewInFlight>();
  const resourceInFlight = new Map<string, ResourceInFlight>();

  let activeSelectionKey: string | undefined;
  let activeResourceKey: string | undefined;
  let overviewGeneration = 0;
  let resourceGeneration = 0;
  let activeFilter = titles.filter();
  let prefetchGeneration = 0;
  let overviewTimer: ReturnType<typeof setTimeout> | undefined;
  let prefetchTimer: ReturnType<typeof setTimeout> | undefined;
  let foregroundOverviewController: AbortController | undefined;
  let foregroundResourceController: AbortController | undefined;
  let prefetchController: AbortController | undefined;

  function currentSelection(): Selection | undefined {
    const state = appContext.state();
    if (
      (state.kind !== ApplicationContext.GitHub &&
        state.kind !== ApplicationContext.Forgejo) ||
      state.forgeError !== undefined
    ) {
      return undefined;
    }

    const number = titles.highlightedNumber();
    const currentList = listValue(titles.list());
    if (number === null || currentList === undefined) {
      return undefined;
    }

    const repositoryName = currentList.repository.fullName;
    const contextKey = [
      state.kind,
      state.cwd,
      currentList.repository.url ?? repositoryName,
      repositoryName,
    ].join(":");
    return {
      contextKey,
      repositoryName,
      number,
      cacheKey: `${contextKey}#${number}`,
      selectionKey: `${contextKey}#${number}`,
    };
  }

  function currentList(): PullRequestList | undefined {
    return listValue(titles.list());
  }

  function clearOverviewTimer(): void {
    if (overviewTimer !== undefined) {
      clearTimeout(overviewTimer);
      overviewTimer = undefined;
    }
  }

  function cancelPrefetch(): void {
    prefetchGeneration += 1;
    prefetchController?.abort();
    prefetchController = undefined;
    if (prefetchTimer !== undefined) {
      clearTimeout(prefetchTimer);
      prefetchTimer = undefined;
    }
  }

  function startOverviewRequest(
    selection: Selection,
    background: boolean,
    force: boolean,
  ): OverviewInFlight {
    const existing = overviewInFlight.get(selection.selectionKey);
    if (existing !== undefined) {
      if (
        !existing.controller.signal.aborted &&
        (background || (!existing.background && !force))
      ) {
        return existing;
      }
      existing.controller.abort();
      overviewInFlight.delete(selection.selectionKey);
    }

    const baseRequest = createCancellableRequest(
      (signal) =>
        appContext.forge.getPullRequestOverview(selection.number, { signal }),
      activeForgeKind(appContext.state()),
      "Could not load pull request overview",
    );
    return trackRequest(overviewInFlight, selection.selectionKey, {
      ...baseRequest,
      background,
    });
  }

  function startResourceRequest(
    selection: Selection,
    tab: PullRequestResourceKind,
    force: boolean,
  ): ResourceInFlight {
    const key = `${selection.selectionKey}:${tab}`;
    const existing = resourceInFlight.get(key);
    if (existing !== undefined) {
      if (!existing.controller.signal.aborted && !force) {
        return existing;
      }
      existing.controller.abort();
      resourceInFlight.delete(key);
    }

    const request = createCancellableRequest(
      (signal) =>
        appContext.forge.getPullRequestResource(selection.number, tab, {
          signal,
        }),
      activeForgeKind(appContext.state()),
      `Could not load ${tab}`,
    );
    return trackRequest(resourceInFlight, key, request);
  }

  function schedulePrefetch(selection: Selection): void {
    if (activeTab() !== "overview") {
      return;
    }
    cancelPrefetch();
    const generation = prefetchGeneration;
    prefetchTimer = setTimeout(() => {
      prefetchTimer = undefined;
      if (
        generation !== prefetchGeneration ||
        activeSelectionKey !== selection.selectionKey ||
        activeTab() !== "overview"
      ) {
        return;
      }

      const items = currentList()?.items ?? [];
      const currentIndex = items.findIndex(
        (item) => item.number === selection.number,
      );
      const nextSummary =
        currentIndex < 0 ? undefined : items[currentIndex + 1];
      if (nextSummary === undefined) {
        return;
      }

      const nextSelection: Selection = {
        ...selection,
        number: nextSummary.number,
        cacheKey: `${selection.contextKey}#${nextSummary.number}`,
        selectionKey: `${selection.contextKey}#${nextSummary.number}`,
      };
      if (overviewCache.has(nextSelection.cacheKey)) {
        return;
      }

      const request = startOverviewRequest(nextSelection, true, false);
      prefetchController = request.controller;
      void request.promise.then((result) => {
        if (
          generation !== prefetchGeneration ||
          activeSelectionKey !== selection.selectionKey ||
          activeTab() !== "overview" ||
          request.controller.signal.aborted
        ) {
          return;
        }
        if (result.isOk() && !overviewHasFailure(result.value)) {
          overviewCache.set(nextSelection.cacheKey, result.value);
        }
      });
    }, prefetchDelayMs);
  }

  function showCachedOverview(
    selection: Selection,
    cached: PullRequestOverview,
  ): void {
    setOverview({ status: "ready", value: cached, error: undefined });
    if (activeTab() === "overview") {
      schedulePrefetch(selection);
    }
  }

  function loadOverview(selection: Selection, force: boolean): void {
    const cached = force ? undefined : overviewCache.get(selection.cacheKey);
    if (cached !== undefined) {
      showCachedOverview(selection, cached);
      return;
    }

    const generation = ++overviewGeneration;
    foregroundOverviewController?.abort();
    const request = startOverviewRequest(selection, false, force);
    foregroundOverviewController = request.controller;
    const previous = overview();
    const previousValue =
      previous.status === "ready" &&
      previous.value.repository.fullName === selection.repositoryName &&
      previous.value.number === selection.number
        ? previous.value
        : undefined;
    setOverview({ status: "loading", value: previousValue, error: undefined });

    void request.promise.then((result) => {
      if (
        generation !== overviewGeneration ||
        activeSelectionKey !== selection.selectionKey ||
        request.controller.signal.aborted
      ) {
        return;
      }
      foregroundOverviewController = undefined;
      if (result.isErr()) {
        if (!isCancelled(result.error)) {
          setOverview({
            status: "error",
            value: previousValue,
            error: result.error,
          });
        }
        return;
      }

      setOverview({ status: "ready", value: result.value, error: undefined });
      if (!overviewHasFailure(result.value)) {
        overviewCache.set(selection.cacheKey, result.value);
      }
      if (activeTab() === "overview" && !overviewHasFailure(result.value)) {
        schedulePrefetch(selection);
      }
    });
  }

  function loadResource(
    selection: Selection,
    tab: PullRequestResourceKind,
    force: boolean,
  ): void {
    const cacheKey = `${selection.cacheKey}:${tab}`;
    const cached = force ? undefined : resourceCache.get(cacheKey);
    const key = `${selection.selectionKey}:${tab}`;
    const previousResourceKey = activeResourceKey;
    if (previousResourceKey !== key) {
      foregroundResourceController?.abort();
      foregroundResourceController = undefined;
      resourceGeneration += 1;
    }
    activeResourceKey = key;
    if (cached !== undefined) {
      setResource({ status: "ready", value: cached, error: undefined });
      return;
    }

    const generation = ++resourceGeneration;
    const request = startResourceRequest(selection, tab, force);
    foregroundResourceController = request.controller;
    const previous = resource();
    const previousValue =
      previous.status === "ready" && previousResourceKey === key
        ? previous.value
        : undefined;
    setResource({ status: "loading", value: previousValue, error: undefined });

    void request.promise.then((result) => {
      if (
        generation !== resourceGeneration ||
        activeSelectionKey !== selection.selectionKey ||
        activeTab() !== tab ||
        activeResourceKey !== key ||
        request.controller.signal.aborted
      ) {
        return;
      }
      foregroundResourceController = undefined;
      if (result.isErr()) {
        if (!isCancelled(result.error)) {
          setResource({
            status: "error",
            value: previousValue,
            error: result.error,
          });
        }
        return;
      }

      setResource({ status: "ready", value: result.value, error: undefined });
      if (!resourceHasFailure(result.value)) {
        resourceCache.set(cacheKey, result.value);
      }
    });
  }

  createEffect(() => {
    const currentFilter = titles.filter();
    const selection = currentSelection();
    const filterChanged = currentFilter !== activeFilter;
    if (filterChanged) {
      activeFilter = currentFilter;
      cancelPrefetch();
    }

    const nextSelectionKey = selection?.selectionKey;
    if (nextSelectionKey === activeSelectionKey) {
      return;
    }

    activeSelectionKey = nextSelectionKey;
    clearOverviewTimer();
    cancelPrefetch();
    foregroundOverviewController?.abort();
    foregroundOverviewController = undefined;
    foregroundResourceController?.abort();
    foregroundResourceController = undefined;
    overviewGeneration += 1;
    resourceGeneration += 1;
    activeResourceKey = undefined;
    setResource(idleLoadState());
    setActiveTab("overview");

    if (selection === undefined) {
      setOverview(idleLoadState());
      return;
    }

    const cached = overviewCache.get(selection.cacheKey);
    if (cached !== undefined) {
      showCachedOverview(selection, cached);
      return;
    }

    setOverview({ status: "loading", value: undefined, error: undefined });
    overviewTimer = setTimeout(() => {
      overviewTimer = undefined;
      if (activeSelectionKey === selection.selectionKey) {
        loadOverview(selection, false);
      }
    }, overviewDebounceMs);
  });

  function selectTab(tab: PullRequestTab): void {
    if (tab === activeTab()) {
      return;
    }

    if (tab !== "overview") {
      cancelPrefetch();
    }
    setActiveTab(tab);
    if (tab === "overview") {
      const selection = currentSelection();
      if (selection !== undefined && overview().status === "ready") {
        schedulePrefetch(selection);
      }
      foregroundResourceController?.abort();
      foregroundResourceController = undefined;
      resourceGeneration += 1;
      activeResourceKey = undefined;
      setResource(idleLoadState());
      return;
    }

    const selection = currentSelection();
    if (selection === undefined) {
      setResource(idleLoadState());
      return;
    }
    loadResource(selection, tab, false);
  }

  function retry(): void {
    const selection = currentSelection();
    if (selection === undefined) {
      return;
    }
    const tab = activeTab();
    if (tab === "overview") {
      cancelPrefetch();
      loadOverview(selection, true);
      return;
    }
    loadResource(selection, tab, true);
  }

  onCleanup(() => {
    clearOverviewTimer();
    cancelPrefetch();
    foregroundOverviewController?.abort();
    foregroundResourceController?.abort();
    prefetchController?.abort();
    for (const request of overviewInFlight.values()) {
      request.controller.abort();
    }
    for (const request of resourceInFlight.values()) {
      request.controller.abort();
    }
    overviewInFlight.clear();
    resourceInFlight.clear();
    overviewCache.clear();
    resourceCache.clear();
  });

  return {
    activeTab,
    overview,
    resource,
    selectTab,
    retry,
  };
}
