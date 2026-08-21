import type {
  FileTree as FileTreeModel,
  FileTreeVisibleRow,
} from "@pierre/trees";
import { areArrayItemsEqual } from "./arrays";

export function getAllVisibleRows(
  model: FileTreeModel,
): readonly FileTreeVisibleRow[] {
  const count = model.getVisibleCount();
  if (count === 0) {
    return [];
  }
  return model.getVisibleRows(0, count - 1);
}

function areVisibleRowFieldsEqual(
  previous: FileTreeVisibleRow,
  next: FileTreeVisibleRow,
): boolean {
  return (
    previous.path === next.path &&
    previous.depth === next.depth &&
    previous.isExpanded === next.isExpanded &&
    previous.isFocused === next.isFocused &&
    previous.isSelected === next.isSelected &&
    previous.kind === next.kind &&
    previous.name === next.name
  );
}

export function areVisibleRowsEqual(
  previous: readonly FileTreeVisibleRow[],
  next: readonly FileTreeVisibleRow[],
): boolean {
  return areArrayItemsEqual(previous, next, areVisibleRowFieldsEqual);
}
