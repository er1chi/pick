export function isJsonObject(cause: unknown): cause is object {
  return cause !== null && Object(cause) === cause && !Array.isArray(cause);
}

export function isString(cause: unknown): cause is string {
  return (
    Object.prototype.toString.call(cause) === "[object String]" &&
    Object(cause) !== cause
  );
}

export function isNullableString(cause: unknown): cause is string | null {
  return cause === null || isString(cause);
}

export function isInteger(cause: unknown): cause is number {
  return Number.isInteger(cause);
}

export function isStableProviderId(cause: unknown): cause is string | number {
  return isString(cause) || Number.isSafeInteger(cause);
}

export function toIsoTimestamp(cause: unknown): string | undefined {
  if (!isString(cause)) {
    return undefined;
  }
  const milliseconds = Date.parse(cause);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : undefined;
}
