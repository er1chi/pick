import { useBindings } from "@opentui/keymap/solid";
import {
  Index,
  createEffect,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { useForgeContext } from "@/context/forge-context";
import { usePullRequest } from "@/context/pull-request-context";
import {
  useViewContext,
  viewCommit,
  viewPullRequest,
} from "@/context/view-context";
import { readCommits } from "@/services/local/local";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { firstLine } from "@/utils/utils";
import { EmptyGate } from "./empty-gate";
import { scopedTitle, SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "solid-js";
import type { GitCommit } from "@/services/local/types";
import type { SidebarPaneProps } from "../types";

/** A pull request commit, or a local one that knows whether it is pushed. */
type CommitRow = Omit<GitCommit, "pushed"> & { readonly pushed?: boolean };

const pushedMarker = { text: "✓", color: colors.dim };
const localMarker = { text: "↑", color: colors.yellow };

function pushMarker(commit: CommitRow) {
  if (commit.pushed === undefined) {
    return undefined;
  }
  return commit.pushed ? pushedMarker : localMarker;
}

export function CommitsBox(props: SidebarPaneProps): JSX.Element {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(Pane.Commits);
  const navigation = useNavigateList({ target: box });
  const viewContext = useViewContext();
  const pullRequest = usePullRequest();
  const forgeContext = useForgeContext();
  const opened = () => viewPullRequest(viewContext.view());
  // Local history loads only while no pull request is open.
  const [localCommits] = createResource(
    () => (opened() === undefined ? forgeContext.state().cwd : undefined),
    (cwd) => readCommits(cwd),
  );
  const commits = createMemo<readonly CommitRow[]>(() => {
    if (opened() === undefined) {
      const result = localCommits.latest;
      return result === undefined || result.isErr() ? [] : result.value;
    }
    const section = pullRequest.data()?.commits;
    return section?.status === "available" ? section.value : [];
  });

  createEffect(() => navigation.setCount(commits().length));

  useScrollIntoView(() => {
    const sha = commits()[navigation.index()]?.sha;
    return sha === undefined ? undefined : `commit-${sha}`;
  }, scrollBox);

  function activateHighlighted(): void {
    const sha = commits()[navigation.index()]?.sha;
    if (sha !== undefined && opened() !== undefined) {
      viewContext.selectCommit(sha);
      setPane({ active: Pane.Files });
    }
  }

  useBindings(() => ({
    target: box,
    bindings: [{ key: "return", cmd: activateHighlighted }],
  }));

  function boxHeight(): number {
    return Math.min(15, 2 + Math.max(1, commits().length));
  }

  function handleMouseFocus() {
    setPane({ active: Pane.Commits });
  }

  return (
    <SidebarBox
      id={Pane.Commits}
      title={scopedTitle("[1] Commits", opened()?.number)}
      active={isFocused()}
      boxRef={setBox}
      height={boxHeight()}
      flexGrow={0}
      flexShrink={0}
      handleMouseFocus={handleMouseFocus}
    >
      <EmptyGate
        hasItems={commits().length > 0}
        emptyText={opened() === undefined ? "No local commits." : "No commits."}
      >
        <SidebarScrollBox scrollRef={setScrollBox} hideScrollbar>
          <Index each={commits()}>
            {(commit) => {
              const highlighted = () =>
                commit().sha === commits()[navigation.index()]?.sha;
              const active = () => {
                const current = viewContext.view();
                return (
                  current !== undefined && commit().sha === viewCommit(current)
                );
              };
              return (
                <SelectableRow
                  id={`commit-${commit().sha}`}
                  selected={(isFocused() && highlighted()) || active()}
                  label={commit().sha.slice(0, 7)}
                  detail={firstLine(commit().message)}
                  marker={pushMarker(commit())}
                  maxWidth={props.rowWidth - 1}
                />
              );
            }}
          </Index>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}
