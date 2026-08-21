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

export function trimDisplayLine(text: string): string {
  if (text.endsWith("\n") || text.endsWith("\r")) {
    return text.slice(0, -1);
  }
  return text;
}
