import { Result } from "better-result";
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { LoadStatus } from "../types";
import {
  idleLoadState,
  isCancelled,
  type LoadState,
} from "../utils/load-state";

import type {
  PullRequestList,
  PullRequestListState,
} from "@/services/forge/types";

export interface PrTitles {
  readonly list: Accessor<LoadState<PullRequestList>>;
  readonly filter: Accessor<PullRequestListState>;
  readonly setFilter: (filter: PullRequestListState) => void;
  readonly cycleFilter: (offset: number) => void;
  readonly retry: () => void;
}

export function usePrTitles(): PrTitles {
  const forgeContext = useForgeContext();
  const [list, setList] =
    createSignal<LoadState<PullRequestList>>(idleLoadState());
  const [filter, setFilterSignal] = createSignal<PullRequestListState>("open");
  const [retryVersion, setRetryVersion] = createSignal(0);

  let requestGeneration = 0;
  let listController: AbortController | undefined;
  let lastSuccessfulList: PullRequestList | undefined;

  createEffect(() => {
    const state = forgeContext.state();
    const selectedFilter = filter();
    retryVersion();
    const generation = ++requestGeneration;

    listController?.abort();
    listController = undefined;

    const forge = state.forge;
    if (forge === undefined) {
      setList(idleLoadState());
      return;
    }

    const controller = new AbortController();
    listController = controller;
    setList({
      status: LoadStatus.Loading,
      previous:
        lastSuccessfulList !== undefined
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
          filter() !== selectedFilter ||
          controller.signal.aborted
        ) {
          return;
        }
        if (result.isErr()) {
          if (!isCancelled(result.error)) {
            setList({
              status: LoadStatus.Settled,
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
        setList({ status: LoadStatus.Settled, result, previous: undefined });
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

  function retry(): void {
    listController?.abort();
    setRetryVersion((version) => version + 1);
  }

  return {
    list,
    filter,
    setFilter,
    cycleFilter,
    retry,
  };
}
