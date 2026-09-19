import { For, Show, type JSX } from "solid-js";
import { colors } from "@/theme";

import type { SelectedLineRange } from "@pierre/diffs";
import type { DisplayRow, DisplayRowKind } from "./utils/display-row";

function kindColor(kind: DisplayRowKind): string {
  switch (kind) {
    case "addition":
    case "conflict-incoming":
      return colors.green;
    case "deletion":
    case "conflict-current":
      return colors.red;
    case "hunk-header":
      return colors.dim;
    case "conflict-marker":
      return colors.yellow;
    case "conflict-base":
      return colors.purple;
    case "file":
    case "context":
      return colors.foreground;
  }
}

function kindIndicator(kind: DisplayRowKind): string {
  switch (kind) {
    case "addition":
    case "conflict-incoming":
      return "+";
    case "deletion":
    case "conflict-current":
      return "-";
    default:
      return " ";
  }
}

function maxLineWidth(rows: readonly DisplayRow[]): number {
  let max = 1;
  for (const row of rows) {
    const line = row.lineNumber ?? row.oldLine ?? row.newLine;
    if (line === undefined) {
      continue;
    }
    const width = String(line).length;
    if (width > max) {
      max = width;
    }
  }
  return max;
}

function padLine(line: number | undefined, width: number): string {
  if (line === undefined) {
    return " ".repeat(width);
  }
  return String(line).padStart(width, " ");
}

function rowLineNumber(row: DisplayRow): number | undefined {
  return row.lineNumber ?? row.newLine ?? row.oldLine;
}

function isRowSelected(
  row: DisplayRow,
  selected: SelectedLineRange | null | undefined,
): boolean {
  if (selected == null) {
    return false;
  }

  let line: number | undefined;
  if (selected.side === "deletions") {
    line = row.oldLine ?? row.lineNumber;
  } else if (selected.side === "additions") {
    line = row.newLine ?? row.lineNumber;
  } else {
    line = rowLineNumber(row);
  }

  if (line === undefined) {
    return false;
  }
  return line >= selected.start && line <= selected.end;
}

function CodeSurface(props: {
  header: JSX.Element;
  rows: readonly DisplayRow[];
  disableLineNumbers?: boolean;
  selectedLines?: SelectedLineRange | null;
  afterRow?: (row: DisplayRow) => JSX.Element;
}) {
  const width = () => maxLineWidth(props.rows);

  return (
    <box flexDirection="column" width="100%" height="100%">
      {props.header}
      <scrollbox flexGrow={1} stickyScroll stickyStart="top">
        <For each={props.rows}>
          {(row) => (
            <box flexDirection="column" width="100%">
              <DisplayLine
                row={row}
                lineWidth={width()}
                disableLineNumbers={props.disableLineNumbers === true}
                selected={isRowSelected(row, props.selectedLines)}
              />
              <Show when={props.afterRow}>{props.afterRow?.(row)}</Show>
            </box>
          )}
        </For>
      </scrollbox>
    </box>
  );
}

export function AnnotatedCodeSurface<TAnnotation>(props: {
  header: JSX.Element;
  rows: readonly DisplayRow[];
  disableLineNumbers?: boolean;
  selectedLines?: SelectedLineRange | null;
  fileLevel: readonly TAnnotation[];
  annotationsForRow: (row: DisplayRow) => readonly TAnnotation[];
  renderAnnotation?: (annotation: TAnnotation) => JSX.Element;
}) {
  return (
    <box flexDirection="column" width="100%" height="100%">
      <For each={props.fileLevel}>
        {(annotation) => props.renderAnnotation?.(annotation)}
      </For>
      <CodeSurface
        header={props.header}
        rows={props.rows}
        disableLineNumbers={props.disableLineNumbers}
        selectedLines={props.selectedLines}
        afterRow={(row) => (
          <For each={props.annotationsForRow(row)}>
            {(annotation) => props.renderAnnotation?.(annotation)}
          </For>
        )}
      />
    </box>
  );
}

function DisplayLine(props: {
  row: DisplayRow;
  lineWidth: number;
  disableLineNumbers: boolean;
  selected: boolean;
}) {
  const gutter = () => {
    const marker = kindIndicator(props.row.kind);
    if (props.disableLineNumbers || props.row.kind === "hunk-header") {
      return marker;
    }
    if (props.row.kind === "file" || props.row.lineNumber != null) {
      const number = padLine(props.row.lineNumber, props.lineWidth);
      return `${number} ${marker}`;
    }
    const oldLine = padLine(props.row.oldLine, props.lineWidth);
    const newLine = padLine(props.row.newLine, props.lineWidth);
    return `${oldLine} ${newLine} ${marker}`;
  };

  return (
    <box
      flexDirection="row"
      width="100%"
      backgroundColor={props.selected ? colors.selected : undefined}
    >
      <text fg={kindColor(props.row.kind)}>
        {gutter()} {props.row.text}
      </text>
    </box>
  );
}
