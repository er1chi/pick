import { colors } from "@/theme";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { BoxProps, ScrollBoxProps } from "@opentui/solid";
import type { JSX, Setter } from "solid-js";

interface SidebarBoxProps extends BoxProps {
  readonly active: boolean;
  readonly boxRef: Setter<BoxRenderable | undefined>;
  readonly height?: number;
  readonly handleMouseFocus: () => void;
}

export function SidebarBox(props: SidebarBoxProps): JSX.Element {
  return (
    <box
      id={props.id}
      ref={props.boxRef}
      focusable
      focused={props.active}
      flexDirection="column"
      width="100%"
      overflow="hidden"
      border
      borderColor={colors.border}
      focusedBorderColor={colors.blue}
      onMouseDown={(e) => {
        e.stopPropagation();
        props.handleMouseFocus();
      }}
      {...props}
    >
      {props.children}
    </box>
  );
}

interface SidebarScrollBoxProps extends ScrollBoxProps {
  readonly scrollRef: Setter<ScrollBoxRenderable | undefined>;
  readonly hideScrollbar?: boolean;
  readonly children: JSX.Element;
}

export function SidebarScrollBox(props: SidebarScrollBoxProps): JSX.Element {
  function captureScrollBox(node: ScrollBoxRenderable): void {
    if (props.hideScrollbar === true) {
      // setting verticalScrollbarOptions={{ visible: false }} would be overwritten
      node.verticalScrollBar.visible = false;
    }
    props.scrollRef(node);
  }

  return (
    <scrollbox ref={captureScrollBox} width="100%" flexGrow={1} minHeight={0}>
      {props.children}
    </scrollbox>
  );
}
