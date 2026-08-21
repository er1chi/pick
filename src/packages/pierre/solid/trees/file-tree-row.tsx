import { colors } from "@/theme";
import type { FileTreeVisibleRow } from "@pierre/trees";

function rowLabel(row: FileTreeVisibleRow): string {
  const segments = row.flattenedSegments;
  if (segments == null || segments.length === 0) {
    return row.name;
  }
  return segments.map((segment) => segment.name).join("/");
}

function rowPrefix(row: FileTreeVisibleRow): string {
  const indent = "  ".repeat(row.depth);
  if (row.kind === "directory") {
    const chevron = row.isExpanded ? "▾ " : "▸ ";
    return `${indent}${chevron}`;
  }
  return `${indent}  `;
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
        {rowPrefix(props.row)}
        {rowLabel(props.row)}
      </text>
    </box>
  );
}
