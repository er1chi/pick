import { useBindings } from "@opentui/keymap/solid";
import { useTerminalDimensions } from "@opentui/solid";
import { basename } from "node:path";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  Show,
  type Accessor,
} from "solid-js";
import { PaneStore } from "@/context/active-pane-context";
import { usePullRequest } from "@/context/pull-request-context";
import {
  useViewContext,
  viewCommit,
  viewPullRequest,
  type ActiveView,
} from "@/context/view-context";
import { MAIN_PANE_CHROME } from "@/features/main-view/components/pr-view-chrome";
import {
  NoPullRequest,
  PrViewHeader,
} from "@/features/main-view/components/pr-view-header";
import { SelectedDiffBody } from "@/features/main-view/components/selected-diff";
import { patchFileIndex } from "@/features/main-view/utils/patch-file-index";
import {
  presentRepositoryName,
  pullRequestTitleLine,
} from "@/features/main-view/utils/pr-view-display";
import {
  prewarmSplitHighlights,
  type SplitFileDiffScrollTarget,
} from "@/packages/pierre/solid/diffs";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { truncateEnd } from "@/utils/truncate";
import { CommitMetadata } from "./components/commit-metadata";
import { OverviewScreen } from "./components/overview-screen";
import { PullRequestStatusLine } from "./components/pull-request-status";
import { visibleValue } from "./utils/load-state";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import type { RepositoryForgeContextState } from "@/context/forge-context";
import type { PrTitles } from "./hooks/use-pr-titles";

export interface PrViewProps {
  readonly state: RepositoryForgeContextState;
  readonly titles: PrTitles;
}

export function PrView(props: PrViewProps) {
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(Pane.Main);
  const dimensions = useTerminalDimensions();
  const contentWidth = () =>
    Math.max(16, dimensions().width - MAIN_PANE_CHROME);
  const viewContext = useViewContext();
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
  const selectedCommitValue = createMemo(() => {
    const current = view();
    const sha = current === undefined ? undefined : viewCommit(current);
    if (sha === undefined) {
      return undefined;
    }
    const section = pullRequest.data()?.commits;
    const commits = section?.status === "available" ? section.value : [];
    return commits.find((commit) => commit.sha === sha);
  });
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

  function scrollContent(lines: number): void {
    if (view()?.kind === "diff") {
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
    ],
  }));

  createEffect(() => {
    // Track the request token so an explicit focus request re-runs this even
    // when the content pane was already active.
    if (!isFocused()) {
      return;
    }
    const overview = overviewScroll();
    if (view()?.kind !== "diff" && overview !== undefined) {
      overview.focus();
      return;
    }
  });

  createEffect(() => {
    prewarmSplitHighlights(patchFileIndex(viewContext.currentPatch()).files);
  });

  createEffect(
    on(
      view,
      (current) => {
        if (current?.kind === "diff") {
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

  function mainViewContent(current: ActiveView): JSX.Element {
    switch (current.kind) {
      case "pr":
        return (
          <scrollbox
            ref={setOverviewScroll}
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            width="100%"
            stickyScroll
            stickyStart="top"
          >
            <OverviewScreen summary={summary} />
          </scrollbox>
        );
      case "commit":
        return (
          <scrollbox
            ref={setOverviewScroll}
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            width="100%"
          >
            <box flexDirection="column" width="100%" gap={1}>
              <CommitMetadata
                sha={current.sha}
                commit={selectedCommitValue()}
                hasFile={false}
                maxWidth={contentWidth()}
              />
              <text fg={colors.yellow}>
                Select a file in the sidebar to view this commit's changes.
              </text>
            </box>
          </scrollbox>
        );
      case "diff":
        return (
          <SelectedDiffBody
            view={current}
            commit={selectedCommitValue()}
            revealLocked={revealLocked()}
            maxWidth={contentWidth()}
            setDiffScroll={setDiffScroll}
          />
        );
    }
  }

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
      gap={1}
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
      <Show when={view()} fallback={<NoPullRequest state={currentState()} />}>
        {(current: Accessor<ActiveView>) => (
          <>
            <PullRequestStatusLine />
            <PrViewHeader
              view={current()}
              repositoryName={headerRepositoryName()}
              titleLine={titleLine()}
              headerKey={headerKey()}
              maxWidth={contentWidth()}
            />
            {mainViewContent(current())}
            <box
              height={1}
              width="100%"
              flexGrow={0}
              flexShrink={0}
              overflow="hidden"
            >
              <text fg={colors.dim} wrapMode="none" truncate>
                {truncateEnd(
                  "j/k scroll · e lock files · x close PR",
                  contentWidth(),
                )}
              </text>
            </box>
          </>
        )}
      </Show>
    </box>
  );
}
