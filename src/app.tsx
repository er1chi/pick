import {
  type AppContextState,
  useAppContext,
  type RepositoryAppContextState,
} from "@/context/app-context";
import { Default } from "@/features/default/default";
import { Footer, type FooterBinding } from "@/features/footer/footer";
import { Menubar } from "@/features/menubar/menubar";
import { PrView } from "@/features/pr-view/pr-view";
import { Sidebar } from "@/features/sidebar/sidebar";
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

function repositoryAppContextState(
  state: AppContextState,
): RepositoryAppContextState | undefined {
  return state.kind === ApplicationContext.Default ? undefined : state;
}

function repositoryContextLabel(
  kind: RepositoryAppContextState["kind"],
): string {
  if (kind === ApplicationContext.Local) {
    return "Local Git";
  }
  if (kind === ApplicationContext.GitHub) {
    return "GitHub";
  }
  return "Forgejo";
}

function repositoryFooterBindings(
  kind: RepositoryAppContextState["kind"],
): readonly FooterBinding[] {
  const contextBinding =
    kind === ApplicationContext.Local
      ? { key: "R", label: "Refresh repository" }
      : { key: "Enter", label: "Open pull request" };

  return [{ key: "Ctrl+Q", label: "Quit" }, contextBinding];
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

function RepositoryShell(props: { readonly state: RepositoryAppContextState }) {
  const contextLabel = repositoryContextLabel(props.state.kind);

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Menubar contextLabel={contextLabel} />
      <box flexDirection="row" flexGrow={1} width="100%">
        <Sidebar />
        <PrView state={props.state} contextLabel={contextLabel} />
      </box>
      <Footer bindings={repositoryFooterBindings(props.state.kind)} />
    </box>
  );
}

function DefaultWelcome() {
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
        <Default />
      </box>
      <text fg={colors.dim}>Ctrl+Q quits</text>
    </box>
  );
}

export function App() {
  const renderer = useRenderer();
  const appContext = useAppContext();

  onMount(() => {
    renderer.setTerminalTitle("Pick");
  });

  createEffect(() => {
    const state = appContext.state();
    if (
      state.kind !== ApplicationContext.Default &&
      state.kind !== ApplicationContext.Local &&
      state.forgeError !== undefined
    ) {
      notifyCliInitializationError(state.forgeError);
    }
  });

  return (
    <box width="100%" height="100%">
      <Show
        when={repositoryAppContextState(appContext.state())}
        fallback={<DefaultWelcome />}
      >
        {(state: Accessor<RepositoryAppContextState>) => (
          <RepositoryShell state={state()} />
        )}
      </Show>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
