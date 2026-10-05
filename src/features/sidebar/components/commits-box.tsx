import { useBindings } from "@opentui/keymap/solid";
import { SelectableRow } from "@/components/selectable-row";
import { useLocalRepository } from "@/context/local-repository-context";
import { useViewContext, viewPullRequest } from "@/context/view-context";
import { useSourceCommits } from "@/shared/hooks/use-source-commits";
import { useSpinnerFrame } from "@/shared/hooks/use-spinner-frame";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { firstLine } from "@/utils/text";
import { scopedTitle } from "./sidebar-box";
import { useSidebarList } from "./sidebar-list";

import type { JSX } from "solid-js";
import type { SourceCommit } from "@/shared/hooks/use-source-commits";

const maxVisibleRows = 13;

const pushedMarker = { text: "✓", color: colors.dim };
const localMarker = { text: "↑", color: colors.yellow };

function pushMarker(commit: SourceCommit) {
  if (commit.pushed === undefined) {
    return undefined;
  }
  return commit.pushed ? pushedMarker : localMarker;
}

function commitRowId(commit: SourceCommit): string {
  return `commit-${commit.sha}`;
}

interface CommitsBoxProps {
  readonly rowWidth: number;
}

export function CommitsBox(props: CommitsBoxProps): JSX.Element {
  const viewContext = useViewContext();
  const localRepository = useLocalRepository();
  const opened = () => viewPullRequest(viewContext.view());
  const commits = useSourceCommits();
  const list = useSidebarList({
    pane: Pane.Commits,
    items: commits,
    rowId: commitRowId,
  });

  function activateHighlighted(): void {
    const sha = list.highlighted()?.sha;
    if (sha !== undefined) {
      viewContext.selectCommit(sha);
      list.focus(Pane.Files);
    }
  }

  function pushLocalCommits(): void {
    if (opened() === undefined && localRepository.hasUnpushedCommits()) {
      void localRepository.push();
    }
  }

  const pushing = () => localRepository.pushLog.status === "running";
  const spinnerFrame = useSpinnerFrame(pushing);
  const title = () => {
    const scoped = scopedTitle("[1] Commits", opened()?.number);
    return pushing() ? `${scoped} ${spinnerFrame()}` : scoped;
  };

  useBindings(() => ({
    target: list.target,
    bindings: [
      { key: "return", cmd: activateHighlighted },
      { key: "shift+p", cmd: pushLocalCommits },
    ],
  }));

  return (
    <list.Box title={title()} maxVisibleRows={maxVisibleRows} flexGrow={0}>
      <list.Rows
        emptyText={opened() === undefined ? "No local commits." : "No commits."}
      >
        {(commit) => {
          const highlighted = () => commit().sha === list.highlighted()?.sha;
          const active = () => commit().sha === viewContext.view().commit;
          return (
            <SelectableRow
              id={commitRowId(commit())}
              selected={(list.isFocused() && highlighted()) || active()}
              label={commit().sha.slice(0, 7)}
              detail={firstLine(commit().message)}
              marker={pushMarker(commit())}
              maxWidth={props.rowWidth - 1}
            />
          );
        }}
      </list.Rows>
    </list.Box>
  );
}
