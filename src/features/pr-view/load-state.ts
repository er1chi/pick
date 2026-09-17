import {
  ForgeOperationErrorCode,
  type ForgeOperationError,
} from "@/services/forge/types";

export interface IdleLoadState {
  readonly status: "idle";
  readonly value: undefined;
  readonly error: undefined;
}

export type LoadState<T> =
  | IdleLoadState
  | {
      readonly status: "loading";
      readonly value: T | undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "ready";
      readonly value: T;
      readonly error: undefined;
    }
  | {
      readonly status: "error";
      readonly value: T | undefined;
      readonly error: ForgeOperationError;
    };

export function idleLoadState(): IdleLoadState {
  return { status: "idle", value: undefined, error: undefined };
}

export function isCancelled(error: ForgeOperationError): boolean {
  return error.code === ForgeOperationErrorCode.Cancelled;
}
