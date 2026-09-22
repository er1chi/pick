import { useBindings } from "@opentui/keymap/solid";
import { Index, createEffect, createMemo, createSignal } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { useViewContext } from "@/context/view-context";
import { patchFileIndex } from "@/features/main-view/utils/patch-file-index";
import {
  areVisibleRowsEqual,
  fileTreeRowLabel,
  fileTreeRowPrefix,
  getAllVisibleRows,
  useFileTree,
  useFileTreeSelector,
} from "@/packages/pierre/solid/trees";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { Pane } from "@/types";
import { EmptyGate } from "./empty-gate";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { FileTree as FileTreeModel } from "@pierre/trees";
import type { JSX } from "solid-js";
import type { ForgeSection, PullRequestPatch } from "@/services/forge/types";
import type { SidebarPaneProps } from "../types";

type FilesView =
  | { readonly kind: "list"; readonly paths: readonly string[] }
  | { readonly kind: "message"; readonly text: string };

type SectionProblem = Exclude<ForgeSection<unknown>, { status: "available" }>;

function sectionProblemMessage(section: SectionProblem, label: string): string {
  switch (section.status) {
    case "unsupported":
      return section.reason;
    case "failed":
      return `Could not load ${label}: ${section.error.message}`;
  }
}

function changedFiles(
  section: ForgeSection<PullRequestPatch> | undefined,
): FilesView {
  if (section === undefined) {
    return { kind: "message", text: "loading..." };
  }
  if (section.status === "available") {
    // The index caches the names array so repeated memo runs keep the same
    // array identity and consumers depending on it (e.g. resetPaths) don't
    // re-fire when only the selection changes.
    const index = patchFileIndex(section);
    return index.names.length === 0
      ? { kind: "message", text: "No changed files." }
      : { kind: "list", paths: index.names };
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
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(Pane.Files);
  const viewContext = useViewContext();
  const opened = () => viewContext.view() !== undefined;
  const filesView = createMemo<FilesView>(() => {
    if (!opened()) {
      return { kind: "list", paths: [] };
    }
    return changedFiles(viewContext.currentPatch());
  });
  const paths = createMemo(() => {
    const view = filesView();
    return view.kind === "list" ? view.paths : [];
  }, []);
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
  const navigation = useNavigateList({ target: box });

  createEffect(() => navigation.setCount(rows().length));

  createEffect(() => {
    const focused = rows().findIndex((row) => row.isFocused);
    if (focused >= 0) {
      navigation.setIndex(focused);
    }
  });

  createEffect(() => {
    const next = rows()[navigation.index()];
    if (next !== undefined && !next.isFocused) {
      model.focusPath(next.path);
    }
  });

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
    viewContext.selectFile(item.getPath());
    setPane({ active: Pane.Main });
  }

  // Follow the keyboard highlight rather than the content selection, so moving
  // through the tree scrolls the focused row into view without opening it.
  useScrollIntoView(() => {
    const focusedRow = rows().find((row) => row.isFocused);
    return focusedRow === undefined ? undefined : `file-${focusedRow.path}`;
  }, scrollBox);

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "return", cmd: activateFocusedItem },
      { key: "right", cmd: () => toggleFocusedDirectory(model) },
      { key: "left", cmd: () => model.focusParentItem() },
    ],
  }));
  function handleMouseFocus() {
    setPane({ active: Pane.Files });
  }

  return (
    <SidebarBox
      id={Pane.Files}
      title="[0] Files"
      active={isFocused()}
      boxRef={setBox}
      flexGrow={1}
      handleMouseFocus={handleMouseFocus}
    >
      <EmptyGate
        opened={opened()}
        hasItems={rows().length > 0}
        emptyText={emptyText()}
      >
        <SidebarScrollBox scrollRef={setScrollBox} hideScrollbar>
          <Index each={rows()}>
            {(row) => (
              <SelectableRow
                id={`file-${row().path}`}
                selected={row().isFocused}
                label={`${fileTreeRowPrefix(row())}${fileTreeRowLabel(row())}`}
                maxWidth={props.rowWidth}
              />
            )}
          </Index>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}
