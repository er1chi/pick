import { useBindings } from "@opentui/keymap/solid";
import { For, createEffect, createMemo } from "solid-js";
import { requestPaneFocus } from "@/context/active-pane-context";
import { visibleError, visibleValue } from "@/features/pr-view/load-state";
import { patchFileIndex } from "@/features/pr-view/patch-file-index";
import { SelectableRow } from "@/features/shared/selectable-row";
import {
  EmptyGate,
  SidebarBox,
  SidebarScrollBox,
  useFocusWhenActive,
  useScrollIntoView,
  useSidebarPane,
  type SidebarPaneProps,
} from "@/features/sidebar/sidebar-box";
import {
  areVisibleRowsEqual,
  fileTreeRowLabel,
  fileTreeRowPrefix,
  getAllVisibleRows,
  useFileTree,
  useFileTreeSelector,
} from "@/packages/pierre/solid/trees";

import type { FileTree as FileTreeModel } from "@pierre/trees";
import type { JSX } from "solid-js";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import type { ForgeSection } from "@/services/forge/types";

type FilesView =
  | { readonly kind: "list"; readonly paths: readonly string[] }
  | { readonly kind: "message"; readonly text: string };

type SectionProblem = Exclude<ForgeSection<unknown>, { status: "available" }>;

function sectionProblemMessage(section: SectionProblem, label: string): string {
  switch (section.status) {
    case "unsupported":
      return section.reason.diagnostic;
    case "failed":
      return `Could not load ${label}: ${section.error.message}`;
    case "not-requested":
      return `${label} are not available.`;
  }
}

// The tree is rebuilt from whichever patch is current: the selected commit's
// patch when a commit is active, otherwise the pull request diff patch.
function changedFiles(content: PrViewContent): FilesView {
  const state = content.currentPatch();
  const error = visibleError(state);
  if (error !== undefined) {
    return {
      kind: "message",
      text: `Could not load changed files: ${error.message}`,
    };
  }
  const section = visibleValue(state);
  if (section === undefined) {
    return { kind: "message", text: "Loading changed files…" };
  }
  if (section.status === "available") {
    const paths = patchFileIndex(section).files.map((file) => file.name);
    return paths.length === 0
      ? { kind: "message", text: "No changed files." }
      : { kind: "list", paths };
  }
  return {
    kind: "message",
    text: sectionProblemMessage(section, "changed files"),
  };
}

function toggleFocusedDirectory(model: FileTreeModel): void {
  const item = model.getFocusedItem();
  if (item !== null && "toggle" in item) {
    item.toggle();
  }
}

export function FilesBox(props: SidebarPaneProps): JSX.Element {
  const { pane, setPane, box, setBox, scrollBox, setScrollBox, focused } =
    useSidebarPane("files");
  const opened = () => props.titles.openedNumber() !== null;
  const filesView = createMemo<FilesView>(() => {
    if (!opened()) {
      return { kind: "list", paths: [] };
    }
    return changedFiles(props.content);
  });
  const paths = createMemo(() => {
    const view = filesView();
    return view.kind === "list" ? view.paths : [];
  });
  const emptyText = () => {
    const view = filesView();
    return view.kind === "message" ? view.text : "No changed files.";
  };

  // The model owns path grouping: empty directories stay as separate rows
  // (no single-child flattening) and the initial expansion is explicit so the
  // nested hierarchy comes from @pierre/trees rather than string parsing.
  const { model } = useFileTree({
    flattenEmptyDirectories: false,
    initialExpansion: "closed",
    paths: paths(),
  });
  createEffect(() => model.resetPaths(paths()));

  const rows = useFileTreeSelector(
    () => model,
    getAllVisibleRows,
    areVisibleRowsEqual,
  );

  // Keep a keyboard anchor without selecting it: opening a PR must not default
  // the content selection to the first file.
  createEffect(() => {
    if (!opened() || rows().length === 0 || model.getFocusedItem() !== null) {
      return;
    }
    model.focusFirstItem();
  });

  // Tree navigation only moves the keyboard highlight. It never selects a file
  // or changes panes, so the main view keeps its previously selected context.
  function moveFocus(offset: number): void {
    if (model.getFocusedItem() === null) {
      if (offset > 0) {
        model.focusFirstItem();
      } else {
        model.focusLastItem();
      }
    } else if (offset > 0) {
      model.focusNextItem();
    } else {
      model.focusPreviousItem();
    }
  }

  // Enter is the explicit activation: a directory expands/collapses in place,
  // while a file is selected and hands focus to the main view.
  function activateFocusedItem(): void {
    const item = model.getFocusedItem();
    if (item === null) {
      return;
    }
    if ("toggle" in item) {
      item.toggle();
      return;
    }
    props.content.selectFile(item.getPath());
    requestPaneFocus(pane, setPane, "content");
  }

  // Follow the keyboard highlight rather than the content selection, so moving
  // through the tree scrolls the focused row into view without opening it.
  useScrollIntoView(() => {
    const focusedRow = rows().find((row) => row.isFocused);
    return focusedRow === undefined ? undefined : `file-${focusedRow.path}`;
  }, scrollBox);

  useFocusWhenActive(focused, () => pane.focusRequest, box);

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "j", cmd: () => moveFocus(1) },
      { key: "down", cmd: () => moveFocus(1) },
      { key: "k", cmd: () => moveFocus(-1) },
      { key: "up", cmd: () => moveFocus(-1) },
      { key: "return", cmd: activateFocusedItem },
      { key: "right", cmd: () => toggleFocusedDirectory(model) },
      { key: "left", cmd: () => model.focusParentItem() },
    ],
  }));

  return (
    <SidebarBox title="[0] Files" active={focused()} boxRef={setBox}>
      <EmptyGate
        opened={opened()}
        hasItems={rows().length > 0}
        emptyText={emptyText()}
      >
        <SidebarScrollBox scrollRef={setScrollBox} hideScrollbar>
          <For each={rows()}>
            {(row) => (
              <SelectableRow
                id={`file-${row.path}`}
                selected={row.isFocused}
                label={`${fileTreeRowPrefix(row)}${fileTreeRowLabel(row)}`}
                maxWidth={props.rowWidth}
              />
            )}
          </For>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}
