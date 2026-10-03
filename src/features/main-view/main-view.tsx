import { useBindings } from "@opentui/keymap/solid";
import { useTerminalDimensions } from "@opentui/solid";
import { basename } from "node:path";
import { createEffect, createMemo, createSignal, on, Show } from "solid-js";
import { PaneStore } from "@/context/active-pane-context";
import { usePatchStore } from "@/context/patch-store";
import { usePullRequest } from "@/context/pull-request-context";
import { useViewContext, viewPullRequest } from "@/context/view-context";
import {
  HintLine,
  MAIN_PANE_CHROME,
} from "@/features/main-view/components/pr-view-chrome";
import {
  MainViewHeader,
  NoPullRequest,
} from "@/features/main-view/components/pr-view-header";
import { patchFileIndex } from "@/features/main-view/utils/patch-file-index";
import {
  presentRepositoryName,
  pullRequestTitleLine,
} from "@/features/main-view/utils/pr-view-display";
import {
  prewarmSplitHighlights,
  type SplitFileDiffScrollTarget,
} from "@/packages/pierre/solid/diffs";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { MainBody } from "./components/main-body";
import { visibleValue } from "./utils/load-state";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { RepositoryForgeContextState } from "@/context/forge-context";
import type { PrTitles } from "./hooks/use-pr-titles";
import type { MainBodyProps } from "./types";

export interface PrViewProps {
  readonly state: RepositoryForgeContextState;
  readonly titles: PrTitles;
}

