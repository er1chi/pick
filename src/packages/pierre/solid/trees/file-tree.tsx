import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createSignal, type JSX } from "solid-js";
import { colors } from "@/theme";
import { FileTreeRow } from "./file-tree-row";
import { useFileTreeSearch } from "./hooks/use-file-tree-search";
import { useFileTreeSelector } from "./hooks/use-file-tree-selector";
import { areVisibleRowsEqual, getAllVisibleRows } from "./utils/visible-rows";

import type { BoxRenderable, InputRenderable } from "@opentui/core";
import type {
  FileTree as FileTreeModel,
  FileTreeDirectoryHandle,
  FileTreeItemHandle,
  FileTreeVisibleRow,
} from "@pierre/trees";

export interface FileTreeProps {
  header?: JSX.Element;
  model: FileTreeModel;
  onActivate?: (row: FileTreeVisibleRow) => void;
  children?: (row: FileTreeVisibleRow) => JSX.Element;
}

function directoryHandle(
  item: FileTreeItemHandle | null,
): FileTreeDirectoryHandle | null {
  if (item == null || !("toggle" in item)) {
    return null;
  }
  return item;
}

function activateFocusedRow(
  model: FileTreeModel,
  onActivate: FileTreeProps["onActivate"],
): void {
  const focused = directoryHandle(model.getFocusedItem());
  if (focused != null) {
    focused.toggle();
    return;
  }

  const index = model.getFocusedIndex();
  if (index < 0) {
    return;
  }

  const row = model.getVisibleRows(index, index)[0];
  if (row != null) {
    onActivate?.(row);
  }
}

function moveFocusRight(model: FileTreeModel): void {
  const focused = directoryHandle(model.getFocusedItem());
  if (focused == null || focused.isExpanded()) {
    model.focusNextItem();
    return;
  }
  focused.expand();
}

function moveFocusLeft(model: FileTreeModel): void {
  const focused = directoryHandle(model.getFocusedItem());
  if (focused != null && focused.isExpanded()) {
    focused.collapse();
    return;
  }
  model.focusParentItem();
}

export function FileTree(props: FileTreeProps) {
  const [treeBox, setTreeBox] = createSignal<BoxRenderable | undefined>();
  const [searchInput, setSearchInput] = createSignal<
    InputRenderable | undefined
  >();
  const search = useFileTreeSearch(() => props.model);
  const rows = useFileTreeSelector(
    () => props.model,
    getAllVisibleRows,
    areVisibleRowsEqual,
  );

  useBindings(() => ({
    target: treeBox,
    bindings: [
      {
        key: "up",
        cmd: () => {
          if (search.isOpen()) {
            search.focusPreviousMatch();
            return;
          }
          props.model.focusPreviousItem();
        },
      },
      {
        key: "down",
        cmd: () => {
          if (search.isOpen()) {
            search.focusNextMatch();
            return;
          }
          props.model.focusNextItem();
        },
      },
      {
        key: "left",
        cmd: () => {
          if (!search.isOpen()) {
            moveFocusLeft(props.model);
          }
        },
      },
      {
        key: "right",
        cmd: () => {
          if (!search.isOpen()) {
            moveFocusRight(props.model);
          }
        },
      },
      {
        key: "home",
        cmd: () => {
          if (!search.isOpen()) {
            props.model.focusFirstItem();
          }
        },
      },
      {
        key: "end",
        cmd: () => {
          if (!search.isOpen()) {
            props.model.focusLastItem();
          }
        },
      },
      {
        key: "return",
        cmd: () => {
          if (search.isOpen()) {
            search.close();
            return;
          }
          activateFocusedRow(props.model, props.onActivate);
        },
      },
      {
        key: "space",
        cmd: () => {
          if (!search.isOpen()) {
            props.model.getFocusedItem()?.toggleSelect();
          }
        },
      },
      {
        key: "/",
        cmd: () => {
          if (!search.isOpen()) {
            search.open();
            searchInput()?.focus();
          }
        },
      },
      {
        key: "escape",
        cmd: () => {
          if (search.isOpen()) {
            search.close();
            treeBox()?.focus();
          }
        },
      },
    ],
  }));

  useBindings(() => ({
    target: treeBox,
    enabled: () => !search.isOpen(),
    bindings: [
      {
        key: "k",
        cmd: () => {
          props.model.focusPreviousItem();
        },
      },
      {
        key: "j",
        cmd: () => {
          props.model.focusNextItem();
        },
      },
      {
        key: "h",
        cmd: () => {
          moveFocusLeft(props.model);
        },
      },
      {
        key: "l",
        cmd: () => {
          moveFocusRight(props.model);
        },
      },
      {
        key: "gg",
        cmd: () => {
          props.model.focusFirstItem();
        },
      },
      {
        key: "shift+g",
        cmd: () => {
          props.model.focusLastItem();
        },
      },
    ],
  }));

  const renderRow = (row: FileTreeVisibleRow): JSX.Element => {
    const render = props.children;
    if (render == null) {
      return <FileTreeRow row={row} />;
    }
    return render(row);
  };

  return (
    <box
      ref={setTreeBox}
      flexDirection="column"
      width="100%"
      height="100%"
      focused={!search.isOpen()}
    >
      <Show when={props.header}>{props.header}</Show>
      <Show when={search.isOpen()}>
        <input
          ref={setSearchInput}
          focused
          value={search.value()}
          placeholder="Search files"
          backgroundColor={colors.selected}
          onInput={(value) => {
            search.setValue(value);
          }}
          onSubmit={() => {
            search.close();
            treeBox()?.focus();
          }}
        />
      </Show>
      <scrollbox flexGrow={1} stickyScroll stickyStart="top">
        <For each={rows()}>{renderRow}</For>
      </scrollbox>
    </box>
  );
}
