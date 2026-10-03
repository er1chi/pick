import { useBindings } from "@opentui/keymap/solid";
import { createResource, createSignal } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { useForgeContext } from "@/context/forge-context";
import { readBranches } from "@/services/local/local";
import { Pane } from "@/types";
import { useSidebarList } from "./sidebar-list";

import type { JSX } from "solid-js";
import type { GitBranch, GitBranchScope } from "@/services/local/types";

const maxVisibleRows = 8;

function branchRowId(branch: GitBranch): string {
  return `branch-${branch.name}`;
}

interface BranchesBoxProps {
  readonly rowWidth: number;
}

export function BranchesBox(props: BranchesBoxProps): JSX.Element {
  const [scope, setScope] = createSignal<GitBranchScope>("local");
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
  const list = useSidebarList({
    pane: Pane.Branches,
    items: branches,
    rowId: branchRowId,
  });

  useBindings(() => ({
    target: list.target,
    bindings: [
      { key: "l", cmd: () => setScope("local") },
      { key: "r", cmd: () => setScope("remote") },
    ],
  }));

  return (
    <list.Box
      title={`[5] Branches · ${scope() === "local" ? "Local" : "Remote"}`}
      bottomTitle="[L]ocal [R]emote"
      bottomTitleAlignment="right"
      maxVisibleRows={maxVisibleRows}
    >
      <list.Rows emptyText={emptyText()}>
        {(branch, index) => (
          <SelectableRow
            id={branchRowId(branch())}
            selected={list.isHighlighted(index)}
            label={`${branch().current ? "*" : " "} ${branch().name}`}
            maxWidth={props.rowWidth}
          />
        )}
      </list.Rows>
    </list.Box>
  );
}
