import type { FileDiffMetadata, Hunk } from "@pierre/diffs";
import { trimDisplayLine, type DisplayRow } from "./display-row";

function lineAt(lines: readonly string[], index: number): string {
  const line = lines[index];
  if (line === undefined) {
    return "";
  }
  return trimDisplayLine(line);
}

function flattenHunk(
  fileDiff: FileDiffMetadata,
  hunk: Hunk,
  hunkIndex: number,
): DisplayRow[] {
  const rows: DisplayRow[] = [];
  rows.push({
    key: `hunk:${String(hunkIndex)}:header`,
    kind: "hunk-header",
    text: trimDisplayLine(hunk.hunkSpecs ?? ""),
  });

  let oldLine = hunk.deletionStart;
  let newLine = hunk.additionStart;
  let blockIndex = 0;

  for (const block of hunk.hunkContent) {
    if (block.type === "context") {
      for (let offset = 0; offset < block.lines; offset += 1) {
        rows.push({
          key: `hunk:${String(hunkIndex)}:ctx:${String(blockIndex)}:${String(offset)}`,
          kind: "context",
          text: lineAt(
            fileDiff.additionLines,
            block.additionLineIndex + offset,
          ),
          oldLine,
          newLine,
        });
        oldLine += 1;
        newLine += 1;
      }
      blockIndex += 1;
      continue;
    }

    for (let offset = 0; offset < block.deletions; offset += 1) {
      rows.push({
        key: `hunk:${String(hunkIndex)}:del:${String(blockIndex)}:${String(offset)}`,
        kind: "deletion",
        text: lineAt(fileDiff.deletionLines, block.deletionLineIndex + offset),
        oldLine,
      });
      oldLine += 1;
    }

    for (let offset = 0; offset < block.additions; offset += 1) {
      rows.push({
        key: `hunk:${String(hunkIndex)}:add:${String(blockIndex)}:${String(offset)}`,
        kind: "addition",
        text: lineAt(fileDiff.additionLines, block.additionLineIndex + offset),
        newLine,
      });
      newLine += 1;
    }

    blockIndex += 1;
  }

  return rows;
}

export function flattenHunks(
  fileDiff: FileDiffMetadata,
): readonly DisplayRow[] {
  return fileDiff.hunks.flatMap((hunk, hunkIndex) =>
    flattenHunk(fileDiff, hunk, hunkIndex),
  );
}
