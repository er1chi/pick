import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import { parsePatchFiles } from "@pierre/diffs";
import type { FileTree as FileTreeModel } from "@pierre/trees";
import { PaneStore } from "@/context/active-pane-context";
import { SelectableRow } from "@/features/shared/selectable-row";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import {
  areVisibleRowsEqual,
  fileTreeRowLabel,
  fileTreeRowPrefix,
  getAllVisibleRows,
  useFileTree,
  useFileTreeSelector,
} from "@/packages/pierre/solid/trees";
import type {
  ForgeOperationError,
  ForgeSection,
  PullRequestCommit,
  PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { JSX, Setter } from "solid-js";

const SIDEBAR_WIDTH = 32;
// The sidebar border consumes one column on each side.
const SIDEBAR_ROW_WIDTH = SIDEBAR_WIDTH - 2;

export interface SidebarProps {
  readonly titles: PrTitles;
  readonly content: PrViewContent;
}

function listItems(titles: PrTitles): readonly PullRequestSummary[] {
  return titles.list().value?.items ?? [];
}

function errorDescription(error: ForgeOperationError): string {
  return error.diagnostic;
}

function listError(titles: PrTitles): string | undefined {
  const state = titles.list();
  return state.status === "error" ? errorDescription(state.error) : undefined;
}

function listIsTruncated(titles: PrTitles): boolean {
  const state = titles.list();
  return state.status === "ready" && state.value.truncated;
}

function listIsPending(titles: PrTitles): boolean {
  const state = titles.list();
  return state.status === "loading" && state.value === undefined;
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((candidate) => candidate.trim() !== "");
  return line?.trim() ?? text;
}

type FilesView =
  | { readonly kind: "list"; readonly paths: readonly string[] }
  | { readonly kind: "message"; readonly text: string };

type SectionProblem = Exclude<ForgeSection<unknown>, { status: "available" }>;

function sectionProblemMessage(section: SectionProblem, label: string): string {
  switch (section.status) {
    case "unsupported":
      return section.reason.diagnostic;
    case "failed":
      return `Could not load ${label}: ${errorDescription(section.error)}`;
    case "not-requested":
      return `${label} are not available.`;
  }
}

// When a commit is selected the Files box shows only that commit's patch, so
// the tree is rebuilt from the patch text rather than the PR-level file list.
function commitPatchFiles(content: PrViewContent): FilesView {
  const state = content.commitPatch();
  if (state.status === "idle" || state.status === "loading") {
    return { kind: "message", text: "Loading commit files…" };
  }
  if (state.status === "error") {
    return {
      kind: "message",
      text: `Could not load commit files: ${errorDescription(state.error)}`,
    };
  }
  const section = state.value;
  if (section.status === "available") {
    const paths = parsePatchFiles(section.value.text)
      .flatMap((entry) => entry.files)
      .map((file) => file.name);
    return paths.length === 0
      ? { kind: "message", text: "This commit has no changed files." }
      : { kind: "list", paths };
  }
  return {
    kind: "message",
    text: sectionProblemMessage(section, "commit files"),
  };
}

function pullRequestFiles(content: PrViewContent): FilesView {
  const state = content.diffState();
  if (state.status === "idle" || state.status === "loading") {
    return { kind: "message", text: "Loading changed files…" };
  }
  if (state.status === "error") {
    return {
      kind: "message",
      text: `Could not load changed files: ${errorDescription(state.error)}`,
    };
  }
  const section = state.value.files;
  if (section.status === "available") {
    const paths = section.value.map((file) => file.path);
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

interface SidebarBoxProps {
  readonly title: string;
  readonly active: boolean;
  readonly boxRef: Setter<BoxRenderable | undefined>;
  readonly grow?: number;
  readonly height?: number;
  readonly children: JSX.Element;
}

function SidebarBox(props: SidebarBoxProps): JSX.Element {
  return (
    <box
      ref={props.boxRef}
      focusable
      focused={props.active}
      flexDirection="column"
      flexGrow={props.grow ?? 1}
      flexShrink={1}
      minHeight={0}
      height={props.height}
      width="100%"
      overflow="hidden"
      border
      borderColor={colors.border}
      focusedBorderColor={colors.blue}
      title={props.title}
    >
      {props.children}
    </box>
  );
}

interface SidebarScrollBoxProps {
  readonly scrollRef: Setter<ScrollBoxRenderable | undefined>;
  readonly children: JSX.Element;
}

function SidebarScrollBox(props: SidebarScrollBoxProps): JSX.Element {
  return (
    <scrollbox
      ref={props.scrollRef}
      width="100%"
      flexGrow={1}
      minHeight={0}
      stickyScroll
      stickyStart="top"
    >
      {props.children}
    </scrollbox>
  );
}

interface EmptyGateProps {
  readonly opened: boolean;
  readonly hasItems: boolean;
  readonly emptyText: string;
  readonly children: JSX.Element;
}

function EmptyGate(props: EmptyGateProps): JSX.Element {
  return (
    <Show
      when={props.opened}
      fallback={<text fg={colors.muted}>No pull request opened.</text>}
    >
      <Show
        when={props.hasItems}
        fallback={<text fg={colors.muted}>{props.emptyText}</text>}
      >
        {props.children}
      </Show>
    </Show>
  );
}

function useFocusWhenActive(
  active: () => boolean,
  target: () => BoxRenderable | undefined,
): void {
  createEffect(() => {
    if (active()) {
      target()?.focus();
    }
  });
}

function useScrollIntoView(
  identify: () => string | undefined,
  scrollBox: () => ScrollBoxRenderable | undefined,
): void {
  createEffect(() => {
    const id = identify();
    if (id !== undefined) {
      scrollBox()?.scrollChildIntoView(id);
    }
  });
}

function FilesBox(props: SidebarProps): JSX.Element {
  const [pane] = PaneStore.use();
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const focused = () => pane.active === "files";
  const opened = () => props.titles.openedNumber() !== null;
  const filesView = createMemo<FilesView>(() => {
    if (!opened()) {
      return { kind: "list", paths: [] };
    }
    return props.content.selectedCommit() === undefined
      ? pullRequestFiles(props.content)
      : commitPatchFiles(props.content);
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

  function focusedFilePath(): string | undefined {
    const item = model.getFocusedItem();
    return item !== null && !item.isDirectory() ? item.getPath() : undefined;
  }

  function selectFocusedFile(): void {
    const path = focusedFilePath();
    if (path !== undefined) {
      props.content.selectFile(path);
    }
  }

  // Opening a PR must not default to the first file, so selection only happens
  // on explicit navigation. The first move also selects whatever file is
  // already focused after the content selection was cleared.
  function moveFocus(offset: number): void {
    const focusedFile = focusedFilePath();
    if (
      props.content.selectedFile() === undefined &&
      focusedFile !== undefined
    ) {
      props.content.selectFile(focusedFile);
      return;
    }
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
    selectFocusedFile();
  }

  useScrollIntoView(() => {
    const path = props.content.selectedFile();
    return path === undefined ? undefined : `file-${path}`;
  }, scrollBox);

  useFocusWhenActive(focused, box);

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "j", cmd: () => moveFocus(1) },
      { key: "down", cmd: () => moveFocus(1) },
      { key: "k", cmd: () => moveFocus(-1) },
      { key: "up", cmd: () => moveFocus(-1) },
      { key: "return", cmd: () => toggleFocusedDirectory(model) },
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
        <SidebarScrollBox scrollRef={setScrollBox}>
          <For each={rows()}>
            {(row) => (
              <SelectableRow
                id={`file-${row.path}`}
                selected={row.isFocused}
                label={`${fileTreeRowPrefix(row)}${fileTreeRowLabel(row)}`}
                maxWidth={SIDEBAR_ROW_WIDTH}
              />
            )}
          </For>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}

function PullRequestsBox(props: SidebarProps): JSX.Element {
  const [pane] = PaneStore.use();
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const focused = () => pane.active === "pull-requests";

  useBindings(() => ({
    target: box,
    commands: [
      {
        name: "pr-list.move-up",
        run: () => props.titles.moveHighlight(-1),
      },
      {
        name: "pr-list.move-down",
        run: () => props.titles.moveHighlight(1),
      },
      {
        name: "pr-list.filter-open",
        run: () => props.titles.setFilter("open"),
      },
      {
        name: "pr-list.filter-closed",
        run: () => props.titles.setFilter("closed"),
      },
      {
        name: "pr-list.filter-all",
        run: () => props.titles.setFilter("all"),
      },
      {
        name: "pr-list.filter-previous",
        run: () => props.titles.cycleFilter(-1),
      },
      {
        name: "pr-list.filter-next",
        run: () => props.titles.cycleFilter(1),
      },
      {
        name: "pr-list.retry",
        run: () => props.titles.retry(),
      },
      {
        name: "pr-list.open",
        run: () => {
          // Reopening, even the same PR, starts from a cleared selection so
          // the main view returns to the PR-level context.
          props.content.clearSelection();
          props.titles.openHighlighted();
        },
      },
      {
        name: "pr-list.close",
        run: () => props.titles.closeOpened(),
      },
    ],
    bindings: [
      { key: "k", cmd: "pr-list.move-up" },
      { key: "up", cmd: "pr-list.move-up" },
      { key: "j", cmd: "pr-list.move-down" },
      { key: "down", cmd: "pr-list.move-down" },
      { key: "o", cmd: "pr-list.filter-open" },
      { key: "c", cmd: "pr-list.filter-closed" },
      { key: "a", cmd: "pr-list.filter-all" },
      { key: "[", cmd: "pr-list.filter-previous" },
      { key: "]", cmd: "pr-list.filter-next" },
      { key: "R", cmd: "pr-list.retry" },
      { key: "return", cmd: "pr-list.open" },
      { key: "x", cmd: "pr-list.close" },
    ],
  }));

  useScrollIntoView(() => {
    const number = props.titles.highlightedNumber();
    return number === null ? undefined : `pull-request-${number}`;
  }, scrollBox);

  useFocusWhenActive(focused, box);

  // The box is content-sized so it never claims an equal flex share. Rows are
  // counted here so the scrollbox still has a definite height to scroll in
  // when a constrained terminal forces the box to shrink.
  function bodyRowCount(): number {
    if (listIsPending(props.titles)) {
      return 1;
    }
    if (listError(props.titles) !== undefined) {
      return 3;
    }
    const count = listItems(props.titles).length;
    if (count === 0) {
      return 1;
    }
    return count + (listIsTruncated(props.titles) ? 1 : 0);
  }

  return (
    <SidebarBox
      title="[2] Pull Requests"
      active={focused()}
      boxRef={setBox}
      grow={0}
      height={3 + bodyRowCount()}
    >
      <box flexDirection="row" gap={1} paddingLeft={1} paddingRight={1}>
        <text fg={props.titles.filter() === "open" ? colors.blue : colors.dim}>
          <strong>[O]pen</strong>
        </text>
        <text
          fg={props.titles.filter() === "closed" ? colors.blue : colors.dim}
        >
          <strong>[C]losed</strong>
        </text>
        <text fg={props.titles.filter() === "all" ? colors.blue : colors.dim}>
          <strong>[A]ll</strong>
        </text>
      </box>
      <Show
        when={!listIsPending(props.titles)}
        fallback={
          <text fg={colors.muted} wrapMode="none">
            Loading pull requests…
          </text>
        }
      >
        <Show
          when={listError(props.titles) === undefined}
          fallback={
            <box flexDirection="column" paddingLeft={1} paddingRight={1}>
              <text fg={colors.yellow} wrapMode="none">
                Could not load pull requests.
              </text>
              <text fg={colors.dim} wrapMode="none">
                {listError(props.titles)}
              </text>
              <text fg={colors.muted} wrapMode="none">
                Press R to retry.
              </text>
            </box>
          }
        >
          <Show
            when={listItems(props.titles).length > 0}
            fallback={
              <text fg={colors.muted} wrapMode="none">
                No pull requests found for this repository.
              </text>
            }
          >
            <SidebarScrollBox scrollRef={setScrollBox}>
              <For each={listItems(props.titles)}>
                {(summary) => (
                  <SelectableRow
                    id={`pull-request-${summary.number}`}
                    selected={
                      summary.number === props.titles.highlightedNumber()
                    }
                    label={`#${summary.number}`}
                    detail={firstLine(summary.title)}
                    maxWidth={SIDEBAR_ROW_WIDTH}
                  />
                )}
              </For>
              <Show when={listIsTruncated(props.titles)}>
                <text fg={colors.dim} wrapMode="none">
                  More pull requests are available.
                </text>
              </Show>
            </SidebarScrollBox>
          </Show>
        </Show>
      </Show>
    </SidebarBox>
  );
}

function CommitsBox(props: SidebarProps): JSX.Element {
  const [pane] = PaneStore.use();
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  // Keyboard focus inside the list is local and never activates the commit on
  // its own; `content.selectedCommit` only changes on an explicit Enter.
  const [highlightedSha, setHighlightedSha] = createSignal<string>();
  const focused = () => pane.active === "commits";
  const opened = () => props.titles.openedNumber() !== null;
  const commits = createMemo<readonly PullRequestCommit[]>(() =>
    opened() ? props.content.commits() : [],
  );

  // Keep exactly one row highlighted: start on the first row without selecting
  // it, and recover when the list changes or drops the highlighted commit.
  createEffect(() => {
    const list = commits();
    const current = highlightedSha();
    if (list.length === 0) {
      if (current !== undefined) {
        setHighlightedSha(undefined);
      }
      return;
    }
    if (!list.some((commit) => commit.sha === current)) {
      setHighlightedSha(list[0]?.sha);
    }
  });

  useScrollIntoView(() => {
    const sha = highlightedSha();
    return sha === undefined ? undefined : `commit-${sha}`;
  }, scrollBox);

  function moveHighlight(offset: number): void {
    const list = commits();
    if (list.length === 0) {
      return;
    }
    const index = list.findIndex((commit) => commit.sha === highlightedSha());
    const next = Math.min(
      Math.max((index < 0 ? 0 : index) + offset, 0),
      list.length - 1,
    );
    setHighlightedSha(list[next]?.sha);
  }

  function activateHighlighted(): void {
    const sha = highlightedSha();
    if (sha !== undefined) {
      props.content.selectCommit(sha);
    }
  }

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "j", cmd: () => moveHighlight(1) },
      { key: "down", cmd: () => moveHighlight(1) },
      { key: "k", cmd: () => moveHighlight(-1) },
      { key: "up", cmd: () => moveHighlight(-1) },
      { key: "return", cmd: activateHighlighted },
    ],
  }));

  useFocusWhenActive(focused, box);

  return (
    <SidebarBox title="[1] Commits" active={focused()} boxRef={setBox}>
      <EmptyGate
        opened={opened()}
        hasItems={commits().length > 0}
        emptyText="No commits."
      >
        <SidebarScrollBox scrollRef={setScrollBox}>
          <For each={commits()}>
            {(commit) => {
              const highlighted = commit.sha === highlightedSha();
              const active = commit.sha === props.content.selectedCommit();
              return (
                <box
                  width="100%"
                  flexShrink={0}
                  backgroundColor={active ? colors.selected : undefined}
                >
                  <SelectableRow
                    id={`commit-${commit.sha}`}
                    selected={highlighted}
                    label={commit.sha.slice(0, 7)}
                    detail={firstLine(commit.message)}
                    maxWidth={SIDEBAR_ROW_WIDTH}
                  />
                </box>
              );
            }}
          </For>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}

export function Sidebar(props: SidebarProps) {
  const [, setPane] = PaneStore.use();

  // Global numeric focus shared by every pane, including the main content.
  useBindings(() => ({
    commands: [
      { name: "pane.files", run: () => setPane({ active: "files" }) },
      { name: "pane.commits", run: () => setPane({ active: "commits" }) },
      {
        name: "pane.pull-requests",
        run: () => setPane({ active: "pull-requests" }),
      },
      { name: "pane.content", run: () => setPane({ active: "content" }) },
    ],
    bindings: [
      { key: "0", cmd: "pane.files" },
      { key: "1", cmd: "pane.commits" },
      { key: "2", cmd: "pane.pull-requests" },
      { key: "3", cmd: "pane.content" },
    ],
  }));

  return (
    <box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      minWidth={SIDEBAR_WIDTH}
      maxWidth={SIDEBAR_WIDTH}
      flexGrow={0}
      flexShrink={0}
      height="100%"
      overflow="hidden"
      gap={0}
    >
      <FilesBox titles={props.titles} content={props.content} />
      <CommitsBox titles={props.titles} content={props.content} />
      <PullRequestsBox titles={props.titles} content={props.content} />
    </box>
  );
}
