import { useBindings } from "@opentui/keymap/solid";
import { mainViewCommit } from "@/features/pr-view/use-pr-view-content";
import { SelectableRow } from "@/features/shared/selectable-row";
import {
  EmptyGate,
  SidebarBox,
  SidebarScrollBox,
  firstLine,
  useFocusWhenActive,
  useScrollIntoView,
  useSidebarPane,
  type SidebarPaneProps,
} from "@/features/sidebar/sidebar-box";
import type { PullRequestCommit } from "@/services/forge/types";
import { colors } from "@/theme";
import { For, createEffect, createMemo, createSignal } from "solid-js";
import type { JSX } from "solid-js";

export function CommitsBox(props: SidebarPaneProps): JSX.Element {
  const { pane, box, setBox, scrollBox, setScrollBox, focused } =
    useSidebarPane("commits");
  // Keyboard focus inside the list is local and never activates the commit on
  // its own; `content.view()` only changes on an explicit Enter.
  const [highlightedSha, setHighlightedSha] = createSignal<string>();
  const opened = () => props.titles.openedNumber() !== null;
  const commits = createMemo<readonly PullRequestCommit[]>(() =>
    opened() ? props.content.commits() : [],
  );

  // Keep exactly one row highlighted: start on the first row without selecting
  // it, and recover when the list changes or drops the highlighted commit.
  createEffect(() => {
    const list = commits();
    const current = highlightedSha();
    if (list.length === 0) {
      if (current !== undefined) {
        setHighlightedSha(undefined);
      }
      return;
    }
    if (!list.some((commit) => commit.sha === current)) {
      setHighlightedSha(list[0]?.sha);
    }
  });

  useScrollIntoView(() => {
    const sha = highlightedSha();
    return sha === undefined ? undefined : `commit-${sha}`;
  }, scrollBox);

  function moveHighlight(offset: number): void {
    const list = commits();
    if (list.length === 0) {
      return;
    }
    const index = list.findIndex((commit) => commit.sha === highlightedSha());
    const next = Math.min(
      Math.max((index < 0 ? 0 : index) + offset, 0),
      list.length - 1,
    );
    setHighlightedSha(list[next]?.sha);
  }

  function activateHighlighted(): void {
    const sha = highlightedSha();
    if (sha !== undefined) {
      props.content.selectCommit(sha);
    }
  }

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "j", cmd: () => moveHighlight(1) },
      { key: "down", cmd: () => moveHighlight(1) },
      { key: "k", cmd: () => moveHighlight(-1) },
      { key: "up", cmd: () => moveHighlight(-1) },
      { key: "return", cmd: activateHighlighted },
    ],
  }));

  useFocusWhenActive(focused, () => pane.focusRequest, box);

  // Content-sized like the Pull Requests box: a fixed height stops the box
  // from claiming an equal flex share, while flexShrink lets a constrained
  // terminal squeeze it and the scrollbox still has a definite height to
  // scroll in. The constant two rows are the border; the empty, loading, and
  // failed states all render a single row.
  function bodyRowCount(): number {
    const count = commits().length;
    return count === 0 ? 1 : count;
  }

  return (
    <SidebarBox
      title="[1] Commits"
      active={focused()}
      boxRef={setBox}
      grow={0}
      height={2 + bodyRowCount()}
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
              const highlighted = () => commit.sha === highlightedSha();
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
