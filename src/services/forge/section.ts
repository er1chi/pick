import type { Result } from "better-result";
import type { ForgeOperationError, ForgeSection } from "./types";

export function available<T>(value: T, truncated = false): ForgeSection<T> {
  return { status: "available", value, truncated };
}

export function unsupported<T>(diagnostic: string): ForgeSection<T> {
  return { status: "unsupported", reason: { diagnostic } };
}

export function failed<T>(error: ForgeOperationError): ForgeSection<T> {
  return { status: "failed", error };
}

export function sectionFromResult<T>(
  result: Result<T, ForgeOperationError>,
): ForgeSection<T> {
  return result.isOk() ? available(result.value) : failed(result.error);
}
