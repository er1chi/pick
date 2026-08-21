import type { FileContents } from "@pierre/diffs";
import type { DisplayRow } from "./display-row";

export function fileDisplayRows(file: FileContents): readonly DisplayRow[] {
  if (file.contents.length === 0) {
    return [];
  }

  const lines = file.contents.split("\n");
  const last = lines[lines.length - 1];
  const rows =
    last === "" ? lines.slice(0, Math.max(0, lines.length - 1)) : lines;

  return rows.map((text, index) => ({
    key: `file:${String(index + 1)}`,
    kind: "file",
    text,
    lineNumber: index + 1,
  }));
}
