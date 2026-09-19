import { hunkHeaderRow, type DisplayRow } from "./display-row";
import { hunkBlocks } from "./hunk-blocks";

import type { FileDiffMetadata, Hunk } from "@pierre/diffs";

/**
 * A single row of a side-by-side (split) diff. Either a hunk header that spans
 * both columns, or a pair of aligned columns. For a paired row, `left` holds
 * the deletion side and `right` holds the addition side. A `change` block with
 * uneven deletion/addition counts leaves the shorter side `undefined`, which
 * renders as an empty (padded) cell.
 */
export type SplitDisplayRow =
  | { key: string; kind: "hunk-header"; text: string }
  | { key: string; kind: "line"; left?: DisplayRow; right?: DisplayRow };

function splitHunk(
  fileDiff: FileDiffMetadata,
  hunk: Hunk,
  hunkIndex: number,
): SplitDisplayRow[] {
  const rows: SplitDisplayRow[] = [hunkHeaderRow(hunkIndex, hunk.hunkSpecs)];
  let blockIndex = 0;

  for (const block of hunkBlocks(fileDiff, hunk)) {
    if (block.type === "context") {
      for (const [offset, line] of block.lines.entries()) {
        const key = `hunk:${String(hunkIndex)}:ctx:${String(blockIndex)}:${String(offset)}`;
        rows.push({
          key,
          kind: "line",
          left: {
            key: `${key}:old`,
            kind: "context",
            text: line.text,
            oldLine: line.oldLine,
          },
          right: {
            key: `${key}:new`,
            kind: "context",
            text: line.text,
            newLine: line.newLine,
          },
        });
      }
    } else {
      const paired = Math.max(block.deletions.length, block.additions.length);
      for (let offset = 0; offset < paired; offset += 1) {
        const key = `hunk:${String(hunkIndex)}:change:${String(blockIndex)}:${String(offset)}`;
        const deletion = block.deletions[offset];
        const addition = block.additions[offset];
        rows.push({
          key,
          kind: "line",
          left:
            deletion === undefined
              ? undefined
              : {
                  key: `${key}:old`,
                  kind: "deletion",
                  text: deletion.text,
                  oldLine: deletion.oldLine,
                },
          right:
            addition === undefined
              ? undefined
              : {
                  key: `${key}:new`,
                  kind: "addition",
                  text: addition.text,
                  newLine: addition.newLine,
                },
        });
      }
    }
    blockIndex += 1;
  }

  return rows;
}

export function splitRows(
  fileDiff: FileDiffMetadata,
): readonly SplitDisplayRow[] {
  return fileDiff.hunks.flatMap((hunk, hunkIndex) =>
    splitHunk(fileDiff, hunk, hunkIndex),
  );
}
