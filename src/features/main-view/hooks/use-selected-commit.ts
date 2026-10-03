import { createMemo } from "solid-js";
import { useLocalRepository } from "@/context/local-repository-context";
import { usePullRequest } from "@/context/pull-request-context";
import { useViewContext } from "@/context/view-context";

import type { Accessor } from "solid-js";
import type { PullRequestCommit } from "@/services/forge/types";

export function useSelectedCommit(): Accessor<PullRequestCommit | undefined> {
  const viewContext = useViewContext();
  const pullRequest = usePullRequest();
  const localRepository = useLocalRepository();
  return createMemo(() => {
    const view = viewContext.view();
    const sha = view.commit;
    if (sha === undefined) {
      return undefined;
    }
    const section =
      view.source.kind === "local"
        ? localRepository.commits()
        : pullRequest.data()?.commits;
    const commits = section?.status === "available" ? section.value : [];
    return commits.find((commit) => commit.sha === sha);
  });
}
