import { useBindings } from "@opentui/keymap/solid";
import { toast } from "@tuiparts/toast";
import { createEffect, Show } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { useViewContext } from "@/context/view-context";
import {
  isPending,
  visibleError,
  visibleValue,
} from "@/features/main-view/utils/load-state";
import { ForgeInvalidConnectionUrlError } from "@/services/forge/types";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { firstLine } from "@/utils/utils";
import { useSidebarList } from "./sidebar-list";

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

const filterLabels = {
  open: "Open",
  closed: "Closed",
  all: "All",
} as const;

const connectionHint =
  "Check that the remote URL points at the Forgejo instance.";
const maskedUrl = "••••••••••••";

function listErrorHint(titles: PrTitles): string | undefined {
  const error = visibleError(titles.list());
  return error !== undefined && ForgeInvalidConnectionUrlError.is(error)
    ? connectionHint
    : undefined;
}

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

function pullRequestRowId(summary: PullRequestSummary): string {
  return `pull-request-${summary.number}`;
}

export function PullRequestsBox(props: PullRequestPaneProps): JSX.Element {
  const viewContext = useViewContext();
  const list = useSidebarList({
    pane: Pane.PullRequests,
    items: () => listItems(props.titles),
    rowId: pullRequestRowId,
  });
  const noError = listError(props.titles) === undefined;

  useBindings(() => ({
    target: list.target,
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
          const summary = list.highlighted();
          const repository = visibleValue(props.titles.list())?.repository;
          if (summary !== undefined && repository !== undefined) {
            viewContext.openPullRequest(repository, summary.number);
            list.focus(Pane.Files);
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

  return (
    <list.Box
      title={`[2] Pull Requests · ${filterLabels[props.titles.filter()]}`}
      bottomTitle="[O]pen [C]losed [A]ll"
      bottomTitleAlignment="right"
      height={2 + bodyRowCount()}
    >
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
          <list.Rows
            emptyText="No pull requests found for this repository."
            showScrollbar
            footer={
              <Show when={listIsTruncated(props.titles)}>
                <text fg={colors.dim} wrapMode="none">
                  More pull requests are available.
                </text>
              </Show>
            }
          >
            {(summary, index) => (
              <SelectableRow
                id={pullRequestRowId(summary())}
                selected={index === list.index()}
                label={`#${summary().number}`}
                detail={firstLine(summary().title)}
                maxWidth={props.rowWidth}
              />
            )}
          </list.Rows>
        </Show>
      </Show>
    </list.Box>
  );
}
