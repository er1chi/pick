import { useBindings } from "@opentui/keymap/solid";
import { toast } from "@tuiparts/toast/solid";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectableRow } from "@/components/selectable-row";
import { useLocalRepository } from "@/context/local-repository-context";
import { Pane } from "@/types";
import { useSidebarList } from "./sidebar-list";

import type { JSX } from "solid-js";
import type { GitStash } from "@/services/local/types";

const maxVisibleRows = 5;

function stashRowId(stash: GitStash): string {
  return `stash-${stash.ref}`;
}

interface StashesBoxProps {
  readonly rowWidth: number;
}

export function StashesBox(props: StashesBoxProps): JSX.Element {
  const localRepository = useLocalRepository();
  const confirm = useConfirm();
  const stashes = (): readonly GitStash[] => {
    const result = localRepository.stashes();
    return result === undefined || result.isErr() ? [] : result.value;
  };
  const emptyText = () => {
    const result = localRepository.stashes();
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

  async function dropHighlighted(): Promise<void> {
    const stash = list.highlighted();
    if (stash === undefined || !(await confirm(`Drop ${stash.ref}?`))) {
      return;
    }
    const dropped = await localRepository.dropStash(stash.ref);
    if (dropped.isErr()) {
      toast.error(`Could not drop ${stash.ref}: ${dropped.error.message}`);
    }
  }

  useBindings(() => ({
    target: list.target,
    bindings: [{ key: "shift+d", cmd: () => void dropHighlighted() }],
  }));

  return (
    <list.Box
      title="[4] Stashes"
      bottomTitle="[D]elete"
      bottomTitleAlignment="right"
      maxVisibleRows={maxVisibleRows}
    >
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
