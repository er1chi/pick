import { Button } from "@/components/button";
import { type AppContextState, useAppContext } from "@/context/app-context";
import { Default } from "@/features/default/default";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { useBindings } from "@opentui/keymap/solid";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { onMount } from "solid-js";

const contextLabels = {
  [ApplicationContext.Default]: "Application",
  [ApplicationContext.GitHub]: "GitHub",
  [ApplicationContext.Forgejo]: "Forgejo",
} as const satisfies Record<AppContextState["kind"], string>;

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

  useBindings(() => ({
    commands: [
      {
        name: "pick.notify",
        run: () => toast.success("Pick is ready."),
      },
    ],
    bindings: [{ key: "return", cmd: "pick.notify" }],
  }));

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
      gap={1}
    >
      <text fg={colors.blue}>
        <strong>Pick</strong>
      </text>
      <text fg={colors.muted}>Git, GitHub, and Forgejo — in the terminal.</text>
      <text fg={colors.muted}>Context: {contextLabels[appContext.kind]}</text>
      {appContext.kind === ApplicationContext.Default ? <Default /> : null}
      <Button label="Press Enter" color={colors.green} />
      <text fg={colors.dim}>Ctrl+Q quits</text>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
