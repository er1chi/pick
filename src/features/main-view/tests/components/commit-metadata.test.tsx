import { testRender } from "@opentui/solid";
import { describe, expect, test } from "bun:test";
import { onMount, type JSX } from "solid-js";
import {
  pullRequestViewId,
  useViewContext,
  ViewContextProvider,
  type ActiveView,
  type ViewContextValue,
} from "@/context/view-context";
import { CommitMetadata } from "@/features/main-view/components/commit-metadata";
import { available } from "@/services/forge/section";

import type {
  PullRequestCommit,
  PullRequestPatch,
} from "@/services/forge/types";

const SHA = "abcdef1234567890";
const pullRequestId = pullRequestViewId({ owner: "octocat", name: "hello" }, 1);
const openPullRequest: ActiveView = {
  kind: "pr",
  id: pullRequestId,
  number: 1,
};

const commit: PullRequestCommit = {
  sha: SHA,
  message: "adjust files",
  author: null,
  committer: null,
  authoredAt: null,
  committedAt: null,
  url: null,
};

const patchText = `diff --git a/meta.txt b/meta.txt
index 1111111..2222222 100644
--- a/meta.txt
+++ b/meta.txt
@@ -1,2 +1,3 @@
 stay
-old
+new-one
+new-two
`;

function CommitMetadataHarness(props: {
  readonly ready: (view: ViewContextValue) => void;
}): JSX.Element {
  return (
    <ViewContextProvider initialView={openPullRequest}>
      <ReadyProbe ready={props.ready} />
      <CommitMetadata sha={SHA} commit={commit} hasFile={false} maxWidth={80} />
    </ViewContextProvider>
  );
}

function ReadyProbe(props: {
  readonly ready: (view: ViewContextValue) => void;
}): null {
  const view = useViewContext();
  onMount(() => props.ready(view));
  return null;
}

describe("CommitMetadata", () => {
  test("shows +/- counts when the commit patch arrives after mount", async () => {
    let view: ViewContextValue | undefined;
    const setup = await testRender(
      () => <CommitMetadataHarness ready={(value) => (view = value)} />,
      { width: 80, height: 12 },
    );

    try {
      await setup.waitFor(() => view !== undefined);
      expect(setup.captureCharFrame()).not.toContain("+");

      if (view === undefined) {
        throw new Error("commit metadata harness did not mount");
      }

      view.setCommitPatch(
        pullRequestId,
        SHA,
        available<PullRequestPatch>({ text: patchText }),
      );

      await setup.waitForFrame((frame) => frame.includes("+2 -1"));
      expect(setup.captureCharFrame()).toContain("+2 -1");
    } finally {
      setup.renderer.destroy();
    }
  });
});
