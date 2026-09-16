import type { ForgeContextError } from "@/context/app-context";
import { ForgeOperationErrorCode } from "@/services/forge/types";

export interface IdleLoadState {
  readonly status: "idle";
  readonly value: undefined;
  readonly error: undefined;
}

export function idleLoadState(): IdleLoadState {
  return { status: "idle", value: undefined, error: undefined };
}

export function isCancelled(error: ForgeContextError): boolean {
  return error.code === ForgeOperationErrorCode.Cancelled;
}
