export { FileTree, type FileTreeProps } from "./file-tree";
export { FileTreeRow } from "./file-tree-row";
export { useFileTree, type UseFileTreeResult } from "./hooks/use-file-tree";
export {
  useFileTreeSearch,
  type FileTreeSearchState,
} from "./hooks/use-file-tree-search";
export {
  useFileTreeSelector,
  type FileTreeSelector,
  type FileTreeSelectorEquality,
} from "./hooks/use-file-tree-selector";
export { useFileTreeSelection } from "./hooks/use-file-tree-selection";
export { areArraysEqual } from "./utils/arrays";
export type { FileTree as FileTreeModel } from "@pierre/trees";
