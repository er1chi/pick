import { colors } from "@/theme";
import { Show } from "solid-js";

export interface SelectableRowProps {
  readonly id: string;
  readonly selected: boolean;
  readonly marker: string;
  readonly label: string;
  readonly detail?: string;
}

export function SelectableRow(props: SelectableRowProps) {
  return (
    <box
      id={props.id}
      flexDirection="row"
      gap={1}
      width="100%"
      backgroundColor={props.selected ? colors.border : undefined}
    >
      <text fg={props.selected ? colors.blue : colors.dim}>
        {props.selected ? ">" : " "}
      </text>
      <text fg={props.selected ? colors.foreground : colors.muted}>
        {props.marker}
      </text>
      <text fg={props.selected ? colors.foreground : colors.muted}>
        {props.label}
      </text>
      <Show when={props.detail !== undefined}>
        <text fg={props.selected ? colors.foreground : colors.dim}>
          {props.detail}
        </text>
      </Show>
    </box>
  );
}
