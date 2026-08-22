import { FileTree as FileTreeModel, type FileTreeOptions } from "@pierre/trees";
import { onCleanup } from "solid-js";

export interface UseFileTreeResult {
  model: FileTreeModel;
}

// Creates the model exactly once so Solid callers have a stable imperative
// runtime. Later option changes are intentionally ignored; callers must use
// explicit model methods like resetPaths and setComposition.
export function useFileTree(options: FileTreeOptions): UseFileTreeResult {
  const model = new FileTreeModel(options);
  onCleanup(() => {
    model.cleanUp();
  });
  return { model };
}
