import { useBindings } from "@opentui/keymap/solid";
import { toast } from "@tuiparts/toast";
import { createEffect, createSignal, Index, Show } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { useViewContext } from "@/context/view-context";
import {
  isPending,
  visibleError,
  visibleValue,
} from "@/features/main-view/utils/load-state";
import { ForgeInvalidConnectionUrlError } from "@/services/forge/types";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { firstLine } from "@/utils/utils";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { Accessor, JSX } from "solid-js";
import type { PrTitles } from "@/features/main-view/hooks/use-pr-titles";
import type {
  ForgeOperationError,
  PullRequestSummary,
} from "@/services/forge/types";
import type { PullRequestPaneProps } from "../types";

function listItems(titles: PrTitles): readonly PullRequestSummary[] {
  return visibleValue(titles.list())?.items ?? [];
}

function listError(titles: PrTitles): string | undefined {
  return visibleError(titles.list())?.message;
}

const connectionHint = "Try adjusting aliases in the forgejo-cli config.";
const maskedUrl = "••••••••••••";

/** A nudge toward the fix for an error the user can resolve in their config. */
function listErrorHint(titles: PrTitles): string | undefined {
  const error = visibleError(titles.list());
  return error !== undefined && ForgeInvalidConnectionUrlError.is(error)
    ? connectionHint
    : undefined;
}

/** Toasts a list failure. A connection URL is masked until the user reveals
 * it, since it can expose a private host. */
function toastListError(error: ForgeOperationError): void {
  if (!ForgeInvalidConnectionUrlError.is(error)) {
    toast(error.message);
    return;
  }

  const title = (url: string) => `${error.message} at ${url}`;
  const id = toast(title(maskedUrl), {
    description: connectionHint,
    action: {
      label: "Reveal",
      onClick: () =>
        toast(title(error.url), { id, description: connectionHint }),
    },
  });
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
  const noError = listError(props.titles) === undefined;

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

  createEffect(() => {
    if (!noError) return;
    const error = visibleError(props.titles.list());
    if (!error) return;
    toastListError(error);
  });

  // The box is content-sized so it never claims an equal flex share. Rows are
  // counted here so the scrollbox still has a definite height to scroll in
  // when a constrained terminal forces the box to shrink.
  function bodyRowCount(): number {
    if (listIsPending(props.titles)) {
      return 1;
    }
    if (listError(props.titles) !== undefined) {
      return listErrorHint(props.titles) === undefined ? 3 : 4;
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
          when={noError}
          fallback={
            <box flexDirection="column" paddingLeft={1} paddingRight={1}>
              <text fg={colors.yellow} wrapMode="none">
                Could not load pull requests.
              </text>
              <text fg={colors.muted} wrapMode="none">
                Press R to retry.
              </text>
              <Show when={listErrorHint(props.titles)}>
                {(hint: Accessor<string>) => (
                  <text fg={colors.dim} wrapMode="none">
                    {hint()}
                  </text>
                )}
              </Show>
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
              <Index each={listItems(props.titles)}>
                {(summary, itemIndex) => (
                  <SelectableRow
                    id={`pull-request-${summary().number}`}
                    selected={itemIndex === navigation.index()}
                    label={`#${summary().number}`}
                    detail={firstLine(summary().title)}
                    maxWidth={props.rowWidth}
                  />
                )}
              </Index>
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
