import { useBindings } from "@opentui/keymap/solid";
import { createMemo } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { useLocalRepository } from "@/context/local-repository-context";
import { usePullRequest } from "@/context/pull-request-context";
import { useViewContext, viewPullRequest } from "@/context/view-context";
import { useSpinnerFrame } from "@/shared/hooks/use-spinner-frame";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { firstLine } from "@/utils/text";
import { scopedTitle } from "./sidebar-box";
import { useSidebarList } from "./sidebar-list";

import type { JSX } from "solid-js";
import type { GitCommit } from "@/services/local/types";

type CommitRow = Omit<GitCommit, "pushed"> & { readonly pushed?: boolean };

const maxVisibleRows = 13;

const pushedMarker = { text: "✓", color: colors.dim };
const localMarker = { text: "↑", color: colors.yellow };

function pushMarker(commit: CommitRow) {
  if (commit.pushed === undefined) {
    return undefined;
  }
  return commit.pushed ? pushedMarker : localMarker;
}

function commitRowId(commit: CommitRow): string {
  return `commit-${commit.sha}`;
}

interface CommitsBoxProps {
  readonly rowWidth: number;
}

export function CommitsBox(props: CommitsBoxProps): JSX.Element {
  const viewContext = useViewContext();
  const pullRequest = usePullRequest();
  const localRepository = useLocalRepository();
  const opened = () => viewPullRequest(viewContext.view());
  const commits = createMemo<readonly CommitRow[]>(() => {
    const section =
      opened() === undefined
        ? localRepository.commits()
        : pullRequest.data()?.commits;
    return section?.status === "available" ? section.value : [];
  });
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

  const spinnerFrame = useSpinnerFrame(localRepository.pushing);
  const title = () => {
    const scoped = scopedTitle("[1] Commits", opened()?.number);
    return localRepository.pushing() ? `${scoped} ${spinnerFrame()}` : scoped;
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
