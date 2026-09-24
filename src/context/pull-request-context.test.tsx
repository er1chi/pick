import { Result } from "better-result";
import { describe, expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { ForgeContextProvider } from "@/context/forge-context";
import {
  PullRequestProvider,
  usePullRequest,
} from "@/context/pull-request-context";
import {
  pullRequestViewId,
  useViewContext,
  ViewContextProvider,
  type ViewContextValue,
} from "@/context/view-context";
import { available } from "@/services/forge/section";
import { ForgeKind } from "@/services/forge/types";

import type { JSX } from "solid-js";
import type { ForgeContextState } from "@/context/forge-context";
import type { PullRequestContextValue } from "@/context/pull-request-context";
import type {
  Forge,
  PullRequestDocument,
  PullRequestPatch,
} from "@/services/forge/types";

const repository = { owner: "octocat", name: "hello" };
const commitA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const commitB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function patch(text: string): ReturnType<typeof available<PullRequestPatch>> {
  return available({ text });
}

const pullRequestDiff = patch("pull-request");
const commitDiffA = patch("commit-a");
const commitDiffB = patch("commit-b");

interface Requests {
  pullRequests: number[];
  commitPatches: string[];
}

function forgeState(requests: Requests): ForgeContextState {
  // SAFETY: The loader only reads `diff` off the settled document.
  const document = { diff: pullRequestDiff } as PullRequestDocument;
  // SAFETY: The loader only calls loadPullRequest and getCommitPatch.
  const forge = {
    async loadPullRequest(number: number) {
      requests.pullRequests.push(number);
      return Result.ok(document);
    },
    async getCommitPatch(sha: string) {
      requests.commitPatches.push(sha);
      return Result.ok(sha === commitA ? commitDiffA : commitDiffB);
    },
  } as Forge;

  return {
    cwd: "/repo",
    kind: ForgeKind.GitHub,
    forge,
    forgeError: undefined,
  };
}

interface Harness {
  readonly view: ViewContextValue;
  readonly pullRequest: PullRequestContextValue;
}

function Probe(props: { readonly ready: (harness: Harness) => void }): null {
  props.ready({
    view: useViewContext(),
    pullRequest: usePullRequest(),
  });
  return null;
}

function mount(requests: Requests) {
  return mountState(forgeState(requests));
}

function mountState(state: ForgeContextState) {
  let harness: Harness | undefined;
  const dispose = createRoot((done) => {
    const tree: JSX.Element = (
      <ForgeContextProvider value={state}>
        <ViewContextProvider>
          <PullRequestProvider>
            <Probe ready={(value) => (harness = value)} />
          </PullRequestProvider>
        </ViewContextProvider>
      </ForgeContextProvider>
    );
    void tree;
    return done;
  });
  if (harness === undefined) {
    dispose();
    throw new Error("pull request harness did not mount");
  }
  return { harness, dispose };
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("pull request loading", () => {
  test("file and commit selection read stored patches", async () => {
    const requests: Requests = { pullRequests: [], commitPatches: [] };
    const { harness, dispose } = mount(requests);
    try {
      harness.view.openPullRequest(repository, 7);
      await settle();

      expect(requests.pullRequests).toEqual([7]);
      expect(harness.pullRequest.data()?.diff).toBe(pullRequestDiff);
      expect(harness.view.currentPatch()).toBe(pullRequestDiff);

      harness.view.selectFile("src/app.tsx");
      await settle();

      expect(requests.pullRequests).toEqual([7]);
      expect(requests.commitPatches).toEqual([]);
      expect(harness.pullRequest.data()?.diff).toBe(pullRequestDiff);
      expect(harness.view.currentPatch()).toBe(pullRequestDiff);
      expect(harness.view.view()?.kind).toBe("diff");

      harness.view.selectCommit(commitA);
      await settle();

      expect(requests.pullRequests).toEqual([7]);
      expect(requests.commitPatches).toEqual([commitA]);
      expect(harness.pullRequest.data()?.diff).toBe(pullRequestDiff);
      expect(harness.view.currentPatch()).toBe(commitDiffA);

      harness.view.selectFile("src/app.tsx");
      await settle();

      expect(requests.commitPatches).toEqual([commitA]);
      expect(harness.view.currentPatch()).toBe(commitDiffA);

      harness.view.clearSelection();
      harness.view.selectCommit(commitA);
      await settle();

      expect(requests.commitPatches).toEqual([commitA]);
      expect(harness.view.currentPatch()).toBe(commitDiffA);

      harness.view.selectCommit(commitB);
      await settle();

      expect(requests.commitPatches).toEqual([commitA, commitB]);
      expect(harness.view.currentPatch()).toBe(commitDiffB);

      harness.view.selectCommit(commitA);
      await settle();

      expect(requests.commitPatches).toEqual([commitA, commitB]);
      expect(harness.view.currentPatch()).toBe(commitDiffA);
      expect(harness.view.view()?.id).toBe(pullRequestViewId(repository, 7));
    } finally {
      dispose();
    }
  });

  test("reselecting the active pull request keeps its loaded patch", async () => {
    const requests: Requests = { pullRequests: [], commitPatches: [] };
    const { harness, dispose } = mount(requests);
    try {
      harness.view.openPullRequest(repository, 7);
      await settle();
      harness.view.selectFile("src/app.tsx");

      harness.view.openPullRequest(repository, 7);
      await settle();

      expect(harness.view.view()).toEqual({
        kind: "pr",
        id: pullRequestViewId(repository, 7),
        number: 7,
      });
      expect(harness.pullRequest.data()?.diff).toBe(pullRequestDiff);
      expect(harness.view.currentPatch()).toBe(pullRequestDiff);
      expect(requests.pullRequests).toEqual([7]);
    } finally {
      dispose();
    }
  });

  test("loading a pull request drops the previous pull request cache", async () => {
    const requests: Requests = { pullRequests: [], commitPatches: [] };
    const pending: Array<(patch: typeof commitDiffA) => void> = [];
    const firstDiff = patch("first-pr");
    const secondDiff = patch("second-pr");
    const firstCommit = patch("first-commit");
    const secondCommit = patch("second-commit");
    // SAFETY: The loader only reads `diff` off the settled document.
    const firstDocument = { diff: firstDiff } as PullRequestDocument;
    // SAFETY: The loader only reads `diff` off the settled document.
    const secondDocument = { diff: secondDiff } as PullRequestDocument;
    // SAFETY: The loader only calls loadPullRequest and getCommitPatch.
    const forge = {
      async loadPullRequest(number: number) {
        requests.pullRequests.push(number);
        return Result.ok(number === 7 ? firstDocument : secondDocument);
      },
      getCommitPatch(sha: string) {
        requests.commitPatches.push(sha);
        return new Promise((resolve) => {
          pending.push((commitPatch) => {
            resolve(Result.ok(commitPatch));
          });
        });
      },
    } as Forge;
    const { harness, dispose } = mountState({
      cwd: "/repo",
      kind: ForgeKind.GitHub,
      forge,
      forgeError: undefined,
    });

    try {
      harness.view.openPullRequest(repository, 7);
      await settle();
      harness.view.selectCommit(commitA);
      await settle();
      const resolveFirst = pending[0];
      if (resolveFirst === undefined) {
        throw new Error("missing commit patch request");
      }

      harness.view.openPullRequest(repository, 8);
      await settle();
      resolveFirst(firstCommit);
      await settle();

      expect(harness.pullRequest.data()?.diff).toBe(secondDiff);
      expect(harness.view.currentPatch()).toBe(secondDiff);
      expect(requests.pullRequests).toEqual([7, 8]);

      harness.view.selectCommit(commitA);
      await settle();
      expect(requests.commitPatches).toEqual([commitA, commitA]);
      expect(harness.view.currentPatch()).toBeUndefined();

      const resolveSecond = pending[1];
      if (resolveSecond === undefined) {
        throw new Error(
          "missing commit patch request for the open pull request",
        );
      }
      resolveSecond(secondCommit);
      await settle();
      expect(harness.view.currentPatch()).toBe(secondCommit);
      expect(requests.pullRequests).toEqual([7, 8]);
    } finally {
      dispose();
    }
  });
});

describe("view context", () => {
  test("closeFile keeps a selected commit and otherwise returns to the pull request", () => {
    const { harness, dispose } = mount({
      pullRequests: [],
      commitPatches: [],
    });
    try {
      harness.view.openPullRequest(repository, 7);
      harness.view.selectCommit("abc");
      harness.view.selectFile("a.ts");
      harness.view.closeFile();
      expect(harness.view.view()).toEqual({
        kind: "commit",
        id: pullRequestViewId(repository, 7),
        number: 7,
        sha: "abc",
      });

      harness.view.clearSelection();
      harness.view.selectFile("a.ts");
      harness.view.closeFile();
      expect(harness.view.view()).toEqual({
        kind: "pr",
        id: pullRequestViewId(repository, 7),
        number: 7,
      });
    } finally {
      dispose();
    }
  });
});
