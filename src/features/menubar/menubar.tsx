import { colors } from "@/theme";

export interface MenubarProps {
  readonly contextLabel: string;
}

export function Menubar(props: MenubarProps) {
  return (
    <box
      flexDirection="row"
      gap={1}
      width="100%"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.selected}
    >
      <text fg={colors.blue}>
        <strong>Pick</strong>
      </text>
      <text fg={colors.foreground}>File</text>
      <text fg={colors.foreground}>Edit</text>
      <text fg={colors.foreground}>View</text>
      <text fg={colors.foreground}>Help</text>
      <text fg={colors.muted}>{props.contextLabel}</text>
    </box>
  );
}
