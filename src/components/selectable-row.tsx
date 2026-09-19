import { colors } from "@/theme";
import { sanitizeLine } from "@/utils/sanitize-line";
import { truncateEnd } from "@/utils/truncate";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  readonly label: string;
  readonly detail?: string;
  readonly maxWidth?: number;
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