export function PrView(props: PrViewProps) {
  const [pane, setPane] = PaneStore.use();
  const isFocused = createMemo(() => pane.active === Pane.Main);
  const dimensions = useTerminalDimensions();
  const contentWidth = () =>
    Math.max(16, dimensions().width - MAIN_PANE_CHROME);
  const viewContext = useViewContext();
  const patchStore = usePatchStore();
  const pullRequest = usePullRequest();
  const view = () => viewContext.view();
  const [contentBox, setContentBox] = createSignal<BoxRenderable | undefined>();
  const [overviewScroll, setOverviewScroll] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const [diffScroll, setDiffScroll] = createSignal<
    SplitFileDiffScrollTarget | undefined
  >();
  const [revealLocked, setRevealLocked] = createSignal(false);
  const currentState = () => props.state;
  const localName = () => basename(currentState().cwd) || currentState().cwd;
  const repositoryName = () =>
    visibleValue(props.titles.list())?.repository.fullName ?? localName();
  const opened = () => viewPullRequest(view());
  const summary = () => {
    const number = opened()?.number;
    if (number === undefined) {
      return undefined;
    }
    return visibleValue(props.titles.list())?.items.find(
      (item) => item.number === number,
    );
  };
  const currentDetails = () => {
    const details = pullRequest.data()?.details;
    return details?.status === "available" ? details.value : undefined;
  };
  const headerRepositoryName = () =>
    presentRepositoryName(
      currentDetails()?.repository.fullName,
      repositoryName(),
    );
  const titleLine = () => {
    const item = summary();
    if (item === undefined) {
      return undefined;
    }
    return pullRequestTitleLine(item.title, item.number);
  };
  const headerKey = () => {
    const number = opened()?.number;
    const details = currentDetails();
    const detailsKey =
      details === undefined ? "pending" : `ready:${details.number}`;
    return `${number ?? "none"}:${detailsKey}:${titleLine() ?? ""}:${headerRepositoryName()}`;
  };

  const diffOpen = () => view().file !== undefined;
  /** The local source has no overview: with nothing selected in it, the pane
   * shows the repository landing screen instead. */
  const showsView = () =>
    opened() !== undefined ||
    view().commit !== undefined ||
    view().file !== undefined;
  const hint = () => {
    const closePullRequest = opened() === undefined ? "" : " · x close PR";
    if (diffOpen()) {
      return `j/k scroll · [/] changes · {/} hunks · e lock files · o close diff${closePullRequest}`;
    }
    if (view().commit !== undefined) {
      return `j/k scroll · o close commit${closePullRequest}`;
    }
    return `j/k scroll${closePullRequest}`;
  };

  function scrollContent(lines: number): void {
    if (diffOpen()) {
      diffScroll()?.scrollBy(lines);
      return;
    }
    const overview = overviewScroll();
    if (overview !== undefined) {
      overview.scrollTop += lines;
    }
  }

  const closeOpened = (): void => {
    viewContext.close();
    setPane({ active: Pane.PullRequests });
  };

  const closeDiff = (): void => {
    viewContext.closeFile();
    const overview = overviewScroll();
    if (overview !== undefined) {
      overview.scrollTop = 0;
    }
    setPane({ active: Pane.Files });
  };

  useBindings(() => ({
    target: contentBox,
    commands: [
      {
        name: "pr-view.scroll-down",
        run: () => scrollContent(1),
      },
      {
        name: "pr-view.scroll-up",
        run: () => scrollContent(-1),
      },
      {
        name: "pr-view.retry",
        run: () => pullRequest.refresh(),
      },
      {
        name: "pr-view.toggle-locked-files",
        run: () => {
          setRevealLocked((current) => !current);
        },
      },
      {
        name: "pr-view.close",
        run: closeOpened,
      },
      {
        name: "pr-view.next-hunk",
        run: () => {
          if (diffOpen()) {
            diffScroll()?.jump("hunk", 1);
          }
        },
      },
      {
        name: "pr-view.previous-hunk",
        run: () => {
          if (diffOpen()) {
            diffScroll()?.jump("hunk", -1);
          }
        },
      },
      {
        name: "pr-view.next-change",
        run: () => {
          if (diffOpen()) {
            diffScroll()?.jump("change", 1);
          }
        },
      },
      {
        name: "pr-view.previous-change",
        run: () => {
          if (diffOpen()) {
            diffScroll()?.jump("change", -1);
          }
        },
      },
      {
        name: "pr-view.close-diff",
        run: closeDiff,
      },
    ],
    bindings: [
      { key: "j", cmd: "pr-view.scroll-down" },
      { key: "k", cmd: "pr-view.scroll-up" },
      { key: "r", cmd: "pr-view.retry" },
      { key: "e", cmd: "pr-view.toggle-locked-files" },
      { key: "x", cmd: "pr-view.close" },
      { key: "o", cmd: "pr-view.close-diff" },
      { key: "]", cmd: "pr-view.next-change" },
      { key: "[", cmd: "pr-view.previous-change" },
      { key: "}", cmd: "pr-view.next-hunk" },
      { key: "{", cmd: "pr-view.previous-hunk" },
    ],
  }));

  const bodyProps: MainBodyProps = {
    get revealLocked() {
      return revealLocked();
    },
    get maxWidth() {
      return contentWidth();
    },
    setOverviewScroll,
    setDiffScroll,
  };

  createEffect(() => {
    // Track the request token so an explicit focus request re-runs this even
    // when the content pane was already active.
    if (!isFocused()) {
      return;
    }
    const overview = overviewScroll();
    if (!diffOpen() && overview !== undefined) {
      overview.focus();
      return;
    }
  });

  createEffect(() => {
    prewarmSplitHighlights(patchFileIndex(patchStore.currentPatch()).files);
  });

  createEffect(
    on(
      view,
      () => {
        if (diffOpen()) {
          diffScroll()?.reset();
          return;
        }
        const overview = overviewScroll();
        if (overview !== undefined) {
          overview.scrollTop = 0;
        }
      },
      { defer: true },
    ),
  );

  return (
    <box
      id={Pane.Main}
      ref={setContentBox}
      focusable
      focused={isFocused()}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minWidth={0}
      height="100%"
      overflow="hidden"
      gap={0}
      paddingLeft={2}
      paddingRight={1}
      border
      borderColor={colors.border}
      focusedBorderColor={colors.blue}
      title="[3] Main"
      onMouseDown={(e) => {
        e.stopPropagation();
        setPane({ active: Pane.Main });
      }}
    >
      <Show
        when={showsView()}
        fallback={<NoPullRequest state={currentState()} />}
      >
        <MainViewHeader
          view={view()}
          repositoryName={headerRepositoryName()}
          titleLine={titleLine()}
          headerKey={headerKey()}
          maxWidth={contentWidth()}
        />
        <MainBody view={view()} summary={summary} {...bodyProps} />
        <HintLine text={hint()} maxWidth={contentWidth()} />
      </Show>
    </box>
  );
}
