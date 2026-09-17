import type { FileDiffMetadata, ThemedToken } from "@pierre/diffs";
import { createMemo, createResource, For, Show, type Accessor } from "solid-js";
import { colors } from "@/theme";
import type { DisplayRow, DisplayRowKind } from "./utils/display-row";
import { highlightSplitRows } from "./utils/highlight";
import { splitRows, type SplitDisplayRow } from "./utils/split-rows";

export interface SplitFileDiffProps {
  fileDiff: FileDiffMetadata;
  disableLineNumbers?: boolean;
}

const SPLIT_SEPARATOR = "│";

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
    <box flexGrow={1} flexBasis={0} minWidth={0} height={1} overflow="hidden">
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

export function SplitFileDiff(props: SplitFileDiffProps) {
  const rows = createMemo(() => splitRows(props.fileDiff));
  const oldWidth = createMemo(() => lineWidth(rows(), "left"));
  const newWidth = createMemo(() => lineWidth(rows(), "right"));
  const disableLineNumbers = () => props.disableLineNumbers === true;

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

  const tokensFor = (rowKey: string, side: "left" | "right") => {
    const index = lineIndex().get(rowKey);
    if (index === undefined) {
      return undefined;
    }
    return highlight()?.[side]?.[index];
  };

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
              <text fg={colors.dim} wrapMode="none">
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
                row={row.left}
                line={row.left?.oldLine}
                width={oldWidth()}
                disableLineNumbers={disableLineNumbers()}
                tokens={tokensFor(row.key, "left")}
              />
              <box width={1} height={1} flexShrink={0} overflow="hidden">
                <text fg={colors.dim} wrapMode="none">
                  {SPLIT_SEPARATOR}
                </text>
              </box>
              <SplitCell
                row={row.right}
                line={row.right?.newLine}
                width={newWidth()}
                disableLineNumbers={disableLineNumbers()}
                tokens={tokensFor(row.key, "right")}
              />
            </box>
          )
        }
      </For>
    </box>
  );
}
