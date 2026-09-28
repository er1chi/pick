import { createEffect, createResource, createSignal, Index } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { useForgeContext } from "@/context/forge-context";
import { readStashes } from "@/services/local/local";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { Pane } from "@/types";
import { EmptyGate } from "./empty-gate";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "solid-js";
import type { GitStash } from "@/services/local/types";
import type { SidebarPaneProps } from "../types";

const maxVisibleRows = 5;

export function StashesBox(props: SidebarPaneProps): JSX.Element {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const isFocused = useFocusedPane(Pane.Stashes);
  const navigation = useNavigateList({ target: box });
  const forgeContext = useForgeContext();
  const [loaded] = createResource(
    () => forgeContext.state().cwd,
    (cwd) => readStashes(cwd),
  );
  const stashes = (): readonly GitStash[] => {
    const result = loaded.latest;
    return result === undefined || result.isErr() ? [] : result.value;
  };
  const emptyText = () => {
    const result = loaded.latest;
    if (result === undefined) {
      return "Loading stashes…";
    }
    return result.isErr() ? "Could not list stashes." : "No stashes.";
  };

  createEffect(() => navigation.setCount(stashes().length));

  useScrollIntoView(() => {
    const ref = stashes()[navigation.index()]?.ref;
    return ref === undefined ? undefined : `stash-${ref}`;
  }, scrollBox);

  return (
    <SidebarBox
      id={Pane.Stashes}
      title="[4] Stashes"
      active={isFocused()}
      boxRef={setBox}
      height={2 + Math.min(maxVisibleRows, Math.max(1, stashes().length))}
      flexShrink={0}
      handleMouseFocus={() => setPane({ active: Pane.Stashes })}
    >
      <EmptyGate hasItems={stashes().length > 0} emptyText={emptyText()}>
        <SidebarScrollBox scrollRef={setScrollBox} hideScrollbar>
          <Index each={stashes()}>
            {(stash, index) => (
              <SelectableRow
                id={`stash-${stash().ref}`}
                selected={isFocused() && index === navigation.index()}
                label={stash().ref}
                detail={stash().message}
                maxWidth={props.rowWidth}
              />
            )}
          </Index>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}
