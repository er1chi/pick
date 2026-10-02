import { BorderChars } from "@opentui/core";
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

import type {
  BorderCharacters,
  BorderSides,
  BoxRenderable,
  ScrollBoxRenderable,
} from "@opentui/core";
import type { FileDiffMetadata, ThemedToken } from "@pierre/diffs";
import type { DisplayRow, DisplayRowKind } from "./utils/display-row";

export interface SplitFileDiffScrollTarget {
  scrollBy(lines: number): void;
  reset(): void;
  jump(unit: DiffJumpUnit, direction: 1 | -1): void;
}

/** A hunk from the patch, or a run of changed lines inside one. */
type DiffJumpUnit = "hunk" | "change";

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
  gap?: number;
}

/**
 */
const SPLIT_LAYOUT_MIN_WIDTH = 113;

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
  active: boolean;
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
        <span style={{ fg: props.active ? colors.blue : undefined }}>
          {gutter()}
        </span>
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

const fillerDots = "· ".repeat(256);

function FillerRow(props: { side: Side }) {
  return (
    <box
      width="100%"
      height={1}
      flexShrink={0}
      minWidth={0}
      overflow="hidden"
      backgroundColor={
        props.side === "left" ? colors.deletionFiller : colors.additionFiller
      }
    >
      <text fg={colors.fillerDot} wrapMode="none">
        {fillerDots}
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
  active: boolean;
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
        <text fg={props.active ? colors.blue : colors.dim} wrapMode="none">
          {row.text}
        </text>
      </box>
    );
  }

  const sideRow = props.side === "left" ? row.left : row.right;
  const line = props.side === "left" ? sideRow?.oldLine : sideRow?.newLine;
  if (sideRow === undefined) {
    return <FillerRow side={props.side} />;
  }

  return (
    <SplitCell
      row={sideRow}
      line={line}
      width={props.width}
      disableLineNumbers={props.disableLineNumbers}
      tokens={props.tokens}
      active={props.active}
    />
  );
}

const leftPaneChars: BorderCharacters = {
  ...BorderChars.single,
  topRight: BorderChars.single.topT,
  bottomRight: BorderChars.single.bottomT,
};
const rightPaneSides: BorderSides[] = ["top", "right", "bottom"];

/**
 * A single bordered code surface. In split mode both surfaces grow to share the
 * container width; stacked, each one takes the full container width so its code
 * stays readable.
 */
function DiffPane(props: {
  title: string;
  side: Side;
  rows: readonly SplitDisplayRow[];
  activeKey: string | undefined;
  width: number;
  split: boolean;
  disableLineNumbers: boolean;
  tokensFor: (rowKey: string, side: Side) => readonly ThemedToken[] | undefined;
  scrollRef: (element: ScrollBoxRenderable) => void;
  joined: boolean;
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
      border={props.joined && props.side === "right" ? rightPaneSides : true}
      customBorderChars={
        props.joined && props.side === "left" ? leftPaneChars : undefined
      }
      borderColor={colors.border}
      title={props.title}
      titleColor={colors.dim}
    >
      <For each={props.rows}>
        {(row) => (
          <PaneRow
            row={row}
            side={props.side}
            active={row.key === props.activeKey}
            width={props.width}
            disableLineNumbers={props.disableLineNumbers}
            tokens={props.tokensFor(row.key, props.side)}
          />
        )}
      </For>
    </scrollbox>
  );
}

function isChangeRow(row: SplitDisplayRow | undefined): boolean {
  return (
    row?.kind === "line" &&
    (row.left?.kind === "deletion" || row.right?.kind === "addition")
  );
}

