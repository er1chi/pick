import {
  ForgeOperationErrorCode,
  type ForgeOperationError,
} from "@/services/forge/types";

export interface IdleLoadState {
  readonly status: "idle";
  readonly value: undefined;
  readonly error: undefined;
}

export function idleLoadState(): IdleLoadState {
  return { status: "idle", value: undefined, error: undefined };
}

export function isCancelled(error: ForgeOperationError): boolean {
  return error.code === ForgeOperationErrorCode.Cancelled;
}
