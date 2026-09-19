export type DisplayRowKind =
  | "file"
  | "context"
  | "addition"
  | "deletion"
  | "hunk-header"
  | "conflict-marker"
  | "conflict-current"
  | "conflict-incoming"
  | "conflict-base";

export interface DisplayRow {
  key: string;
  kind: DisplayRowKind;
  text: string;
  oldLine?: number;
  newLine?: number;
  lineNumber?: number;
}

function trimDisplayLine(text: string): string {
  if (text.endsWith("\n") || text.endsWith("\r")) {
    return text.slice(0, -1);
  }
  return text;
}

export function displayLineAt(lines: readonly string[], index: number): string {
  const line = lines[index];
  if (line === undefined) {
    return "";
  }
  return trimDisplayLine(line);
}

export function hunkHeaderRow(
  hunkIndex: number,
  hunkSpecs: string | undefined,
) {
  return {
    key: `hunk:${String(hunkIndex)}:header`,
    kind: "hunk-header",
    text: trimDisplayLine(hunkSpecs ?? ""),
  } satisfies DisplayRow;
}
