export function wrapIndex(index: number, length: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError("length must be a positive integer");
  }

  return ((index % length) + length) % length;
}

export function moveInList<T>(
  items: readonly T[],
  current: T,
  offset: number,
): T {
  if (items.length === 0) {
    throw new RangeError("items must not be empty");
  }

  const currentIndex = items.indexOf(current);
  const startIndex = currentIndex === -1 ? 0 : currentIndex;
  return items[wrapIndex(startIndex + offset, items.length)]!;
}