/** The first offset past `from` in `direction`, if any. */
function offsetFrom(
  offsets: readonly number[],
  from: number,
  direction: 1 | -1,
): number | undefined {
  return direction === 1
    ? offsets.find((offset) => offset > from)
    : offsets.findLast((offset) => offset < from);
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
  const rows = createMemo(() => splitRows(props.fileDiff));
  const hunkOffsets = createMemo(() =>
    rows().flatMap((row, index) => (row.kind === "hunk-header" ? [index] : [])),
  );
  const changeOffsets = createMemo(() =>
    rows().flatMap((row, index) =>
      isChangeRow(row) && !isChangeRow(rows()[index - 1]) ? [index] : [],
    ),
  );
  // The row last jumped to. Targets near the end of the diff cannot all be
  // scrolled to the top of the viewport, so the cursor is tracked separately
  // from scrollTop and its row is highlighted to show where a jump landed.
  const [activeRow, setActiveRow] = createSignal<number | undefined>();
  const activeRowKey = () => rows()[activeRow() ?? -1]?.key;
  let activeRowTop: number | undefined;
  // A side without any lines (a new file has no "Before", a deleted file no
  // "After") is dropped so the other pane takes the full width. "After" stays
  // when both sides are empty so the diff still renders a surface.
  const hasBefore = createMemo(() =>
    rows().some((row) => row.kind === "line" && row.left !== undefined),
  );
  const hasAfter = createMemo(
    () =>
      !hasBefore() ||
      rows().some((row) => row.kind === "line" && row.right !== undefined),
  );

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
    // Only the panes currently rendered take part in scrolling; a hidden
    // pane's signal may still hold its previous, unmounted renderable.
    const panes = [
      hasBefore() ? leftScroll() : undefined,
      hasAfter() ? rightScroll() : undefined,
    ].filter((pane) => pane !== undefined);
    if (panes.length === 0) {
      return;
    }
    // Hide the track while keeping the scrollbar renderables in the scrollbox:
    // scrolling, viewport math, and j/k syncing all read through them.
    // Assigning through the `visible` setter marks the visibility as manual so
    // ScrollBox's own recalculation does not turn the bars back on.
    for (const pane of panes) {
      pane.verticalScrollBar.visible = false;
      pane.horizontalScrollBar.visible = false;
    }

    const target: SplitFileDiffScrollTarget = {
      scrollBy(lines) {
        setActiveRow(undefined);
        for (const pane of panes) {
          pane.scrollTop += lines;
        }
      },
      reset() {
        setActiveRow(undefined);
        for (const pane of panes) {
          pane.scrollTop = 0;
        }
      },
      jump(unit, direction) {
        const top = panes[0]?.scrollTop ?? 0;
        const active = activeRow();
        // Step from the active row unless the view was scrolled since the
        // last jump (e.g. by mouse), in which case start from the viewport.
        const from =
          active !== undefined && top === activeRowTop ? active : top;
        const target = offsetFrom(
          unit === "hunk" ? hunkOffsets() : changeOffsets(),
          from,
          direction,
        );
        if (target === undefined) {
          return;
        }
        setActiveRow(target);
        for (const pane of panes) {
          pane.scrollTop = target;
        }
        activeRowTop = panes[0]?.scrollTop;
      },
    };
    props.scrollTargetRef?.(target);
    onCleanup(() => props.scrollTargetRef?.(undefined));
  });

  const oldWidth = createMemo(() => lineWidth(rows(), "left"));
  const newWidth = createMemo(() => lineWidth(rows(), "right"));
  const disableLineNumbers = () => props.disableLineNumbers === true;
  const split = () => containerWidth() >= SPLIT_LAYOUT_MIN_WIDTH;
  const gap = () => props.gap ?? 0;
  const joined = () => split() && hasBefore() && hasAfter() && gap() === 0;

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
        gap={gap()}
      >
        <Show when={hasBefore()}>
          <DiffPane
            title="Before"
            side="left"
            rows={rows()}
            activeKey={activeRowKey()}
            width={oldWidth()}
            split={split()}
            disableLineNumbers={disableLineNumbers()}
            tokensFor={tokensFor}
            scrollRef={setLeftScroll}
            joined={joined()}
          />
        </Show>
        <Show when={hasAfter()}>
          <DiffPane
            title="After"
            side="right"
            rows={rows()}
            activeKey={activeRowKey()}
            width={newWidth()}
            split={split()}
            disableLineNumbers={disableLineNumbers()}
            tokensFor={tokensFor}
            scrollRef={setRightScroll}
            joined={joined()}
          />
        </Show>
      </box>
    </box>
  );
}
