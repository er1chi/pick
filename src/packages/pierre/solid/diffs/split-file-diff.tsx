import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  type Accessor,
} from "solid-js";
import { colors } from "@/theme";
import { highlightSplitRows } from "./utils/highlight";
import { splitRows, type SplitDisplayRow } from "./utils/split-rows";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { FileDiffMetadata, ThemedToken } from "@pierre/diffs";
import type { DisplayRow, DisplayRowKind } from "./utils/display-row";

export interface SplitFileDiffScrollTarget {
  scrollBy(lines: number): void;
  reset(): void;
}

export interface SplitFileDiffProps {
  fileDiff: FileDiffMetadata;
  disableLineNumbers?: boolean;
  scrollTargetRef?: (target: SplitFileDiffScrollTarget | undefined) => void;
  /**
   * Width the diff container is expected to occupy before the container has
   * been measured. Supplying it lets the first frame commit to split or
   * stacked layout instead of rendering stacked at the pre-layout width of 0
   * and switching once the container reports its real width. The measured
   * container width still wins as soon as it is available, so this is only a
   * seed for the initial render.
   */
  widthHint?: number;
}

/**
 * Below this container width the two code surfaces stack. Each surface spends
 * two columns on its border and a few more on the gutter, so at this threshold
 * the narrower surface still keeps a usable stretch of code visible.
 */
const SPLIT_LAYOUT_MIN_WIDTH = 72;

type Side = "left" | "right";

function changeIndicator(kind: DisplayRowKind): string {
  switch (kind) {
    case "addition":
      return "+";
    case "deletion":
      return "-";
    default:
      return " ";
  }
}

function kindColor(kind: DisplayRowKind | undefined): string {
  switch (kind) {
    case "addition":
      return colors.green;
    case "deletion":
      return colors.red;
    default:
      return colors.foreground;
  }
}

function kindBackground(kind: DisplayRowKind | undefined): string | undefined {
  switch (kind) {
    case "addition":
      return colors.additionBackground;
    case "deletion":
      return colors.deletionBackground;
    default:
      return undefined;
  }
}

function lineWidth(
  rows: readonly SplitDisplayRow[],
  side: "left" | "right",
): number {
  let width = 1;
  for (const row of rows) {
    if (row.kind !== "line") {
      continue;
    }
    const sideRow = side === "left" ? row.left : row.right;
    const line = side === "left" ? sideRow?.oldLine : sideRow?.newLine;
    if (line === undefined) {
      continue;
    }
    const digits = String(line).length;
    if (digits > width) {
      width = digits;
    }
  }
  return width;
}

/**
 * Gutter text keeps the line number and change marker that make deletion and
 * addition semantics visible. Code content is rendered separately so it can
 * carry syntax colors.
 */
function gutterText(
  row: DisplayRow | undefined,
  line: number | undefined,
  width: number,
  disableLineNumbers: boolean,
): string {
  if (row === undefined) {
    return "";
  }
  const marker = changeIndicator(row.kind);
  if (disableLineNumbers || line === undefined) {
    return `${marker} `;
  }
  return `${String(line).padStart(width, " ")} ${marker} `;
}

function SplitCell(props: {
  row: DisplayRow | undefined;
  line: number | undefined;
  width: number;
  disableLineNumbers: boolean;
  tokens: readonly ThemedToken[] | undefined;
}) {
  const gutter = () =>
    gutterText(props.row, props.line, props.width, props.disableLineNumbers);

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      flexGrow={0}
      flexBasis="auto"
      flexShrink={0}
      minWidth={0}
      overflow="hidden"
      backgroundColor={kindBackground(props.row?.kind)}
    >
      <text fg={kindColor(props.row?.kind)} wrapMode="none">
        <span>{gutter()}</span>
        <Show
          when={props.tokens}
          fallback={<span>{props.row?.text ?? ""}</span>}
        >
          {(tokens: Accessor<readonly ThemedToken[]>) => (
            <For each={tokens()}>
              {(token) => (
                <span style={{ fg: token.color }}>{token.content}</span>
              )}
            </For>
          )}
        </Show>
      </text>
    </box>
  );
}

/**
 * One row inside a bordered code surface. Hunk headers repeat in each surface
 * so the "Before" and "After" columns stay row-aligned when split.
 */
function PaneRow(props: {
  row: SplitDisplayRow;
  side: Side;
  width: number;
  disableLineNumbers: boolean;
  tokens: readonly ThemedToken[] | undefined;
}) {
  const row = props.row;
  if (row.kind === "hunk-header") {
    return (
      <box
        flexDirection="row"
        width="100%"
        height={1}
        flexShrink={0}
        overflow="hidden"
      >
        <text fg={colors.dim} wrapMode="none">
          {row.text}
        </text>
      </box>
    );
  }

  const sideRow = props.side === "left" ? row.left : row.right;
  const line = props.side === "left" ? sideRow?.oldLine : sideRow?.newLine;

  return (
    <SplitCell
      row={sideRow}
      line={line}
      width={props.width}
      disableLineNumbers={props.disableLineNumbers}
      tokens={props.tokens}
    />
  );
}

