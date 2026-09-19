import { hunkHeaderRow, type DisplayRow } from "./display-row";
import { hunkBlocks, type HunkBlock } from "./hunk-blocks";

import type { FileDiffMetadata, Hunk } from "@pierre/diffs";

function flattenBlock(
  block: HunkBlock,
  hunkIndex: number,
  blockIndex: number,
): DisplayRow[] {
  const prefix = `hunk:${String(hunkIndex)}`;
  if (block.type === "context") {
    return block.lines.map((line, offset) => ({
      key: `${prefix}:ctx:${String(blockIndex)}:${String(offset)}`,
      kind: "context",
      text: line.text,
      oldLine: line.oldLine,
      newLine: line.newLine,
    }));
  }
  const deletions: DisplayRow[] = block.deletions.map((line, offset) => ({
    key: `${prefix}:del:${String(blockIndex)}:${String(offset)}`,
    kind: "deletion",
    text: line.text,
    oldLine: line.oldLine,
  }));
  const additions: DisplayRow[] = block.additions.map((line, offset) => ({
    key: `${prefix}:add:${String(blockIndex)}:${String(offset)}`,
    kind: "addition",
    text: line.text,
    newLine: line.newLine,
  }));
  return [...deletions, ...additions];
}

function flattenHunk(
  fileDiff: FileDiffMetadata,
  hunk: Hunk,
  hunkIndex: number,
): DisplayRow[] {
  return [
    hunkHeaderRow(hunkIndex, hunk.hunkSpecs),
    ...hunkBlocks(fileDiff, hunk).flatMap((block, blockIndex) =>
      flattenBlock(block, hunkIndex, blockIndex),
    ),
  ];
}

export function flattenHunks(
  fileDiff: FileDiffMetadata,
): readonly DisplayRow[] {
  return fileDiff.hunks.flatMap((hunk, hunkIndex) =>
    flattenHunk(fileDiff, hunk, hunkIndex),
  );
}
