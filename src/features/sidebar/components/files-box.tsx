import { useBindings } from "@opentui/keymap/solid";
import { createEffect, createMemo } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { useLocalRepository } from "@/context/local-repository-context";
import { usePatchStore } from "@/context/patch-store";
import { useViewContext, viewPullRequest } from "@/context/view-context";
import { patchFileIndex } from "@/features/main-view/utils/patch-file-index";
import {
  areVisibleRowsEqual,
  fileTreeRowGuides,
  fileTreeRowLabel,
  fileTreeRowPrefix,
  getAllVisibleRows,
  useFileTree,
  useFileTreeSelector,
} from "@/packages/pierre/solid/trees";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { scopedTitle } from "./sidebar-box";
import { useSidebarList } from "./sidebar-list";

import type {
  FileTree as FileTreeModel,
  FileTreeVisibleRow,
} from "@pierre/trees";
import type { Result } from "better-result";
import type { JSX } from "solid-js";
import type { ForgeSection, PullRequestPatch } from "@/services/forge/types";
import type { GitError, GitFileChange } from "@/services/local/types";

type FilesView =
  | {
      readonly kind: "list";
      readonly paths: readonly string[];
      readonly statuses: ReadonlyMap<string, string>;
    }
  | { readonly kind: "message"; readonly text: string };

const patchStatuses = {
  change: "M",
  new: "A",
  deleted: "D",
  "rename-pure": "R",
  "rename-changed": "R",
};

function statusMarker(status: string | undefined) {
  if (status === undefined) {
    return undefined;
  }
  let color: string = colors.yellow;
  if (status.includes("D") || status.includes("U") || status === "AA") {
    color = colors.red;
  } else if (status.includes("R") || status.includes("C")) {
    color = colors.blue;
  } else if (status.includes("A") || status === "??") {
    color = colors.green;
  }
  return { text: status, color };
}

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
      : {
          kind: "list",
          paths: index.names,
          statuses: new Map(
            index.files.map((file) => [file.name, patchStatuses[file.type]]),
          ),
        };
  }
  return {
    kind: "message",
    text: sectionProblemMessage(section, "changed files"),
  };
}

function localFiles(
  result: Result<readonly GitFileChange[], GitError> | undefined,
): FilesView {
  if (result === undefined) {
    return { kind: "message", text: "Loading changes…" };
  }
  if (result.isErr()) {
    return { kind: "message", text: "Could not read local changes." };
  }
  return result.value.length === 0
    ? { kind: "message", text: "No local changes." }
    : {
        kind: "list",
        paths: result.value.map((file) => file.path),
        statuses: new Map(result.value.map((file) => [file.path, file.status])),
      };
}

function toggleFocusedDirectory(model: FileTreeModel): void {
  const item = model.getFocusedItem();
  if (item !== null && "toggle" in item) {
    item.toggle();
  }
}

function fileRowId(row: FileTreeVisibleRow): string {
  return `file-${row.path}`;
}

interface FilesBoxProps {
  readonly rowWidth: number;
}

export function FilesBox(props: FilesBoxProps): JSX.Element {
  const viewContext = useViewContext();
  const patchStore = usePatchStore();
  const localRepository = useLocalRepository();
  const opened = () => viewPullRequest(viewContext.view());
  const workingTree = () =>
    opened() === undefined && viewContext.view().commit === undefined;
  const title = () => {
    const commit = viewContext.view().commit?.slice(0, 7);
    const number = opened()?.number;
    if (commit === undefined) {
      return scopedTitle(workingTree() ? "[0] Changes" : "[0] Files", number);
    }
    return number === undefined
      ? `[0] Files · ${commit}`
      : `${scopedTitle("[0] Files", number)} · ${commit}`;
  };
  const localFilesView = createMemo(() =>
    localFiles(localRepository.changedFiles()),
  );
  const filesView = createMemo<FilesView>(() => {
    if (workingTree()) {
      return localFilesView();
    }
    return changedFiles(patchStore.currentPatch());
  });
  const paths = createMemo(() => {
    const view = filesView();
    return view.kind === "list" ? view.paths : [];
  }, []);
  const emptyText = () => {
    const view = filesView();
    return view.kind === "message" ? view.text : "No changed files.";
  };
  const fileMarker = (path: string) => {
    const view = filesView();
    return view.kind === "list"
      ? statusMarker(view.statuses.get(path))
      : undefined;
  };

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
  const list = useSidebarList({
    pane: Pane.Files,
    items: rows,
    rowId: fileRowId,
  });

  createEffect(() => {
    const focused = rows().findIndex((row) => row.isFocused);
    if (focused >= 0) {
      list.setIndex(focused);
    }
  });

  createEffect(() => {
    const next = list.highlighted();
    if (next !== undefined && !next.isFocused) {
      model.focusPath(next.path);
    }
  });

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
    list.focus(Pane.Main);
  }

  useBindings(() => ({
    target: list.target,
    bindings: [
      { key: "return", cmd: activateFocusedItem },
      { key: "right", cmd: () => toggleFocusedDirectory(model) },
      { key: "left", cmd: () => model.focusParentItem() },
    ],
  }));
  return (
    <list.Box title={title()} flexGrow={1}>
      <list.Rows emptyText={emptyText()}>
        {(row) => (
          <SelectableRow
            id={fileRowId(row())}
            selected={row().isFocused}
            guide={fileTreeRowGuides(row())}
            label={`${fileTreeRowPrefix(row())}${fileTreeRowLabel(row())}`}
            marker={fileMarker(row().path)}
            maxWidth={props.rowWidth}
          />
        )}
      </list.Rows>
    </list.Box>
  );
}
