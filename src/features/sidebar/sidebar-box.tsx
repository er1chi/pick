import {
  Show,
  createEffect,
  createSignal,
  type JSX,
  type Setter,
} from "solid-js";
import { PaneStore } from "@/context/active-pane-context";
import { colors } from "@/theme";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import type { RepositoryPane } from "@/types";

export interface SidebarPaneProps {
  readonly titles: PrTitles;
  readonly content: PrViewContent;
  readonly rowWidth: number;
}

/** Pane-local focus state and renderable refs shared by every sidebar box. */
export function useSidebarPane(active: RepositoryPane) {
  const [pane, setPane] = PaneStore.use();
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const focused = () => pane.active === active;
  return { pane, setPane, box, setBox, scrollBox, setScrollBox, focused };
}

/** First non-blank line of a multi-line label, collapsed to a single row. */
export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((candidate) => candidate.trim() !== "");
  return line?.trim() ?? text;
}

interface SidebarBoxProps {
  readonly title: string;
  readonly active: boolean;
  readonly boxRef: Setter<BoxRenderable | undefined>;
  readonly grow?: number;
  readonly height?: number;
  readonly children: JSX.Element;
}

export function SidebarBox(props: SidebarBoxProps): JSX.Element {
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
  readonly hideScrollbar?: boolean;
  readonly children: JSX.Element;
}

export function SidebarScrollBox(props: SidebarScrollBoxProps): JSX.Element {
  function captureScrollBox(node: ScrollBoxRenderable): void {
    if (props.hideScrollbar === true) {
      // Hide the track but keep the scrollbar renderables mounted: scrolling
      // and scrollChildIntoView read through them. Assigning via the `visible`
      // setter marks the visibility as manual so the ScrollBox's own
      // recalculation cannot reveal the bar again as content arrives; passing
      // it as an option would be overwritten.
      node.verticalScrollBar.visible = false;
    }
    props.scrollRef(node);
  }

  return (
    <scrollbox
      ref={captureScrollBox}
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

export function EmptyGate(props: EmptyGateProps): JSX.Element {
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

export function useFocusWhenActive(
  active: () => boolean,
  request: () => number,
  target: () => BoxRenderable | undefined,
): void {
  createEffect(() => {
    const shouldFocus = active();
    // Subscribe to the focus request token so an explicit request re-runs the
    // effect even when the pane was already active.
    request();
    if (shouldFocus) {
      target()?.focus();
    }
  });
}

export function useScrollIntoView(
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
