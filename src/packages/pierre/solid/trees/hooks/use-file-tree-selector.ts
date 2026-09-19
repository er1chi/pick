import {
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";

import type { FileTree as FileTreeModel } from "@pierre/trees";

export type FileTreeSelector<TSelected> = (model: FileTreeModel) => TSelected;
export type FileTreeSelectorEquality<TSelected> = (
  previous: TSelected,
  next: TSelected,
) => boolean;

function areSelectedValuesEqual<TSelected>(
  previous: TSelected,
  next: TSelected,
  isEqual: FileTreeSelectorEquality<TSelected> | undefined,
): boolean {
  return Object.is(previous, next) || isEqual?.(previous, next) === true;
}

// Bridges the imperative tree model into Solid with a cached selected snapshot.
// Resubscribe when the model identity changes so later option-driven instances
// still push updates through the same accessor.
export function useFileTreeSelector<TSelected>(
  getModel: Accessor<FileTreeModel>,
  selector: FileTreeSelector<TSelected>,
  isEqual?: FileTreeSelectorEquality<TSelected>,
): Accessor<TSelected> {
  const [value, setValue] = createSignal<TSelected>(
    untrack(() => selector(getModel())),
    {
      equals: (previous, next) =>
        areSelectedValuesEqual(previous, next, isEqual),
    },
  );

  createEffect(() => {
    const model = getModel();
    setValue(() => selector(model));
    const unsubscribe = model.subscribe(() => {
      setValue(() => selector(model));
    });
    onCleanup(unsubscribe);
  });

  return value;
}
