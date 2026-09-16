import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import {
  ForgeContextErrorCode,
  type ForgeContextError,
} from "@/context/app-context";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type {
  PullRequestListState,
  PullRequestSummary,
} from "@/services/forge/types";
import { SelectableRow } from "@/features/shared/selectable-row";
import { colors } from "@/theme";
import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createEffect, createSignal } from "solid-js";

export interface SidebarProps {
  readonly titles: PrTitles;
  readonly content: PrViewContent;
}

function listItems(titles: PrTitles): readonly PullRequestSummary[] {
  return titles.list().value?.items ?? [];
}

function errorDescription(error: ForgeContextError): string {
  return error.code === ForgeContextErrorCode.NoActiveForge
    ? "No active remote repository."
    : error.diagnostic;
}

function listError(titles: PrTitles): string | undefined {
  const state = titles.list();
  return state.status === "error" ? errorDescription(state.error) : undefined;
}

function listIsTruncated(titles: PrTitles): boolean {
  const state = titles.list();
  return state.status === "ready" && state.value.truncated;
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

function filterLabel(filter: PullRequestListState): string {
  switch (filter) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "all":
      return "All";
  }
}

export function Sidebar(props: SidebarProps) {
  const [sidebarBox, setSidebarBox] = createSignal<BoxRenderable | undefined>();
  const [scrollBox, setScrollBox] = createSignal<
    ScrollBoxRenderable | undefined
  >();

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
        name: "pr.retry",
        run: () => {
          if (props.titles.list().status === "error") {
            props.titles.retry();
            return;
          }
          props.content.retry();
        },
      },
      {
        name: "pr-list.retry",
        run: () => props.titles.retry(),
      },
      {
        name: "pr-view.tab-overview",
        run: () => props.content.selectTab("overview"),
      },
      {
        name: "pr-view.tab-details",
        run: () => props.content.selectTab("details"),
      },
      {
        name: "pr-view.tab-diff",
        run: () => props.content.selectTab("diff"),
      },
      {
        name: "pr-view.tab-commits",
        run: () => props.content.selectTab("commits"),
      },
      {
        name: "pr-view.tab-reviews",
        run: () => props.content.selectTab("reviews"),
      },
      {
        name: "pr-view.tab-checks",
        run: () => props.content.selectTab("checks"),
      },
      {
        name: "pr-view.tab-development",
        run: () => props.content.selectTab("development"),
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
      { key: "r", cmd: "pr.retry" },
      { key: "R", cmd: "pr-list.retry" },
      { key: "1", cmd: "pr-view.tab-overview" },
      { key: "2", cmd: "pr-view.tab-details" },
      { key: "3", cmd: "pr-view.tab-diff" },
      { key: "4", cmd: "pr-view.tab-commits" },
      { key: "5", cmd: "pr-view.tab-reviews" },
      { key: "6", cmd: "pr-view.tab-checks" },
      { key: "7", cmd: "pr-view.tab-development" },
    ],
  }));

  createEffect(() => {
    const number = props.titles.highlightedNumber();
    if (number !== null) {
      scrollBox()?.scrollChildIntoView(`pull-request-${number}`);
    }
  });

  return (
    <box
      ref={setSidebarBox}
      focusable
      focused
      flexDirection="column"
      width={32}
      minWidth={0}
      flexShrink={1}
      height="100%"
      backgroundColor={colors.selected}
    >
      <box
        width="100%"
        height={1}
        paddingLeft={1}
        backgroundColor={colors.border}
      >
        <text fg={colors.foreground}>
          <strong>Pull Requests</strong>
        </text>
      </box>
      <box flexDirection="row" gap={1} paddingLeft={1} paddingRight={1}>
        <text fg={colors.muted}>Filter:</text>
        <text fg={props.titles.filter() === "open" ? colors.blue : colors.dim}>
          <strong>[O] Open</strong>
        </text>
        <text
          fg={props.titles.filter() === "closed" ? colors.blue : colors.dim}
        >
          <strong>[C] Closed</strong>
        </text>
        <text fg={props.titles.filter() === "all" ? colors.blue : colors.dim}>
          <strong>[A] All</strong>
        </text>
      </box>
      <text fg={colors.dim}>Current: {filterLabel(props.titles.filter())}</text>
      <Show
        when={props.titles.list().status !== "loading"}
        fallback={<text fg={colors.muted}>Loading pull requests…</text>}
      >
        <Show
          when={listError(props.titles) === undefined}
          fallback={
            <box flexDirection="column" paddingLeft={1} paddingRight={1}>
              <text fg={colors.yellow}>Could not load pull requests.</text>
              <text fg={colors.dim}>{listError(props.titles)}</text>
              <text fg={colors.muted}>Press r to retry.</text>
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
