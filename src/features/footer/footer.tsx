import { colors } from "@/theme";
import { For } from "solid-js";

export interface FooterBinding {
  readonly key: string;
  readonly label: string;
}

export interface FooterProps {
  readonly bindings: readonly FooterBinding[];
}

export function Footer(props: FooterProps) {
  return (
    <box
      flexDirection="row"
      gap={2}
      width="100%"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.selected}
    >
      <For each={props.bindings}>
        {(binding) => (
          <text fg={colors.muted}>
            <strong>{binding.key}</strong> {binding.label}
          </text>
        )}
      </For>
    </box>
  );
}
