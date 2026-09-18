import { colors } from "@/theme";
import { truncateEnd } from "@/utils/truncate";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  readonly label: string;
  readonly detail?: string;
  /** Maximum display columns before the row is truncated at the end. */
  readonly maxWidth?: number;
}

// Sidebar rows must stay exactly one visual line, so collapse embedded
// newlines/tabs before handing the text to the renderer. Leading spaces are
// meaningful indentation for tree rows, so only trailing junk is removed;
// callers that must stay flush provide labels without leading whitespace.
function sanitizeLine(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\t/g, " ")
    .trimEnd();
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
