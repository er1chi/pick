import { useBindings } from "@opentui/keymap/solid";
import { toast } from "@tuiparts/toast/solid";
import { createSignal } from "solid-js";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectableRow } from "@/components/selectable-row";
import { useLocalRepository } from "@/context/local-repository-context";
import { GitBranchNotMergedError } from "@/services/local/types";
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
  const localRepository = useLocalRepository();
  const confirm = useConfirm();
  const loaded = () => localRepository.branches(scope());
  const branches = (): readonly GitBranch[] => {
    const result = loaded();
    return result === undefined || result.isErr() ? [] : result.value;
  };
  const emptyText = () => {
    const result = loaded();
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

  async function deleteLocalBranch(name: string): Promise<void> {
    if (!(await confirm(`Delete branch ${name}?`))) {
      return;
    }
    const deleted = await localRepository.deleteBranch(name, false);
    if (deleted.isOk()) {
      return;
    }
    if (!GitBranchNotMergedError.is(deleted.error)) {
      toast.error(`Could not delete ${name}: ${deleted.error.message}`);
      return;
    }
    if (!(await confirm(`${name} is not fully merged. Delete it anyway?`))) {
      return;
    }
    const forced = await localRepository.deleteBranch(name, true);
    if (forced.isErr()) {
      toast.error(`Could not delete ${name}: ${forced.error.message}`);
    }
  }

  async function deleteHighlighted(): Promise<void> {
    const branch = list.highlighted();
    if (branch === undefined) {
      return;
    }
    if (branch.current) {
      toast.error(`${branch.name} is checked out and can't be deleted.`);
      return;
    }
    if (scope() === "local") {
      await deleteLocalBranch(branch.name);
      return;
    }
    if (await confirm(`Delete remote branch ${branch.name}?`)) {
      await localRepository.deleteRemoteBranch(branch.name);
    }
  }

  useBindings(() => ({
    target: list.target,
    bindings: [
      { key: "l", cmd: () => setScope("local") },
      { key: "r", cmd: () => setScope("remote") },
      { key: "shift+d", cmd: () => void deleteHighlighted() },
    ],
  }));

  return (
    <list.Box
      title={`[5] Branches · ${scope() === "local" ? "Local" : "Remote"}`}
      bottomTitle="[L]ocal [R]emote [D]elete"
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
