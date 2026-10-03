import { createResource } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { useForgeContext } from "@/context/forge-context";
import { readStashes } from "@/services/local/local";
import { Pane } from "@/types";
import { useSidebarList } from "./sidebar-list";

import type { JSX } from "solid-js";
import type { GitStash } from "@/services/local/types";
import type { SidebarPaneProps } from "../types";

const maxVisibleRows = 5;

function stashRowId(stash: GitStash): string {
  return `stash-${stash.ref}`;
}

export function StashesBox(props: SidebarPaneProps): JSX.Element {
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
  const list = useSidebarList({
    pane: Pane.Stashes,
    items: stashes,
    rowId: stashRowId,
  });

  return (
    <list.Box title="[4] Stashes" maxVisibleRows={maxVisibleRows}>
      <list.Rows emptyText={emptyText()}>
        {(stash, index) => (
          <SelectableRow
            id={stashRowId(stash())}
            selected={list.isHighlighted(index)}
            label={stash().ref}
            detail={stash().message}
            maxWidth={props.rowWidth}
          />
        )}
      </list.Rows>
    </list.Box>
  );
}
