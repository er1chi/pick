import { colors } from "@/theme";

import type { FileTreeVisibleRow } from "@pierre/trees";

export function fileTreeRowLabel(row: FileTreeVisibleRow): string {
  const segments = row.flattenedSegments;
  if (segments == null || segments.length === 0) {
    return row.name;
  }
  return segments.map((segment) => segment.name).join("/");
}

/** One vertical guide per ancestor directory, so nesting reads at a glance. */
export function fileTreeRowGuides(row: FileTreeVisibleRow): string {
  return "│ ".repeat(row.depth);
}

export function fileTreeRowPrefix(row: FileTreeVisibleRow): string {
  if (row.kind === "directory") {
    return row.isExpanded ? "▾ " : "▸ ";
  }
  return "  ";
}

function rowBackground(row: FileTreeVisibleRow): string | undefined {
  if (row.isFocused) {
    return colors.selected;
  }
  if (row.isSelected) {
    return colors.border;
  }
  return undefined;
}

export function FileTreeRow(props: { row: FileTreeVisibleRow }) {
  const fg = () => {
    if (props.row.kind === "directory") {
      return colors.blue;
    }
    return colors.foreground;
  };

  return (
    <box
      flexDirection="row"
      width="100%"
      backgroundColor={rowBackground(props.row)}
    >
      <text fg={fg()}>
        <span style={{ fg: colors.dim }}>{fileTreeRowGuides(props.row)}</span>
        {fileTreeRowPrefix(props.row)}
        {fileTreeRowLabel(props.row)}
      </text>
    </box>
  );
}
