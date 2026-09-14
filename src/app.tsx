import {
  type AppContextState,
  useAppContext,
  type RemoteAppContextState,
} from "@/context/app-context";
import { Default } from "@/features/default/default";
import { RepoView } from "@/features/repo-view/repo-view";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { createEffect, onMount, Show } from "solid-js";
import type { Accessor } from "solid-js";

function remoteAppContextState(
  state: AppContextState,
): RemoteAppContextState | undefined {
  return state.kind === ApplicationContext.Default ? undefined : state;
}

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
  });

  createEffect(() => {
    const forgeError = appContext.state().forgeError;
    if (forgeError !== undefined) {
      notifyCliInitializationError(forgeError);
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
      <box width="100%" maxWidth={80} alignSelf="center">
        <Show
          when={remoteAppContextState(appContext.state())}
          fallback={<Default />}
        >
          {(state: Accessor<RemoteAppContextState>) => (
            <RepoView state={state()} />
          )}
        </Show>
      </box>
      <text fg={colors.dim}>Ctrl+Q quits</text>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
