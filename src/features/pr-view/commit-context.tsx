import { For, Show, type Accessor, type JSX } from "solid-js";
import { oneLine, renderMutedLine } from "@/features/pr-view/pr-view-chrome";
import {
  commitMessage,
  commitMetaLine,
} from "@/features/pr-view/pr-view-display";
import { colors } from "@/theme";
import { formatPresentTimestamp } from "@/utils/format-timestamp";
import { presentText } from "@/utils/present-text";
import { truncateEnd } from "@/utils/truncate";

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

interface CommitContextProps {
  readonly sha: string;
  readonly commit: PullRequestCommit | undefined;
  readonly hasFile: boolean;
  readonly maxWidth: number;
}

export function CommitContext(props: CommitContextProps): JSX.Element {
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
      flexGrow={0}
      flexShrink={0}
    >
      {oneLine(
        <text fg={colors.foreground} wrapMode="none" truncate>
          <strong>{truncateEnd(`Commit ${props.sha}`, props.maxWidth)}</strong>
        </text>,
      )}
      <Show when={props.commit}>
        {(commit: Accessor<PullRequestCommit>) =>
          renderMutedLine(commitMetaLine(commit()), props.maxWidth)
        }
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
      {renderMutedLine(
        author() === undefined ? undefined : `Author: ${author()}`,
        props.maxWidth,
      )}
      {renderMutedLine(
        committer() === undefined ? undefined : `Committer: ${committer()}`,
        props.maxWidth,
      )}
      {renderMutedLine(
        authoredAt() === undefined ? undefined : `Authored: ${authoredAt()}`,
        props.maxWidth,
      )}
      {renderMutedLine(
        committedAt() === undefined ? undefined : `Committed: ${committedAt()}`,
        props.maxWidth,
      )}
      {renderMutedLine(url(), props.maxWidth)}
      <Show when={props.hasFile}>
        {oneLine(
          <text fg={colors.dim} wrapMode="none" truncate>
            {truncateEnd("The diff below is from this commit.", props.maxWidth)}
          </text>,
        )}
      </Show>
    </box>
  );
}
