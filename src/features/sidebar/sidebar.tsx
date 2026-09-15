import { colors } from "@/theme";

export function Sidebar() {
  return (
    <box
      flexDirection="column"
      width={24}
      minWidth={0}
      flexShrink={1}
      height="100%"
      backgroundColor={colors.selected}
    >
      <box
        width="100%"
        height={1}
        paddingLeft={1}
        backgroundColor={colors.border}
      >
        <text fg={colors.foreground}>
          <strong>Pull Requests</strong>
        </text>
      </box>
      <text fg={colors.muted}>No pull requests loaded.</text>
    </box>
  );
}
