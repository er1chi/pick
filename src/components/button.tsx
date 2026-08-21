import { colors } from "@/theme";

interface ButtonProps {
  label: string;
  color?: string;
  focused?: boolean;
}

export function Button(props: ButtonProps) {
  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={props.focused ? colors.blue : colors.selected}
    >
      <text fg={props.focused ? "#10131c" : (props.color ?? colors.foreground)}>
        {props.label}
      </text>
    </box>
  );
}
