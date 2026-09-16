import {
  type AppContextState,
  useAppContext,
  type RepositoryAppContextState,
} from "@/context/app-context";
import { Default } from "@/features/default/default";
import { Footer, type FooterBinding } from "@/features/footer/footer";
import { Menubar } from "@/features/menubar/menubar";
import { PrView } from "@/features/pr-view/pr-view";
import { usePrTitles } from "@/features/pr-view/use-pr-titles";
import { usePrViewContent } from "@/features/pr-view/use-pr-view-content";
import { Sidebar } from "@/features/sidebar/sidebar";
import type { PaneFocus, RepositoryPane } from "@/features/shared/pane-focus";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { createEffect, createSignal, onMount, Show } from "solid-js";
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
  pane: RepositoryPane,
): readonly FooterBinding[] {
  if (kind === ApplicationContext.Local) {
    return [
      { key: "Ctrl+Q", label: "Quit" },
      { key: "R", label: "Refresh repository" },
    ];
  }

  if (pane === "sidebar") {
    return [
      { key: "Ctrl+Q", label: "Quit" },
      { key: "0/1", label: "List/Content" },
      { key: "j/k", label: "Navigate" },
      { key: "o/c/a", label: "Open/Closed/All" },
      { key: "Enter", label: "Open" },
      { key: "R", label: "Reload list" },
    ];
  }

  return [
    { key: "Ctrl+Q", label: "Quit" },
    { key: "0", label: "List" },
    { key: "1–7", label: "Tabs" },
    { key: "r", label: "Reload visible" },
  ];
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
  const titles = usePrTitles();
  const content = usePrViewContent(titles);
  const [focusedPane, setFocusedPane] = createSignal<RepositoryPane>("sidebar");
  const paneFocus: PaneFocus = {
    pane: focusedPane,
    focus: (pane) => {
      setFocusedPane(pane);
    },
  };

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Menubar contextLabel={contextLabel} />
      <box flexDirection="row" flexGrow={1} width="100%">
        <Sidebar titles={titles} paneFocus={paneFocus} />
        <PrView
          state={props.state}
          contextLabel={contextLabel}
          titles={titles}
          content={content}
          paneFocus={paneFocus}
        />
      </box>
      <Footer
        bindings={repositoryFooterBindings(props.state.kind, focusedPane())}
      />
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
    <box width="100%" height="100%" backgroundColor={colors.background}>
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
