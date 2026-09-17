import type { FileDiffMetadata, Hunk } from "@pierre/diffs";
import { displayLineAt } from "./display-row";

/**
 * A single source line within a hunk. Context lines carry both `oldLine` and
 * `newLine`; deletions carry only `oldLine`; additions carry only `newLine`.
 */
interface HunkRowLine {
  text: string;
  oldLine?: number;
  newLine?: number;
}

/**
 * A hunk's content resolved into text and absolute line numbers, preserving
 * the parser's context/change grouping. Deletions and additions stay as two
 * ordered arrays inside a `change` block so callers can align them row-by-row.
 */
export type HunkBlock =
  | { type: "context"; lines: HunkRowLine[] }
  | { type: "change"; deletions: HunkRowLine[]; additions: HunkRowLine[] };

export function hunkBlocks(
  fileDiff: FileDiffMetadata,
  hunk: Hunk,
): readonly HunkBlock[] {
  const blocks: HunkBlock[] = [];
  let oldLine = hunk.deletionStart;
  let newLine = hunk.additionStart;

  for (const block of hunk.hunkContent) {
    if (block.type === "context") {
      const lines: HunkRowLine[] = [];
      for (let offset = 0; offset < block.lines; offset += 1) {
        lines.push({
          text: displayLineAt(
            fileDiff.additionLines,
            block.additionLineIndex + offset,
          ),
          oldLine: oldLine + offset,
          newLine: newLine + offset,
        });
      }
      blocks.push({ type: "context", lines });
      oldLine += block.lines;
      newLine += block.lines;
      continue;
    }

    const deletions: HunkRowLine[] = [];
    for (let offset = 0; offset < block.deletions; offset += 1) {
      deletions.push({
        text: displayLineAt(
          fileDiff.deletionLines,
          block.deletionLineIndex + offset,
        ),
        oldLine: oldLine + offset,
      });
    }

    const additions: HunkRowLine[] = [];
    for (let offset = 0; offset < block.additions; offset += 1) {
      additions.push({
        text: displayLineAt(
          fileDiff.additionLines,
          block.additionLineIndex + offset,
        ),
        newLine: newLine + offset,
      });
    }

    blocks.push({ type: "change", deletions, additions });
    oldLine += block.deletions;
    newLine += block.additions;
  }

  return blocks;
}
