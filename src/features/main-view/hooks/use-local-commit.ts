import { createMemo, createResource } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { useViewContext } from "@/context/view-context";
import { readCommitDetails } from "@/services/local/local";

import type { Accessor } from "solid-js";
import type { PullRequestCommit } from "@/services/forge/types";
import type { GitCommitDetails } from "@/services/local/types";

function toPullRequestCommit(details: GitCommitDetails): PullRequestCommit {
  return {
    sha: details.sha,
    message: details.message,
    author: { login: details.authorName },
    committer: { login: details.committerName },
    authoredAt: details.authoredAt,
    committedAt: details.committedAt,
    url: null,
  };
}

/** Metadata for the commit selected in the local view, shaped like a pull
 * request commit so the commit screens render both the same way. */
export function useLocalCommit(): Accessor<PullRequestCommit | undefined> {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const commitSha = createMemo(() => {
    const view = viewContext.view();
    return view.kind === "local" ? view.commit : undefined;
  });
  const [details] = createResource(
    () => {
      const sha = commitSha();
      return sha === undefined
        ? undefined
        : ([forgeContext.state().cwd, sha] as const);
    },
    ([cwd, sha]) => readCommitDetails(cwd, sha),
  );
  return () => {
    const result = details.latest;
    // The previous commit's details stay in the resource while the next one
    // loads; only show details that match the selection.
    if (result === undefined || result.isErr()) {
      return undefined;
    }
    return result.value.sha === commitSha()
      ? toPullRequestCommit(result.value)
      : undefined;
  };
}
