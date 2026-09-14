import { useAppContext } from "@/context/app-context";
import { Default } from "@/features/default/default";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { onMount } from "solid-js";

function notifyCliInitializationError(error: ForgeInitializationError) {
  const service =
    error.kind === ApplicationContext.GitHub ? "GitHub" : "Forgejo";
  const executable = error.kind === ApplicationContext.GitHub ? "gh" : "fj";
  const reason =
    error.code === ForgeInitializationErrorCode.ExecutableUnavailable
      ? "is unavailable"
      : "version check failed";
  toast.warning(`${service} CLI (${executable}) ${reason}.`);
}

function AsciiFontPreview(props: {
  readonly font: "block" | "shade" | "huge" | "slick";
  readonly width: number;
  readonly color: string;
}) {
  return (
    <box flexDirection="column" width={props.width} flexShrink={0}>
      <text fg={colors.dim}>{props.font}</text>
      <ascii_font text="PICK" font={props.font} color={props.color} />
    </box>
  );
}

export function App() {
  const renderer = useRenderer();
  const appContext = useAppContext();

  onMount(() => {
    renderer.setTerminalTitle("Pick");

    if (appContext.forgeError !== undefined) {
      notifyCliInitializationError(appContext.forgeError);
    }
  });

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
      gap={1}
    >
      <box flexDirection="column" gap={1} width="100%" alignItems="center">
        <box
          flexDirection="row"
          flexWrap="wrap"
          gap={1}
          width="100%"
          justifyContent="center"
        >
          <AsciiFontPreview font="block" width={30} color={colors.blue} />
          <AsciiFontPreview font="shade" width={18} color={colors.purple} />
          <AsciiFontPreview font="slick" width={22} color={colors.yellow} />
        </box>
        <box
          flexDirection="row"
          flexWrap="wrap"
          gap={1}
          width="100%"
          alignItems="flex-start"
          justifyContent="center"
        >
          <AsciiFontPreview font="huge" width={50} color={colors.green} />
          {appContext.kind === ApplicationContext.Default ? (
            <box
              flexGrow={1}
              flexShrink={1}
              flexBasis={0}
              minWidth={24}
              maxWidth={80}
            >
              <Default />
            </box>
          ) : null}
        </box>
      </box>
      <text fg={colors.muted}>Git, GitHub, and Forgejo — in the terminal.</text>
      <text fg={colors.dim}>Ctrl+Q quits</text>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
