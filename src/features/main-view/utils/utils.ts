import { commitMessage } from "@/features/main-view/utils/pr-view-display";

import type { PullRequestCommit } from "@/services/forge/types";

export function commitMessageLines(
  commit: PullRequestCommit | undefined,
): readonly string[] {
  const message = commit === undefined ? undefined : commitMessage(commit);
  if (message === undefined) {
    return [];
  }
  return message.split(/\r?\n/);
}
