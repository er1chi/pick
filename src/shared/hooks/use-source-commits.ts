import { createMemo } from "solid-js";
import { useLocalRepository } from "@/context/local-repository-context";
import { usePullRequest } from "@/context/pull-request-context";
import { useViewContext } from "@/context/view-context";

import type { Accessor } from "solid-js";
import type { PullRequestCommit } from "@/services/forge/types";

export type SourceCommit = PullRequestCommit & { readonly pushed?: boolean };

export function useSourceCommits(): Accessor<readonly SourceCommit[]> {
  const viewContext = useViewContext();
  const pullRequest = usePullRequest();
  const localRepository = useLocalRepository();
  return createMemo(() => {
    if (viewContext.view().source.kind === "local") {
      const section = localRepository.commits();
      return section?.status === "available" ? section.value : [];
    }
    const section = pullRequest.data()?.commits;
    return section?.status === "available" ? section.value.toReversed() : [];
  });
}
