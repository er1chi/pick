import type { FileDiffMetadata } from "@pierre/diffs";
import { createMemo, For } from "solid-js";
import { colors } from "@/theme";
import type { DisplayRow, DisplayRowKind } from "./utils/display-row";
import { splitRows, type SplitDisplayRow } from "./utils/split-rows";

export interface SplitFileDiffProps {
  fileDiff: FileDiffMetadata;
  disableLineNumbers?: boolean;
}

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

function columnText(
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
    return `${marker} ${row.text}`;
  }
  return `${String(line).padStart(width, " ")} ${marker} ${row.text}`;
}

function SplitCell(props: { text: string; kind: DisplayRowKind | undefined }) {
  return (
    <box flexGrow={1} flexBasis={0} height={1} overflow="hidden">
      <text fg={kindColor(props.kind)} wrapMode="none" truncate>
        {props.text}
      </text>
    </box>
  );
}

export function SplitFileDiff(props: SplitFileDiffProps) {
  const rows = createMemo(() => splitRows(props.fileDiff));
  const oldWidth = createMemo(() => lineWidth(rows(), "left"));
  const newWidth = createMemo(() => lineWidth(rows(), "right"));
  const disableLineNumbers = () => props.disableLineNumbers === true;

  return (
    <box flexDirection="column" width="100%">
      <For each={rows()}>
        {(row) =>
          row.kind === "hunk-header" ? (
            <box
              flexDirection="row"
              width="100%"
              height={1}
              flexShrink={0}
              overflow="hidden"
            >
              <text fg={colors.dim} wrapMode="none" truncate>
                {row.text}
              </text>
            </box>
          ) : (
            <box
              flexDirection="row"
              width="100%"
              height={1}
              flexShrink={0}
              overflow="hidden"
            >
              <SplitCell
                kind={row.left?.kind}
                text={columnText(
                  row.left,
                  row.left?.oldLine,
                  oldWidth(),
                  disableLineNumbers(),
                )}
              />
              <SplitCell
                kind={row.right?.kind}
                text={columnText(
                  row.right,
                  row.right?.newLine,
                  newWidth(),
                  disableLineNumbers(),
                )}
              />
            </box>
          )
        }
      </For>
    </box>
  );
}
