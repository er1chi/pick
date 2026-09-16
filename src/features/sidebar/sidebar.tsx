import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type {
  ForgeOperationError,
  PullRequestSummary,
} from "@/services/forge/types";
import { SelectableRow } from "@/features/shared/selectable-row";
import type { PaneFocus } from "@/features/shared/pane-focus";
import { colors } from "@/theme";
import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createEffect, createSignal, on } from "solid-js";

export interface SidebarProps {
  readonly titles: PrTitles;
  readonly paneFocus: PaneFocus;
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

function stateMarker(summary: PullRequestSummary): string {
  switch (summary.state) {
    case "open":
      return "O";
    case "merged":
      return "M";
    case "closed":
      return "C";
    case "unknown":
      return "?";
    default:
      return "?";
  }
}

export function Sidebar(props: SidebarProps) {
  const [sidebarBox, setSidebarBox] = createSignal<BoxRenderable | undefined>();
  const [scrollBox, setScrollBox] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const focused = () => props.paneFocus.pane() === "sidebar";

  useBindings(() => ({
    target: sidebarBox,
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
        name: "pr-list.activate",
        run: () => props.paneFocus.focus("content"),
      },
      {
        name: "pr-list.focus",
        run: () => props.paneFocus.focus("sidebar"),
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
      { key: "return", cmd: "pr-list.activate" },
      { key: "1", cmd: "pr-list.activate" },
      { key: "0", cmd: "pr-list.focus" },
    ],
  }));

  createEffect(() => {
    const number = props.titles.highlightedNumber();
    if (number !== null) {
      scrollBox()?.scrollChildIntoView(`pull-request-${number}`);
    }
  });

  createEffect(
    on(
      [
        () => props.paneFocus.pane(),
        () => props.titles.filter(),
        () => props.titles.list().status,
        sidebarBox,
      ],
      () => {
        if (focused()) {
          sidebarBox()?.focus();
        }
      },
    ),
  );

  return (
    <box
      ref={setSidebarBox}
      focusable
      focused={focused()}
      flexDirection="column"
      width={32}
      minWidth={32}
      maxWidth={32}
      flexGrow={0}
      flexShrink={0}
      overflow="hidden"
      height="100%"
      backgroundColor={colors.selected}
      border
      borderColor={colors.border}
      focusedBorderColor={colors.blue}
      title="[0] Sidebar"
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
            <scrollbox
              ref={setScrollBox}
              width="100%"
              flexGrow={1}
              stickyScroll
              stickyStart="top"
            >
              <For each={listItems(props.titles)}>
                {(summary) => (
                  <SelectableRow
                    id={`pull-request-${summary.number}`}
                    marker={stateMarker(summary)}
                    label={`#${summary.number}`}
                    detail={summary.title}
                    selected={
                      summary.number === props.titles.highlightedNumber()
                    }
                  />
                )}
              </For>
              <Show when={listIsTruncated(props.titles)}>
                <text fg={colors.dim}>More pull requests are available.</text>
              </Show>
            </scrollbox>
          </Show>
        </Show>
      </Show>
    </box>
  );
}
