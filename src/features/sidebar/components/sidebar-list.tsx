import {
  createEffect,
  createMemo,
  createSignal,
  Index,
  Show,
  splitProps,
} from "solid-js";
import { PaneStore } from "@/context/active-pane-context";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { colors } from "@/theme";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { BoxProps } from "@opentui/solid";
import type { Accessor, JSX } from "solid-js";
import type { Pane } from "@/types";

export interface SidebarListOptions<T> {
  readonly pane: Pane;
  readonly items: Accessor<readonly T[]>;
  /** Element id of an item's row; the highlighted row is kept scrolled into view. */
  readonly rowId: (item: T) => string;
}

interface SidebarListBoxProps extends Omit<BoxProps, "id" | "height"> {
  readonly height?: number;
  /** Sizes the box to its rows, up to this many, and stops it from shrinking. */
  readonly maxVisibleRows?: number;
}

interface SidebarListRowsProps<T> {
  readonly emptyText: string;
  readonly showScrollbar?: boolean;
  /** Rendered after the rows, inside the scroll area. */
  readonly footer?: JSX.Element;
  readonly children: (item: Accessor<T>, index: number) => JSX.Element;
}

export interface SidebarList<T> {
  readonly isFocused: Accessor<boolean>;
  readonly index: Accessor<number>;
  readonly highlighted: Accessor<T | undefined>;
  /** Whether the row at `index` is under the cursor of the focused pane. */
  isHighlighted(index: number): boolean;
  setIndex(index: number): void;
  /** Keymap target for the list's own bindings. */
  readonly target: Accessor<BoxRenderable | undefined>;
  focus(pane: Pane): void;
  readonly Box: (props: SidebarListBoxProps) => JSX.Element;
  readonly Rows: (props: SidebarListRowsProps<T>) => JSX.Element;
}

/**
 * A focusable, keyboard-navigable sidebar pane. Owns pane focus, j/k
 * navigation, scrolling the highlighted row into view and the empty state;
 * callers supply the items and how each row renders.
 */
export function useSidebarList<T>(
  options: SidebarListOptions<T>,
): SidebarList<T> {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(options.pane);
  const navigation = useNavigateList({ target: box });
  const highlighted = createMemo(() => options.items()[navigation.index()]);

  createEffect(() => navigation.setCount(options.items().length));

  useScrollIntoView(() => {
    const item = highlighted();
    return item === undefined ? undefined : options.rowId(item);
  }, scrollBox);

  function focus(pane: Pane): void {
    setPane({ active: pane });
  }

  function Box(props: SidebarListBoxProps): JSX.Element {
    const [local, rest] = splitProps(props, ["maxVisibleRows"]);
    const contentSized = () => local.maxVisibleRows !== undefined;
    const height = () =>
      local.maxVisibleRows === undefined
        ? rest.height
        : 2 +
          Math.min(local.maxVisibleRows, Math.max(1, options.items().length));
    return (
      <SidebarBox
        {...rest}
        id={options.pane}
        active={isFocused()}
        boxRef={setBox}
        height={height()}
        flexShrink={contentSized() ? 0 : rest.flexShrink}
        handleMouseFocus={() => focus(options.pane)}
      />
    );
  }

  function Rows(props: SidebarListRowsProps<T>): JSX.Element {
    return (
      <Show
        when={options.items().length > 0}
        fallback={<text fg={colors.muted}>{props.emptyText}</text>}
      >
        <SidebarScrollBox
          scrollRef={setScrollBox}
          hideScrollbar={props.showScrollbar !== true}
        >
          <Index each={options.items()}>{props.children}</Index>
          {props.footer}
        </SidebarScrollBox>
      </Show>
    );
  }

  return {
    isFocused,
    index: navigation.index,
    highlighted,
    isHighlighted: (index) => isFocused() && index === navigation.index(),
    setIndex: navigation.setIndex,
    target: box,
    focus,
    Box,
    Rows,
  };
}
