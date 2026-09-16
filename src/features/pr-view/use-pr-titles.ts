import {
  useAppContext,
  type AppContextState,
  type ForgeContextError,
} from "@/context/app-context";
import {
  ApplicationContext,
  ForgeOperationErrorCode,
  type ForgeKind,
  type PullRequestList,
  type PullRequestListState,
} from "@/services/forge/types";
import { moveInList } from "@/utils/navigation";
import { idleLoadState, isCancelled } from "@/features/pr-view/load-state";
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

type PullRequestTitlesLoadState =
  | {
      readonly status: "idle";
      readonly value: undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "loading";
      readonly value: PullRequestList | undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "ready";
      readonly value: PullRequestList;
      readonly error: undefined;
    }
  | {
      readonly status: "error";
      readonly value: PullRequestList | undefined;
      readonly error: ForgeContextError;
    };

export interface PrTitles {
  readonly list: Accessor<PullRequestTitlesLoadState>;
  readonly filter: Accessor<PullRequestListState>;
  readonly highlightedNumber: Accessor<number | null>;
  readonly setFilter: (filter: PullRequestListState) => void;
  readonly cycleFilter: (offset: number) => void;
  readonly moveHighlight: (offset: number) => void;
  readonly retry: () => void;
}

function remoteKind(state: AppContextState): ForgeKind | undefined {
  if (
    state.kind !== ApplicationContext.GitHub &&
    state.kind !== ApplicationContext.Forgejo
  ) {
    return undefined;
  }
  return state.forgeError === undefined ? state.kind : undefined;
}

export function usePrTitles(): PrTitles {
  const appContext = useAppContext();
  const [list, setList] =
    createSignal<PullRequestTitlesLoadState>(idleLoadState());
  const [filter, setFilterSignal] = createSignal<PullRequestListState>("open");
  const [highlightedNumber, setHighlightedNumber] = createSignal<number | null>(
    null,
  );
  const [retryVersion, setRetryVersion] = createSignal(0);

  let requestGeneration = 0;
  let activeRepositoryKey = "";
  let listController: AbortController | undefined;
  let lastSuccessfulList: PullRequestList | undefined;

  createEffect(() => {
    const state = appContext.state();
    const selectedFilter = filter();
    retryVersion();
    const repositoryKey = `${state.cwd}:${state.kind}`;
    const repositoryChanged = repositoryKey !== activeRepositoryKey;
    const generation = ++requestGeneration;
    activeRepositoryKey = repositoryKey;

    listController?.abort();
    listController = undefined;

    if (repositoryChanged) {
      lastSuccessfulList = undefined;
      setHighlightedNumber(null);
    }

    const kind = remoteKind(state);
    if (kind === undefined) {
      setList(idleLoadState());
      return;
    }

    const controller = new AbortController();
    listController = controller;
    setList({
      status: "loading",
      value: repositoryChanged ? undefined : lastSuccessfulList,
      error: undefined,
    });

    void appContext.forge
      .getPullRequests({
        signal: controller.signal,
        state: selectedFilter,
      })
      .then((result) => {
        if (
          generation !== requestGeneration ||
          repositoryKey !== activeRepositoryKey ||
          filter() !== selectedFilter ||
          controller.signal.aborted
        ) {
          return;
        }
        if (result.isErr()) {
          if (!isCancelled(result.error)) {
            setList({
              status: "error",
              value: lastSuccessfulList,
              error: result.error,
            });
          }
          return;
        }

        lastSuccessfulList = result.value;
        setList({ status: "ready", value: result.value, error: undefined });
        const currentNumber = highlightedNumber();
        const selectedItem = result.value.items.find(
          (item) => item.number === currentNumber,
        );
        setHighlightedNumber(
          selectedItem?.number ?? result.value.items[0]?.number ?? null,
        );
      })
      .catch((cause: unknown) => {
        if (
          generation !== requestGeneration ||
          repositoryKey !== activeRepositoryKey ||
          filter() !== selectedFilter ||
          controller.signal.aborted
        ) {
          return;
        }
        const diagnostic =
          cause instanceof Error
            ? cause.message
            : "Could not load pull requests";
        setList({
          status: "error",
          value: lastSuccessfulList,
          error: {
            code: ForgeOperationErrorCode.IncompatibleResponse,
            kind,
            diagnostic,
          },
        });
      });

    onCleanup(() => {
      controller.abort();
      if (listController === controller) {
        listController = undefined;
      }
    });
  });

  onCleanup(() => {
    listController?.abort();
    listController = undefined;
  });

  function setFilter(nextFilter: PullRequestListState): void {
    if (nextFilter === filter()) {
      return;
    }
    listController?.abort();
    setFilterSignal(nextFilter);
  }

  function cycleFilter(offset: number): void {
    const filters: readonly PullRequestListState[] = ["open", "closed", "all"];
    const currentIndex = filters.indexOf(filter());
    const nextIndex = (currentIndex + offset + filters.length) % filters.length;
    const nextFilter = filters[nextIndex];
    if (nextFilter !== undefined) {
      setFilter(nextFilter);
    }
  }

  function moveHighlight(offset: number): void {
    const currentList = list();
    if (
      currentList.status !== "ready" ||
      currentList.value.items.length === 0
    ) {
      return;
    }

    const currentNumber = highlightedNumber();
    const currentItem = currentList.value.items.find(
      (item) => item.number === currentNumber,
    );
    const firstItem = currentList.value.items[0];
    if (currentItem === undefined && firstItem === undefined) {
      return;
    }
    const anchorItem = currentItem ?? firstItem;
    if (anchorItem === undefined) {
      return;
    }
    setHighlightedNumber(
      moveInList(currentList.value.items, anchorItem, offset).number,
    );
  }

  function retry(): void {
    listController?.abort();
    setRetryVersion((version) => version + 1);
  }

  return {
    list,
    filter,
    highlightedNumber,
    setFilter,
    cycleFilter,
    moveHighlight,
    retry,
  };
}
