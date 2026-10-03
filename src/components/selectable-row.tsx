import { Show, type Accessor } from "solid-js";
import { colors } from "@/theme";
import { sanitizeLine, truncateEnd } from "@/utils/text";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  readonly guide?: string;
  readonly label: string;
  readonly detail?: string;
  readonly marker?: { readonly text: string; readonly color: string };
  readonly maxWidth?: number;
}

export function SelectableRow(props: SelectableRowProps) {
  const line = () => {
    const label = sanitizeLine(props.label);
    const detail = props.detail === undefined ? "" : sanitizeLine(props.detail);
    const combined = detail === "" ? label : `${label} ${detail}`;
    return props.maxWidth === undefined
      ? combined
      : truncateEnd(
          combined,
          props.maxWidth -
            (props.guide?.length ?? 0) -
            (props.marker === undefined ? 0 : props.marker.text.length + 1),
        );
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
      <text fg={colors.foreground} wrapMode="none" truncate flexGrow={1}>
        <span style={{ fg: colors.dim }}>{props.guide ?? ""}</span>
        {line()}
      </text>
      <Show when={props.marker}>
        {(
          marker: Accessor<{ readonly text: string; readonly color: string }>,
        ) => (
          <text fg={marker().color} wrapMode="none" flexShrink={0}>
            {marker().text}
          </text>
        )}
      </Show>
    </box>
  );
}
