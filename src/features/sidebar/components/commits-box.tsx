import { useBindings } from "@opentui/keymap/solid";
import { Index, createEffect, createMemo, createSignal } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { usePullRequest } from "@/context/pull-request-context";
import { useViewContext, viewCommit } from "@/context/view-context";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { Pane } from "@/types";
import { firstLine } from "@/utils/utils";
import { EmptyGate } from "./empty-gate";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "solid-js";
import type { PullRequestCommit } from "@/services/forge/types";
import type { SidebarPaneProps } from "../types";

export function CommitsBox(props: SidebarPaneProps): JSX.Element {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(Pane.Commits);
  const navigation = useNavigateList({ target: box });
  const viewContext = useViewContext();
  const pullRequest = usePullRequest();
  const opened = () => viewContext.view() !== undefined;
  const commits = createMemo<readonly PullRequestCommit[]>(() => {
    if (!opened()) {
      return [];
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
    if (sha !== undefined) {
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
      title="[1] Commits"
      active={isFocused()}
      boxRef={setBox}
      height={boxHeight()}
      flexGrow={0}
      flexShrink={0}
      handleMouseFocus={handleMouseFocus}
    >
      <EmptyGate
        opened={opened()}
        hasItems={commits().length > 0}
        emptyText="No commits."
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
                  selected={highlighted() || active()}
                  label={commit().sha.slice(0, 7)}
                  detail={firstLine(commit().message)}
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
