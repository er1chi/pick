import { Result } from "better-result";
import { createSignal, onCleanup, type Accessor } from "solid-js";
import { idleLoadState, type LoadState } from "@/features/pr-view/load-state";

import type { Result as ResultType } from "better-result";
import type { ForgeOperationError } from "@/services/forge/types";

/** Must never reject: a rejected fetch would leave the query loading forever.
 * The ForgeService boundary guarantees this for forge operations. */
export type Fetcher<T> = (
  signal: AbortSignal,
) => Promise<ResultType<T, ForgeOperationError>>;

export interface CachedQuery<T> {
  readonly state: Accessor<LoadState<T>>;
  show(key: string, fetch: Fetcher<T>, force?: boolean): void;
  reset(): void;
}

export interface CachedQueryOptions<T> {
  /** Failed payloads are not cached, so revisiting a key fetches them again. */
  readonly isCacheable: (value: T) => boolean;
}

/**
 * One visible value, keyed by a string. `show` is a no-op when the key is
 * already current, so reactive callers can call it unconditionally.
 */
export function createCachedQuery<T>(
  options: CachedQueryOptions<T>,
): CachedQuery<T> {
  const cache = new Map<string, T>();
  const [state, setState] = createSignal<LoadState<T>>(idleLoadState());
  let key: string | undefined;
  let request: AbortController | undefined;

  function cancel(): void {
    request?.abort();
    request = undefined;
  }

  /** The successful result for the current key, if one has settled. */
  function retained(): ResultType<T, ForgeOperationError> | undefined {
    const current = state();
    if (key === undefined) {
      return undefined;
    }
    if (current.status === "loading") {
      return current.previous;
    }
    if (current.status === "settled" && current.result.isOk()) {
      return current.result;
    }
    return undefined;
  }

  function show(nextKey: string, fetch: Fetcher<T>, force = false): void {
    if (!force && key === nextKey) {
      return;
    }
    const previous = key === nextKey ? retained() : undefined;
    key = nextKey;
    cancel();

    if (!force) {
      const cached = cache.get(nextKey);
      if (cached !== undefined) {
        setState({
          status: "settled",
          result: Result.ok(cached),
          previous: undefined,
        });
        return;
      }
    }

    const controller = new AbortController();
    request = controller;
    setState({ status: "loading", previous });

    void fetch(controller.signal).then((result) => {
      // Identity is the whole staleness guard: every supersede, reset, and
      // dispose replaces or clears `request`.
      if (request !== controller) {
        return;
      }
      request = undefined;
      if (result.isErr()) {
        setState({ status: "settled", result, previous });
        return;
      }
      if (options.isCacheable(result.value)) {
        cache.set(nextKey, result.value);
      }
      setState({ status: "settled", result, previous: undefined });
    });
  }

  function reset(): void {
    cancel();
    key = undefined;
    setState(idleLoadState());
  }

  onCleanup(() => {
    cancel();
    cache.clear();
  });

  return { state, show, reset };
}
