export function areArrayItemsEqual<TValue>(
  previous: readonly TValue[],
  next: readonly TValue[],
  isItemEqual: (left: TValue, right: TValue) => boolean,
): boolean {
  if (previous === next) {
    return true;
  }

  if (previous.length !== next.length) {
    return false;
  }

  for (let index = 0; index < previous.length; index += 1) {
    const previousValue = previous[index];
    const nextValue = next[index];
    if (previousValue === undefined || nextValue === undefined) {
      return false;
    }
    if (!isItemEqual(previousValue, nextValue)) {
      return false;
    }
  }

  return true;
}

export function areArraysEqual<TValue>(
  previous: readonly TValue[],
  next: readonly TValue[],
): boolean {
  return areArrayItemsEqual(previous, next, Object.is);
}
