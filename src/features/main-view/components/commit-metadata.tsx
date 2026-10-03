import { createMemo, For, Show, type Accessor, type JSX } from "solid-js";
import { usePatchStore } from "@/context/patch-store";
import {
  MutedLine,
  oneLine,
} from "@/features/main-view/components/pr-view-chrome";
import { patchFileIndex } from "@/features/main-view/utils/patch-file-index";
import {
  commitMessage,
  commitMetaLine,
} from "@/features/main-view/utils/pr-view-display";
import { colors } from "@/theme";
import { formatPresentTimestamp } from "@/utils/format-timestamp";
import { presentText, truncateEnd } from "@/utils/text";

import type { PullRequestCommit } from "@/services/forge/types";

function commitMessageLines(
  commit: PullRequestCommit | undefined,
): readonly string[] {
  const message = commit === undefined ? undefined : commitMessage(commit);
  if (message === undefined) {
    return [];
  }
  return message.split(/\r?\n/);
}

interface CommitMetadataProps {
  readonly sha: string;
  readonly commit: PullRequestCommit | undefined;
  readonly hasFile: boolean;
  readonly maxWidth: number;
}

export function CommitMetadata(props: CommitMetadataProps): JSX.Element {
  const patchStore = usePatchStore();
  const counts = createMemo(() => {
    const section = patchStore.cachedCommitPatch(props.sha);
    return section?.status === "available"
      ? patchFileIndex(section).counts
      : undefined;
  });
  const author = () => presentText(props.commit?.author?.login);
  const committer = () => presentText(props.commit?.committer?.login);
  const authoredAt = () => formatPresentTimestamp(props.commit?.authoredAt);
  const committedAt = () => formatPresentTimestamp(props.commit?.committedAt);
  const url = () => presentText(props.commit?.url);

  return (
    <box
      flexDirection="column"
      width="100%"
      gap={0}
      flexGrow={1}
      flexShrink={0}
    >
      <Show when={props.commit}>
        {(commit: Accessor<PullRequestCommit>) => (
          <MutedLine
            line={commitMetaLine(commit(), counts())}
            maxWidth={props.maxWidth}
          />
        )}
      </Show>
      <Show when={props.commit === undefined}>
        {oneLine(
          <text fg={colors.dim} wrapMode="none" truncate>
            {truncateEnd("Loading commit metadata…", props.maxWidth)}
          </text>,
        )}
      </Show>
      <For each={commitMessageLines(props.commit)}>
        {(line) => <text fg={colors.foreground}>{line}</text>}
      </For>
      <MutedLine
        line={author() === undefined ? undefined : `Author: ${author()}`}
        maxWidth={props.maxWidth}
      />
      <MutedLine
        line={
          committer() === undefined ? undefined : `Committer: ${committer()}`
        }
        maxWidth={props.maxWidth}
      />
      <MutedLine
        line={
          authoredAt() === undefined ? undefined : `Authored: ${authoredAt()}`
        }
        maxWidth={props.maxWidth}
      />
      <MutedLine
        line={
          committedAt() === undefined
            ? undefined
            : `Committed: ${committedAt()}`
        }
        maxWidth={props.maxWidth}
      />
      <MutedLine line={url()} maxWidth={props.maxWidth} />
    </box>
  );
}
