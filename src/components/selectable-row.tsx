import { colors } from "@/theme";
import { sanitizeLine } from "@/utils/sanitize-line";
import { truncateEnd } from "@/utils/truncate";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  /** Dim structural text drawn before the label, such as tree guides. */
  readonly guide?: string;
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
      : truncateEnd(combined, props.maxWidth - (props.guide?.length ?? 0));
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
        <span style={{ fg: colors.dim }}>{props.guide ?? ""}</span>
        {line()}
      </text>
    </box>
  );
}
