import { useBindings } from "@opentui/keymap/solid";
import { createEffect, createResource, createSignal, Index } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { PaneStore } from "@/context/active-pane-context";
import { useForgeContext } from "@/context/forge-context";
import { readBranches } from "@/services/local/local";
import { useFocusedPane } from "@/shared/hooks/use-focused-pane";
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { Pane } from "@/types";
import { EmptyGate } from "./empty-gate";
import { SidebarBox, SidebarScrollBox } from "./sidebar-box";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "solid-js";
import type { GitBranch, GitBranchScope } from "@/services/local/types";
import type { SidebarPaneProps } from "../types";

const maxVisibleRows = 8;

export function BranchesBox(props: SidebarPaneProps): JSX.Element {
  const [box, setBox] = createSignal<BoxRenderable>();
  const [scrollBox, setScrollBox] = createSignal<ScrollBoxRenderable>();
  const [_pane, setPane] = PaneStore.use();
  const [scope, setScope] = createSignal<GitBranchScope>("local");
  const isFocused = useFocusedPane(Pane.Branches);
  const navigation = useNavigateList({ target: box });
  const forgeContext = useForgeContext();
  const [loaded] = createResource(
    () => ({ cwd: forgeContext.state().cwd, scope: scope() }),
    (source) => readBranches(source.cwd, source.scope),
  );
  const branches = (): readonly GitBranch[] => {
    const result = loaded.latest;
    return result === undefined || result.isErr() ? [] : result.value;
  };
  const emptyText = () => {
    const result = loaded.latest;
    if (result === undefined) {
      return "Loading branches…";
    }
    return result.isErr()
      ? "Could not list branches."
      : `No ${scope()} branches.`;
  };

  createEffect(() => navigation.setCount(branches().length));

  useScrollIntoView(() => {
    const name = branches()[navigation.index()]?.name;
    return name === undefined ? undefined : `branch-${name}`;
  }, scrollBox);

  useBindings(() => ({
    target: box,
    bindings: [
      { key: "l", cmd: () => setScope("local") },
      { key: "r", cmd: () => setScope("remote") },
    ],
  }));

  return (
    <SidebarBox
      id={Pane.Branches}
      title={`[5] Branches · ${scope() === "local" ? "Local" : "Remote"}`}
      bottomTitle="[L]ocal [R]emote"
      bottomTitleAlignment="right"
      active={isFocused()}
      boxRef={setBox}
      height={2 + Math.min(maxVisibleRows, Math.max(1, branches().length))}
      flexShrink={0}
      handleMouseFocus={() => setPane({ active: Pane.Branches })}
    >
      <EmptyGate hasItems={branches().length > 0} emptyText={emptyText()}>
        <SidebarScrollBox scrollRef={setScrollBox} hideScrollbar>
          <Index each={branches()}>
            {(branch, index) => (
              <SelectableRow
                id={`branch-${branch().name}`}
                selected={isFocused() && index === navigation.index()}
                label={`${branch().current ? "*" : " "} ${branch().name}`}
                maxWidth={props.rowWidth}
              />
            )}
          </Index>
        </SidebarScrollBox>
      </EmptyGate>
    </SidebarBox>
  );
}
