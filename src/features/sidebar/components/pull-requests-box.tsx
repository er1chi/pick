import { useBindings } from "@opentui/keymap/solid";
import { createEffect, createSignal, For, Show } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { useViewContext } from "@/context/view-context";
import {
  isPending,
  visibleError,
  visibleValue,
} from "@/features/pr-view/load-state";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { firstLine } from "@/utils/utils";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "solid-js";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PullRequestSummary } from "@/services/forge/types";
import type { PullRequestPaneProps } from "../types";

function listItems(titles: PrTitles): readonly PullRequestSummary[] {
  return visibleValue(titles.list())?.items ?? [];
}

function listError(titles: PrTitles): string | undefined {
  return visibleError(titles.list())?.message;
}

function listIsTruncated(titles: PrTitles): boolean {
  const state = titles.list();
  return (
    state.status === "settled" &&
    state.result.isOk() &&
    state.result.value.truncated
  );
}

function listIsPending(titles: PrTitles): boolean {
  return isPending(titles.list());
}

export function PullRequestsBox(props: PullRequestPaneProps): JSX.Element {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(Pane.PullRequests);
  const viewContext = useViewContext();
  const navigation = useNavigateList({ target: box });

  createEffect(() => navigation.setCount(listItems(props.titles).length));

  useBindings(() => ({
    target: box,
    commands: [
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
          const summary = listItems(props.titles)[navigation.index()];
          const repository = visibleValue(props.titles.list())?.repository;
          if (summary !== undefined && repository !== undefined) {
            viewContext.openPullRequest(repository, summary.number);
            setPane({ active: Pane.Files });
          }
        },
      },
      {
        name: "pr-list.close",
        run: () => viewContext.close(),
      },
    ],
    bindings: [
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
    const number = listItems(props.titles)[navigation.index()]?.number;
    return number === undefined ? undefined : `pull-request-${number}`;
  }, scrollBox);

  //useFocusWhenActive(focused, () => pane.focusRequest, box);

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

  function handleMouseFocus() {
    setPane({ active: Pane.PullRequests });
  }

  return (
    <SidebarBox
      id={Pane.PullRequests}
      title="[2] Pull Requests"
      active={isFocused()}
      boxRef={setBox}
      grow={0}
      height={3 + bodyRowCount()}
      handleMouseFocus={handleMouseFocus}
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
                      summary.number ===
                      listItems(props.titles)[navigation.index()]?.number
                    }
                    label={`#${summary.number}`}
                    detail={firstLine(summary.title)}
                    maxWidth={props.rowWidth}
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
