import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
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
  PullRequestCommit,
  PullRequestFile,
  PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import type { JSX, Setter } from "solid-js";

const SIDEBAR_WIDTH = 32;

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

function diffFiles(content: PrViewContent): readonly PullRequestFile[] {
  const section = content.diff()?.files;
  return section?.status === "available" ? section.value : [];
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
  readonly children: JSX.Element;
}

function SidebarBox(props: SidebarBoxProps): JSX.Element {
  return (
    <box
      ref={props.boxRef}
      focusable
      focused={props.active}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
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
  const files = createMemo(() => (opened() ? diffFiles(props.content) : []));
  const paths = createMemo(() => files().map((file) => file.path));

  const { model } = useFileTree({ paths: paths() });
  createEffect(() => model.resetPaths(paths()));

  const rows = useFileTreeSelector(
    () => model,
    getAllVisibleRows,
    areVisibleRowsEqual,
  );

  createEffect(() => {
    const unsubscribe = model.subscribe(() => {
      if (!opened()) {
        return;
      }
      const item = model.getFocusedItem();
      if (item !== null && !item.isDirectory()) {
        props.content.selectFile(item.getPath());
      }
    });
    onCleanup(unsubscribe);
  });

  createEffect(() => {
    if (!opened() || rows().length === 0) {
      return;
    }
    if (model.getFocusedItem() === null) {
      model.focusFirstItem();
    }
  });

  useScrollIntoView(() => {
    const path = props.content.selectedFile();
    return path === undefined ? undefined : `file-${path}`;
  }, scrollBox);

  useFocusWhenActive(focused, box);

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "j", cmd: () => model.focusNextItem() },
      { key: "down", cmd: () => model.focusNextItem() },
      { key: "k", cmd: () => model.focusPreviousItem() },
      { key: "up", cmd: () => model.focusPreviousItem() },
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
        emptyText="No changed files."
      >
        <SidebarScrollBox scrollRef={setScrollBox}>
          <For each={rows()}>
            {(row) => (
              <SelectableRow
                id={`file-${row.path}`}
                selected={row.isFocused}
                label={`${fileTreeRowPrefix(row)}${fileTreeRowLabel(row)}`}
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
        run: () => props.titles.openHighlighted(),
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

  return (
    <SidebarBox title="[1] Pull Requests" active={focused()} boxRef={setBox}>
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
        fallback={<text fg={colors.muted}>Loading pull requests…</text>}
      >
        <Show
          when={listError(props.titles) === undefined}
          fallback={
            <box flexDirection="column" paddingLeft={1} paddingRight={1}>
              <text fg={colors.yellow}>Could not load pull requests.</text>
              <text fg={colors.dim}>{listError(props.titles)}</text>
              <text fg={colors.muted}>Press R to retry.</text>
            </box>
          }
        >
          <Show
            when={listItems(props.titles).length > 0}
            fallback={
              <text fg={colors.muted}>
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
                  />
                )}
              </For>
              <Show when={listIsTruncated(props.titles)}>
                <text fg={colors.dim}>More pull requests are available.</text>
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
  const focused = () => pane.active === "commits";
  const opened = () => props.titles.openedNumber() !== null;
  const commits = createMemo<readonly PullRequestCommit[]>(() =>
    opened() ? props.content.commits() : [],
  );

  const selectedIndex = createMemo(() => {
    const sha = props.content.selectedCommit();
    const index = commits().findIndex((commit) => commit.sha === sha);
    return index < 0 ? 0 : index;
  });

  createEffect(() => {
    if (!opened()) {
      return;
    }
    const list = commits();
    if (list.length === 0 || props.content.selectedCommit() !== undefined) {
      return;
    }
    props.content.selectCommit(list[0]?.sha);
  });

  useScrollIntoView(() => {
    const sha = props.content.selectedCommit();
    return sha === undefined ? undefined : `commit-${sha}`;
  }, scrollBox);

  function moveSelection(offset: number): void {
    const list = commits();
    if (list.length === 0) {
      return;
    }
    const next = Math.min(
      Math.max(selectedIndex() + offset, 0),
      list.length - 1,
    );
    props.content.selectCommit(list[next]?.sha);
  }

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "j", cmd: () => moveSelection(1) },
      { key: "down", cmd: () => moveSelection(1) },
      { key: "k", cmd: () => moveSelection(-1) },
      { key: "up", cmd: () => moveSelection(-1) },
    ],
  }));

  useFocusWhenActive(focused, box);

  return (
    <SidebarBox title="[2] Commits" active={focused()} boxRef={setBox}>
      <EmptyGate
        opened={opened()}
        hasItems={commits().length > 0}
        emptyText="No commits."
      >
        <SidebarScrollBox scrollRef={setScrollBox}>
          <For each={commits()}>
            {(commit) => (
              <SelectableRow
                id={`commit-${commit.sha}`}
                selected={commit.sha === props.content.selectedCommit()}
                label={commit.sha.slice(0, 7)}
                detail={firstLine(commit.message)}
              />
            )}
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
      {
        name: "pane.pull-requests",
        run: () => setPane({ active: "pull-requests" }),
      },
      { name: "pane.commits", run: () => setPane({ active: "commits" }) },
      { name: "pane.content", run: () => setPane({ active: "content" }) },
    ],
    bindings: [
      { key: "0", cmd: "pane.files" },
      { key: "1", cmd: "pane.pull-requests" },
      { key: "2", cmd: "pane.commits" },
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
      <PullRequestsBox titles={props.titles} content={props.content} />
      <CommitsBox titles={props.titles} content={props.content} />
    </box>
  );
}
