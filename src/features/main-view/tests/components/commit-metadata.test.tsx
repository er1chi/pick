import { testRender } from "@opentui/solid";
import { describe, expect, test } from "bun:test";
import { onMount, type JSX } from "solid-js";
import {
  PatchStoreProvider,
  usePatchStore,
  type PatchStoreValue,
} from "@/context/patch-store";
import {
  pullRequestViewId,
  ViewContextProvider,
  pullRequestView,
} from "@/context/view-context";
import { CommitMetadata } from "@/features/main-view/components/commit-metadata";
import { available } from "@/services/forge/section";

import type {
  PullRequestCommit,
  PullRequestPatch,
} from "@/services/forge/types";

const SHA = "abcdef1234567890";
const pullRequestId = pullRequestViewId({ owner: "octocat", name: "hello" }, 1);
const openPullRequest = pullRequestView({ owner: "octocat", name: "hello" }, 1);

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
  readonly ready: (patches: PatchStoreValue) => void;
}): JSX.Element {
  return (
    <ViewContextProvider initialView={openPullRequest}>
      <PatchStoreProvider>
        <ReadyProbe ready={props.ready} />
        <CommitMetadata
          sha={SHA}
          commit={commit}
          hasFile={false}
          maxWidth={80}
        />
      </PatchStoreProvider>
    </ViewContextProvider>
  );
}

function ReadyProbe(props: {
  readonly ready: (patches: PatchStoreValue) => void;
}): null {
  const patches = usePatchStore();
  onMount(() => props.ready(patches));
  return null;
}

describe("CommitMetadata", () => {
  test("shows +/- counts when the commit patch arrives after mount", async () => {
    let patches: PatchStoreValue | undefined;
    const setup = await testRender(
      () => <CommitMetadataHarness ready={(value) => (patches = value)} />,
      { width: 80, height: 12 },
    );

    try {
      await setup.waitFor(() => patches !== undefined);
      expect(setup.captureCharFrame()).not.toContain("+");

      if (patches === undefined) {
        throw new Error("commit metadata harness did not mount");
      }

      patches.setCommitPatch(
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
