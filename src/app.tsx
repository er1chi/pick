import { useBindings } from "@opentui/keymap/solid";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import {
  type ForgeContextState,
  useForgeContext,
  type RepositoryForgeContextState,
} from "@/context/forge-context";
import {
  pullRequestViewId,
  useViewContext,
  viewPullRequest,
} from "@/context/view-context";
import { Default } from "@/features/default/default";
import { Footer, type FooterBinding } from "@/features/footer/footer";
import { Menubar } from "@/features/menubar/menubar";
import { PrView } from "@/features/pr-view/pr-view";
import { usePrTitles } from "@/features/pr-view/use-pr-titles";
import { usePrViewContent } from "@/features/pr-view/use-pr-view-content";
import { Sidebar } from "@/features/sidebar/sidebar";
import {
  ApplicationContext,
  ForgeExecutableUnavailableError,
  type ForgeInitializationError,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { PaneStore } from "./context/active-pane-context";
import { Pane } from "./types";

import type { BoxRenderable } from "@opentui/core";
import type { Accessor } from "solid-js";

function repositoryForgeContextState(
  state: ForgeContextState,
): RepositoryForgeContextState | undefined {
  return state.kind === ApplicationContext.Default ? undefined : state;
}

function repositoryContextLabel(
  kind: RepositoryForgeContextState["kind"],
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
  kind: RepositoryForgeContextState["kind"],
  pane: Pane,
): readonly FooterBinding[] {
  if (kind === ApplicationContext.Local) {
    return [
      { key: "Ctrl+Q", label: "Quit" },
      { key: "R", label: "Refresh repository" },
    ];
  }

  const base: readonly FooterBinding[] = [
    { key: "0/1/2/3", label: "Files/Commits/PRs/Main" },
    { key: "Ctrl+Q", label: "Quit" },
  ];

  switch (pane) {
    case Pane.PullRequests:
      return [
        ...base,
        { key: "j/k", label: "Navigate" },
        { key: "o/c/a", label: "Open/Closed/All" },
        { key: "Enter", label: "Open PR" },
        { key: "x", label: "Close PR" },
        { key: "R", label: "Reload list" },
      ];
    case Pane.Files:
      return [
        ...base,
        { key: "j/k", label: "Navigate" },
        { key: "Enter", label: "Open file/Toggle folder" },
      ];
    case Pane.Commits:
      return [...base, { key: "j/k", label: "Navigate/select commit" }];
    case Pane.Main:
      return [
        ...base,
        { key: "j/k", label: "Scroll" },
        { key: "r", label: "Retry" },
        { key: "e", label: "Reveal lock files" },
        { key: "o", label: "Close diff" },
        { key: "x", label: "Close PR" },
      ];
    default:
      return [];
  }
}

function notifyCliInitializationError(error: ForgeInitializationError) {
  const service =
    error.kind === ApplicationContext.GitHub ? "GitHub" : "Forgejo";
  const executable = error.kind === ApplicationContext.GitHub ? "gh" : "fj";
  const reason = ForgeExecutableUnavailableError.is(error)
    ? "is unavailable"
    : "version check failed";
  toast.warning(`${service} CLI (${executable}) ${reason}.`);
}

function RepositoryShell(props: {
  readonly state: RepositoryForgeContextState;
}) {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [pane, setPane] = PaneStore.use();
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const contextLabel = repositoryContextLabel(props.state.kind);

  let repositoryKey = "";
  createEffect(() => {
    const state = forgeContext.state();
    const key = `${state.cwd}:${state.kind}`;
    const changed = repositoryKey !== "" && repositoryKey !== key;
    repositoryKey = key;
    if (changed) {
      viewContext.close();
    }
  });

  const titles = usePrTitles();
  const content = usePrViewContent();

  createEffect(() => {
    const opened = viewPullRequest(viewContext.view());
    const list = titles.list();
    if (
      opened === undefined ||
      list.status !== "settled" ||
      list.result.isErr()
    ) {
      return;
    }
    const { repository, items } = list.result.value;
    const stillListed = items.some(
      (item) => pullRequestViewId(repository, item.number) === opened.id,
    );
    if (!stillListed) {
      viewContext.close();
    }
  });

  useBindings(() => ({
    target: box,
    commands: [
      {
        name: "pane.files",
        run: () => setPane({ active: Pane.Files }),
      },
      {
        name: "pane.commits",
        run: () => setPane({ active: Pane.Commits }),
      },
      {
        name: "pane.pull-requests",
        run: () => setPane({ active: Pane.PullRequests }),
      },
      {
        name: "pane.main",
        run: () => setPane({ active: Pane.Main }),
      },
    ],
    bindings: [
      { key: "0", cmd: "pane.files" },
      { key: "1", cmd: "pane.commits" },
      { key: "2", cmd: "pane.pull-requests" },
      { key: "3", cmd: "pane.main" },
    ],
  }));

  return (
    <box ref={setBox} flexDirection="column" width="100%" height="100%">
      <Menubar contextLabel={contextLabel} />
      <box flexDirection="row" flexGrow={1} width="100%">
        <Sidebar titles={titles} content={content} />
        <PrView state={props.state} titles={titles} content={content} />
      </box>
      <Footer
        bindings={repositoryFooterBindings(props.state.kind, pane.active)}
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
  const forgeContext = useForgeContext();

  onMount(() => {
    renderer.setTerminalTitle("Pick");
  });

  createEffect(() => {
    const state = forgeContext.state();
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
        when={repositoryForgeContextState(forgeContext.state())}
        fallback={<DefaultWelcome />}
      >
        {(state: Accessor<RepositoryForgeContextState>) => (
          <RepositoryShell state={state()} />
        )}
      </Show>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
