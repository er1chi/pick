import { createMemo } from "solid-js";
import { useViewContext } from "@/context/view-context";
import { useSourceCommits } from "@/shared/hooks/use-source-commits";

import type { Accessor } from "solid-js";
import type { PullRequestCommit } from "@/services/forge/types";

export function useSelectedCommit(): Accessor<PullRequestCommit | undefined> {
  const viewContext = useViewContext();
  const commits = useSourceCommits();
  return createMemo(() => {
    const sha = viewContext.view().commit;
    return sha === undefined
      ? undefined
      : commits().find((commit) => commit.sha === sha);
  });
}
