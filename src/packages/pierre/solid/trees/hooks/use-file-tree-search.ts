import type { FileTree as FileTreeModel } from "@pierre/trees";
import type { Accessor } from "solid-js";
import { areArraysEqual } from "../utils/arrays";
import { useFileTreeSelector } from "./use-file-tree-selector";

interface FileTreeSearchSnapshot {
  isOpen: boolean;
  matchingPaths: readonly string[];
  value: string;
}

export interface FileTreeSearchState {
  isOpen: Accessor<boolean>;
  matchingPaths: Accessor<readonly string[]>;
  value: Accessor<string>;
  close: () => void;
  focusNextMatch: () => void;
  focusPreviousMatch: () => void;
  open: (initialValue?: string) => void;
  setValue: (value: string | null) => void;
}

function areSearchSnapshotsEqual(
  previous: FileTreeSearchSnapshot,
  next: FileTreeSearchSnapshot,
): boolean {
  return (
    previous.isOpen === next.isOpen &&
    previous.value === next.value &&
    areArraysEqual(previous.matchingPaths, next.matchingPaths)
  );
}

export function useFileTreeSearch(
  getModel: Accessor<FileTreeModel>,
): FileTreeSearchState {
  const snapshot = useFileTreeSelector(
    getModel,
    (currentModel): FileTreeSearchSnapshot => ({
      isOpen: currentModel.isSearchOpen(),
      matchingPaths: currentModel.getSearchMatchingPaths(),
      value: currentModel.getSearchValue(),
    }),
    areSearchSnapshotsEqual,
  );

  return {
    isOpen: () => snapshot().isOpen,
    matchingPaths: () => snapshot().matchingPaths,
    value: () => snapshot().value,
    close: () => {
      getModel().closeSearch();
    },
    focusNextMatch: () => {
      getModel().focusNextSearchMatch();
    },
    focusPreviousMatch: () => {
      getModel().focusPreviousSearchMatch();
    },
    open: (initialValue?: string) => {
      getModel().openSearch(initialValue);
    },
    setValue: (value: string | null) => {
      getModel().setSearch(value);
    },
  };
}
