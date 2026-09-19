import {
  ForgeCancelledError,
  type ForgeOperationError,
} from "@/services/forge/types";

import type { Result as ResultType } from "better-result";

export interface IdleLoadState {
  readonly status: "idle";
}

export interface LoadingLoadState<T> {
  readonly status: "loading";
  /** Last successful result, retained for display while a fresh load runs. */
  readonly previous: ResultType<T, ForgeOperationError> | undefined;
}

export interface SettledLoadState<T> {
  readonly status: "settled";
  readonly result: ResultType<T, ForgeOperationError>;
  /** Last successful result, retained when the latest load failed. */
  readonly previous: ResultType<T, ForgeOperationError> | undefined;
}

/**
 * Lifecycle of one keyed load. Success and failure live in a `Result`, so the
 * union only describes lifecycle; `previous` retains the last successful
 * result for display across a reload or a failure.
 */
export type LoadState<T> =
  | IdleLoadState
  | LoadingLoadState<T>
  | SettledLoadState<T>;

export function idleLoadState(): IdleLoadState {
  return { status: "idle" };
}

/** The result a view should render: the settled result when it succeeded,
 * otherwise the last successful result retained across the failure. */
export function visibleResult<T>(
  state: LoadState<T>,
): ResultType<T, ForgeOperationError> | undefined {
  switch (state.status) {
    case "idle":
      return undefined;
    case "loading":
      return state.previous;
    case "settled":
      return state.result.isOk() ? state.result : state.previous;
  }
}

export function visibleValue<T>(state: LoadState<T>): T | undefined {
  const result = visibleResult(state);
  return result !== undefined && result.isOk() ? result.value : undefined;
}

/** The error of the latest settled load, if it failed. */
export function visibleError<T>(
  state: LoadState<T>,
): ForgeOperationError | undefined {
  return state.status === "settled" && state.result.isErr()
    ? state.result.error
    : undefined;
}

/** Loading with nothing to show yet: the first result for this key is pending. */
export function isPending<T>(state: LoadState<T>): boolean {
  return state.status === "loading" && state.previous === undefined;
}

export function isCancelled(error: ForgeOperationError): boolean {
  return ForgeCancelledError.is(error);
}
