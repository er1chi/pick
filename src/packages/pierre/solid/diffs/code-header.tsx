import type { JSX } from "solid-js";

export function CodeHeader(props: {
  custom?: JSX.Element;
  prefix?: JSX.Element;
  filename: string;
  suffix?: JSX.Element;
  metadata?: JSX.Element;
}) {
  if (props.custom != null) {
    return props.custom;
  }

  return (
    <box flexDirection="row" gap={1} width="100%">
      {props.prefix}
      <text>{props.filename}</text>
      {props.suffix}
      {props.metadata}
    </box>
  );
}
