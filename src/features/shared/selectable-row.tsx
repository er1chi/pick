import { colors } from "@/theme";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  readonly label: string;
  readonly detail?: string;
  /** Maximum display columns before the row is truncated at the end. */
  readonly maxWidth?: number;
}

// Sidebar rows must stay exactly one visual line, so collapse embedded
// newlines/tabs before handing the text to the renderer.
function sanitizeLine(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

// Truncate only the end. The renderer's own overflow handling is a backstop,
// but bounding the string here keeps rows from ever eliding the middle.
function truncateEnd(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return "";
  }
  const characters = Array.from(text);
  if (characters.length <= maxWidth) {
    return text;
  }
  return `${characters.slice(0, maxWidth - 1).join("")}…`;
}

export function SelectableRow(props: SelectableRowProps) {
  const line = () => {
    const label = sanitizeLine(props.label);
    const detail = props.detail === undefined ? "" : sanitizeLine(props.detail);
    const combined = detail === "" ? label : `${label} ${detail}`;
    return props.maxWidth === undefined
      ? combined
      : truncateEnd(combined, props.maxWidth);
  };

  return (
    <box
      id={props.id}
      flexDirection="row"
      width="100%"
      height={1}
      flexShrink={0}
      overflow="hidden"
      backgroundColor={props.selected ? colors.border : undefined}
    >
      <text fg={colors.foreground} wrapMode="none" truncate>
        {line()}
      </text>
    </box>
  );
}
