import type { FileContents } from "@pierre/diffs";
import type { DisplayRow, DisplayRowKind } from "./display-row";
import { fileDisplayRows } from "./file-lines";

const MARKER_START = "<<<<<<<";
const MARKER_BASE = "|||||||";
const MARKER_SEPARATOR = "=======";
const MARKER_END = ">>>>>>>";

type ConflictRegion = "outside" | "current" | "base" | "incoming";

function startsWithMarker(line: string, marker: string): boolean {
  return line.startsWith(marker);
}

function regionKind(region: ConflictRegion): DisplayRowKind {
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

function nextRegion(line: string, region: ConflictRegion): ConflictRegion {
  if (startsWithMarker(line, MARKER_START)) {
    return "current";
  }
  if (startsWithMarker(line, MARKER_BASE)) {
    return "base";
  }
  if (startsWithMarker(line, MARKER_SEPARATOR)) {
    return "incoming";
  }
  if (startsWithMarker(line, MARKER_END)) {
    return "outside";
  }
  return region;
}

function isMarkerLine(line: string): boolean {
  return (
    startsWithMarker(line, MARKER_START) ||
    startsWithMarker(line, MARKER_BASE) ||
    startsWithMarker(line, MARKER_SEPARATOR) ||
    startsWithMarker(line, MARKER_END)
  );
}

export function conflictDisplayRows(file: FileContents): readonly DisplayRow[] {
  const lines = fileDisplayRows(file);
  let region: ConflictRegion = "outside";

  return lines.map((row) => {
    const line = row.text;
    if (isMarkerLine(line)) {
      region = nextRegion(line, region);
      return {
        ...row,
        key: `conflict-marker:${row.key}`,
        kind: "conflict-marker",
      };
    }

    return {
      ...row,
      key: `conflict:${row.key}`,
      kind: regionKind(region),
    };
  });
}
