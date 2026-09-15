import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { colors } from "@/theme";
import {
  ForgeContextErrorCode,
  type ForgeContextError,
} from "@/context/app-context";
import type { PullRequestSummary } from "@/services/forge/types";
import type { PullRequestViewData } from "@/features/pr-view/use-pr-view-data";
import { SelectableRow } from "@/features/shared/selectable-row";
import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createEffect, createSignal } from "solid-js";

export interface SidebarProps {
  readonly view: PullRequestViewData;
}

function listItems(view: PullRequestViewData): readonly PullRequestSummary[] {
  const state = view.list();
  return state.status === "ready" ? state.value.items : [];
}

function errorDescription(error: ForgeContextError): string {
  return error.code === ForgeContextErrorCode.NoActiveForge
    ? "No active remote repository."
    : error.diagnostic;
}

function listError(view: PullRequestViewData): string | undefined {
  const state = view.list();
  return state.status === "error" ? errorDescription(state.error) : undefined;
}

function listIsTruncated(view: PullRequestViewData): boolean {
  const state = view.list();
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
        run: () => props.view.moveSelection(-1),
      },
      {
        name: "pr-list.move-down",
        run: () => props.view.moveSelection(1),
      },
      {
        name: "pr-list.activate",
        run: () => props.view.activateSelected(),
      },
      {
        name: "pr-list.retry",
        run: () => props.view.retry(),
      },
    ],
    bindings: [
      { key: "k", cmd: "pr-list.move-up" },
      { key: "up", cmd: "pr-list.move-up" },
      { key: "j", cmd: "pr-list.move-down" },
      { key: "down", cmd: "pr-list.move-down" },
      { key: "return", cmd: "pr-list.activate" },
      { key: "r", cmd: "pr-list.retry" },
    ],
  }));

  createEffect(() => {
    const number = props.view.selectedNumber();
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
      <Show
        when={props.view.list().status !== "loading"}
        fallback={<text fg={colors.muted}>Loading pull requests…</text>}
      >
        <Show
          when={listError(props.view) === undefined}
          fallback={
            <box flexDirection="column" paddingLeft={1} paddingRight={1}>
              <text fg={colors.yellow}>Could not load pull requests.</text>
              <text fg={colors.dim}>{listError(props.view)}</text>
              <text fg={colors.muted}>Press r to retry.</text>
            </box>
          }
        >
          <Show
            when={listItems(props.view).length > 0}
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
              <For each={listItems(props.view)}>
                {(summary) => (
                  <SelectableRow
                    id={`pull-request-${summary.number}`}
                    marker={stateMarker(summary)}
                    label={`#${summary.number}`}
                    detail={summary.title}
                    selected={summary.number === props.view.selectedNumber()}
                  />
                )}
              </For>
              <Show when={listIsTruncated(props.view)}>
                <text fg={colors.dim}>More pull requests are available.</text>
              </Show>
            </scrollbox>
          </Show>
        </Show>
      </Show>
    </box>
  );
}
