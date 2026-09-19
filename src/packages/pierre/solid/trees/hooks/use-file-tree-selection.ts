import { areArraysEqual } from "../utils/arrays";
import { useFileTreeSelector } from "./use-file-tree-selector";

import type { FileTree as FileTreeModel } from "@pierre/trees";
import type { Accessor } from "solid-js";

export function useFileTreeSelection(
  getModel: Accessor<FileTreeModel>,
): Accessor<readonly string[]> {
  return useFileTreeSelector(
    getModel,
    (currentModel) => currentModel.getSelectedPaths(),
    areArraysEqual,
  );
}
