import { Show, type JSX } from "solid-js";
import { colors } from "@/theme";

interface EmptyGateProps {
  readonly hasItems: boolean;
  readonly emptyText: string;
  readonly children: JSX.Element;
}

export function EmptyGate(props: EmptyGateProps): JSX.Element {
  return (
    <Show
      when={props.hasItems}
      fallback={<text fg={colors.muted}>{props.emptyText}</text>}
    >
      {props.children}
    </Show>
  );
}
