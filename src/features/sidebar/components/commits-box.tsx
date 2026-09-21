import { useBindings } from "@opentui/keymap/solid";
import { For, createEffect, createMemo, createSignal } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { mainViewCommit } from "@/features/pr-view/use-pr-view-content";
import { useNavigateList } from "@/hooks/use-navigate-list";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { colors } from "@/theme";
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
  const opened = () => props.titles.openedNumber() !== null;
  const commits = createMemo<readonly PullRequestCommit[]>(() =>
    opened() ? props.content.commits() : [],
  );

  createEffect(() => navigation.setCount(commits().length));

  useScrollIntoView(() => {
    const sha = commits()[navigation.index()]?.sha;
    return sha === undefined ? undefined : `commit-${sha}`;
  }, scrollBox);

  function activateHighlighted(): void {
    const sha = commits()[navigation.index()]?.sha;
    if (sha !== undefined) {
      props.content.selectCommit(sha);
    }
  }

  useBindings(() => ({
    target: box,
    bindings: [{ key: "return", cmd: activateHighlighted }],
  }));

  // Content-sized like the Pull Requests box: a fixed height stops the box
  // from claiming an equal flex share, while flexShrink lets a constrained
  // terminal squeeze it and the scrollbox still has a definite height to
  // scroll in. The constant two rows are the border; the empty, loading, and
  // failed states all render a single row.
  function bodyRowCount(): number {
    const count = commits().length;
    return count === 0 ? 1 : count;
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
      grow={0}
      height={Math.min(15, 2 + bodyRowCount())}
      flexShrink={0}
      handleMouseFocus={handleMouseFocus}
    >
      <EmptyGate
        opened={opened()}
        hasItems={commits().length > 0}
        emptyText="No commits."
      >
        <SidebarScrollBox scrollRef={setScrollBox}>
          <For each={commits()}>
            {(commit) => {
              // Accessors, not const booleans: computing these eagerly inside
              // the <For> callback would snapshot the signals once per item,
              // so j/k highlight changes would never re-render the rows.
              const highlighted = () =>
                commit.sha === commits()[navigation.index()]?.sha;
              const active = () =>
                commit.sha === mainViewCommit(props.content.view());
              return (
                <box
                  width="100%"
                  flexDirection="row"
                  flexShrink={0}
                  backgroundColor={active() ? colors.selected : undefined}
                >
                  {/* A persistent accent marks the activated commit even once
                      the keyboard highlight or pane focus moves elsewhere. */}
                  <box
                    width={1}
                    flexShrink={0}
                    backgroundColor={active() ? colors.blue : undefined}
                  />
                  <box flexGrow={1} flexShrink={1} minWidth={0}>
                    <SelectableRow
                      id={`commit-${commit.sha}`}
                      selected={highlighted() || active()}
                      label={commit.sha.slice(0, 7)}
                      detail={firstLine(commit.message)}
                      maxWidth={props.rowWidth - 1}
                    />
                  </box>
                </box>
              );
            }}
          </For>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}
