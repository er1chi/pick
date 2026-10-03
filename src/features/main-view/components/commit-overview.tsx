import { colors } from "@/theme";
import { useSelectedCommit } from "../hooks/use-selected-commit";
import { CommitMetadata } from "./commit-metadata";

import type { ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "@opentui/solid";

interface CommitOverviewProps {
  readonly sha: string;
  readonly maxWidth: number;
  readonly scrollRef: (target: ScrollBoxRenderable | undefined) => void;
}

/** A selected commit with no file open: its metadata and a prompt to pick a
 * file. */
export function CommitOverview(props: CommitOverviewProps): JSX.Element {
  const commit = useSelectedCommit();
  return (
    <scrollbox
      ref={props.scrollRef}
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
      width="100%"
    >
      <box flexDirection="column" width="100%" gap={1}>
        <CommitMetadata
          sha={props.sha}
          commit={commit()}
          hasFile={false}
          maxWidth={props.maxWidth}
        />
        <text fg={colors.yellow}>
          Select a file in the sidebar to view this commit's changes.
        </text>
      </box>
    </scrollbox>
  );
}
