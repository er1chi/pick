import { colors } from "@/theme";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  readonly label: string;
  readonly detail?: string;
}

// Sidebar rows must stay exactly one visual line, so collapse embedded
// newlines/tabs before handing the text to the renderer.
function sanitizeLine(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

export function SelectableRow(props: SelectableRowProps) {
  const line = () => {
    const label = sanitizeLine(props.label);
    const detail = props.detail === undefined ? "" : sanitizeLine(props.detail);
    return detail === "" ? label : `${label} ${detail}`;
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