/**
 * A single bordered code surface. In split mode both surfaces grow to share the
 * container width; stacked, each one takes the full container width so its code
 * stays readable.
 */
function DiffPane(props: {
  title: string;
  side: Side;
  rows: readonly SplitDisplayRow[];
  width: number;
  split: boolean;
  disableLineNumbers: boolean;
  tokensFor: (rowKey: string, side: Side) => readonly ThemedToken[] | undefined;
  scrollRef: (element: ScrollBoxRenderable) => void;
}) {
  return (
    <scrollbox
      ref={props.scrollRef}
      width={props.split ? "auto" : "100%"}
      flexGrow={1}
      flexBasis={0}
      flexShrink={1}
      minWidth={0}
      minHeight={0}
      border
      borderColor={colors.border}
      title={props.title}
      titleColor={colors.dim}
    >
      <For each={props.rows}>
        {(row) => (
          <PaneRow
            row={row}
            side={props.side}
            width={props.width}
            disableLineNumbers={props.disableLineNumbers}
            tokens={props.tokensFor(row.key, props.side)}
          />
        )}
      </For>
    </scrollbox>
  );
}

export function SplitFileDiff(props: SplitFileDiffProps) {
  const [container, setContainer] = createSignal<BoxRenderable | undefined>();
  const [leftScroll, setLeftScroll] = createSignal<ScrollBoxRenderable>();
  const [rightScroll, setRightScroll] = createSignal<ScrollBoxRenderable>();
  // Responsiveness follows the diff container's own width rather than a global
  // terminal/sidebar budget, so nested layouts can differ. Until the container
  // has been measured, fall back to the parent-supplied hint so the initial
  // frame is already laid out correctly.
  const [measuredWidth, setMeasuredWidth] = createSignal<number | undefined>();
  const containerWidth = () => measuredWidth() ?? props.widthHint ?? 0;

  createEffect(() => {
    const node = container();
    if (node === undefined) {
      return;
    }
    const sync = () => {
      // A pre-layout container reports 0. Ignore that so a valid width hint
      // keeps the first frame stable instead of collapsing to stacked.
      if (node.width > 0) {
        setMeasuredWidth(node.width);
      }
    };
    node.onSizeChange = sync;
    sync();
    onCleanup(() => {
      node.onSizeChange = undefined;
    });
  });

  createEffect(() => {
    const left = leftScroll();
    const right = rightScroll();
    if (left === undefined || right === undefined) {
      return;
    }
    // Hide the track while keeping the scrollbar renderables in the scrollbox:
    // scrolling, viewport math, and j/k syncing all read through them.
    // Assigning through the `visible` setter marks the visibility as manual so
    // ScrollBox's own recalculation does not turn the bars back on.
    left.verticalScrollBar.visible = false;
    left.horizontalScrollBar.visible = false;
    right.verticalScrollBar.visible = false;
    right.horizontalScrollBar.visible = false;

    const target: SplitFileDiffScrollTarget = {
      scrollBy(lines) {
        left.scrollTop += lines;
        right.scrollTop += lines;
      },
      reset() {
        left.scrollTop = 0;
        right.scrollTop = 0;
      },
    };
    props.scrollTargetRef?.(target);
    onCleanup(() => props.scrollTargetRef?.(undefined));
  });

  const rows = createMemo(() => splitRows(props.fileDiff));
  const oldWidth = createMemo(() => lineWidth(rows(), "left"));
  const newWidth = createMemo(() => lineWidth(rows(), "right"));
  const disableLineNumbers = () => props.disableLineNumbers === true;
  const split = () => containerWidth() >= SPLIT_LAYOUT_MIN_WIDTH;

  const highlightInput = createMemo(() => ({
    fileDiff: props.fileDiff,
    rows: rows(),
  }));
  const [highlight] = createResource(highlightInput, (input) =>
    highlightSplitRows(input.fileDiff, input.rows),
  );

  const lineIndex = createMemo(() => {
    const index = new Map<string, number>();
    let next = 0;
    for (const row of rows()) {
      if (row.kind === "line") {
        index.set(row.key, next);
        next += 1;
      }
    }
    return index;
  });

  const tokensFor = (rowKey: string, side: Side) => {
    const index = lineIndex().get(rowKey);
    if (index === undefined) {
      return undefined;
    }
    return highlight()?.[side]?.[index];
  };

  return (
    <box
      ref={setContainer}
      flexDirection="column"
      width="100%"
      height="100%"
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
    >
      <box
        flexDirection={split() ? "row" : "column"}
        width="100%"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        gap={1}
      >
        <DiffPane
          title="Before"
          side="left"
          rows={rows()}
          width={oldWidth()}
          split={split()}
          disableLineNumbers={disableLineNumbers()}
          tokensFor={tokensFor}
          scrollRef={setLeftScroll}
        />
        <DiffPane
          title="After"
          side="right"
          rows={rows()}
          width={newWidth()}
          split={split()}
          disableLineNumbers={disableLineNumbers()}
          tokensFor={tokensFor}
          scrollRef={setRightScroll}
        />
      </box>
    </box>
  );
}
