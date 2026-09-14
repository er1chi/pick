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
      <ascii_font text="PICK" font="block" color={colors.blue} />
      <text fg={colors.muted}>Git, GitHub, and Forgejo — in the terminal.</text>
      {appContext.kind === ApplicationContext.Default ? <Default /> : null}
      <text fg={colors.dim}>Ctrl+Q quits</text>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
