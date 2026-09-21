import { Result } from "better-result";
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { useAppContext } from "@/context/app-context";
import {
  idleLoadState,
  isCancelled,
  type LoadState,
} from "@/features/pr-view/load-state";

import type {
  PullRequestList,
  PullRequestListState,
} from "@/services/forge/types";

export interface PrTitles {
  readonly list: Accessor<LoadState<PullRequestList>>;
  readonly filter: Accessor<PullRequestListState>;
  readonly openedNumber: Accessor<number | null>;
  readonly setFilter: (filter: PullRequestListState) => void;
  readonly cycleFilter: (offset: number) => void;
  readonly open: (number: number) => void;
  readonly closeOpened: () => void;
  readonly retry: () => void;
}

export function usePrTitles(): PrTitles {
  const appContext = useAppContext();
  const [list, setList] =
    createSignal<LoadState<PullRequestList>>(idleLoadState());
  const [filter, setFilterSignal] = createSignal<PullRequestListState>("open");
  const [openedNumber, setOpenedNumber] = createSignal<number | null>(null);
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
      setOpenedNumber(null);
    }

    const forge = state.forge;
    if (forge === undefined) {
      setList(idleLoadState());
      return;
    }

    const controller = new AbortController();
    listController = controller;
    setList({
      status: "loading",
      previous:
        !repositoryChanged && lastSuccessfulList !== undefined
          ? Result.ok(lastSuccessfulList)
          : undefined,
    });

    void forge
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
              status: "settled",
              result,
              previous:
                lastSuccessfulList === undefined
                  ? undefined
                  : Result.ok(lastSuccessfulList),
            });
          }
          return;
        }

        lastSuccessfulList = result.value;
        setList({ status: "settled", result, previous: undefined });

        // An opened pull request only survives while it is still listed for
        // the active filter. A filter change that drops it closes it.
        const opened = openedNumber();
        if (
          opened !== null &&
          !result.value.items.some((item) => item.number === opened)
        ) {
          setOpenedNumber(null);
        }
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

  function open(number: number): void {
    setOpenedNumber(number);
  }

  function closeOpened(): void {
    setOpenedNumber(null);
  }

  function retry(): void {
    listController?.abort();
    setRetryVersion((version) => version + 1);
  }

  return {
    list,
    filter,
    openedNumber,
    setFilter,
    cycleFilter,
    open,
    closeOpened,
    retry,
  };
}
