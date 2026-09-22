import { fileDisplayRows } from "./file-lines";

import type { FileContents } from "@pierre/diffs";
import type { DisplayRow, DisplayRowKind } from "./display-row";

const MARKER_START = "<<<<<<<";
const MARKER_BASE = "|||||||";
const MARKER_SEPARATOR = "=======";
const MARKER_END = ">>>>>>>";

type ConflictRegion = "outside" | "current" | "base" | "incoming";

const REGION_ENTERED_BY_MARKER = [
  [MARKER_START, "current"],
  [MARKER_BASE, "base"],
  [MARKER_SEPARATOR, "incoming"],
  [MARKER_END, "outside"],
] as const satisfies ReadonlyArray<readonly [string, ConflictRegion]>;

function regionEnteredByMarker(line: string): ConflictRegion | undefined {
  for (const [marker, region] of REGION_ENTERED_BY_MARKER) {
    if (line.startsWith(marker)) {
      return region;
    }
  }
  return undefined;
}

function kindForBodyInRegion(region: ConflictRegion): DisplayRowKind {
  switch (region) {
    case "current":
      return "conflict-current";
    case "base":
      return "conflict-base";
    case "incoming":
      return "conflict-incoming";
    case "outside":
      return "file";
  }
}

function asConflictMarkerRow(row: DisplayRow): DisplayRow {
  return {
    ...row,
    key: `conflict-marker:${row.key}`,
    kind: "conflict-marker",
  };
}

function asConflictBodyRow(
  row: DisplayRow,
  region: ConflictRegion,
): DisplayRow {
  return {
    ...row,
    key: `conflict:${row.key}`,
    kind: kindForBodyInRegion(region),
  };
}

export function conflictDisplayRows(file: FileContents): readonly DisplayRow[] {
  const displayRows: DisplayRow[] = [];
  let region: ConflictRegion = "outside";

  for (const row of fileDisplayRows(file)) {
    const entered = regionEnteredByMarker(row.text);
    if (entered !== undefined) {
      displayRows.push(asConflictMarkerRow(row));
      region = entered;
      continue;
    }

    displayRows.push(asConflictBodyRow(row, region));
  }

  return displayRows;
}
