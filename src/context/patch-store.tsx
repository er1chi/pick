import { createContext, createSignal, useContext } from "solid-js";
import { useViewContext, viewCommit, viewPullRequest } from "./view-context";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ForgeSection, PullRequestPatch } from "@/services/forge/types";

type PatchSection = ForgeSection<PullRequestPatch>;

interface CommitPatchCache {
  readonly owner: string | undefined;
  readonly patches: ReadonlyMap<string, PatchSection>;
}

const emptyCommitPatches: CommitPatchCache = {
  owner: undefined,
  patches: new Map(),
};

export interface PatchStoreValue {
  /**
   * The patch the files pane and the main diff both read. A selected commit
   * uses that commit's patch; otherwise this is the pull request diff, or the
   * uncommitted changes in the local view.
   */
  readonly currentPatch: Accessor<PatchSection | undefined>;
  setPullRequestPatch(patch: PatchSection | undefined): void;
  setLocalPatch(patch: PatchSection | undefined): void;
  /**
   * Store one commit's patch for the open pull request. A result for any other
   * pull request is ignored, so the cache never holds more than one.
   */
  setCommitPatch(pullRequestId: string, sha: string, patch: PatchSection): void;
  cachedCommitPatch(sha: string): PatchSection | undefined;
  clearCommitPatches(): void;
}

const PatchStore = createContext<PatchStoreValue>();

/** Holds the patches the loaders fetch, separate from what is being viewed. */
export function PatchStoreProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const viewContext = useViewContext();
  const openedId = () => viewPullRequest(viewContext.view())?.id;
  const [pullRequestPatch, setPullRequestPatch] = createSignal<
    PatchSection | undefined
  >();
  const [localPatch, setLocalPatch] = createSignal<PatchSection | undefined>();
  const [commitPatches, setCommitPatches] =
    createSignal<CommitPatchCache>(emptyCommitPatches);

  function cachedCommitPatch(sha: string): PatchSection | undefined {
    const cache = commitPatches();
    return cache.owner === openedId() ? cache.patches.get(sha) : undefined;
  }

  function setCommitPatch(
    pullRequestId: string,
    sha: string,
    patch: PatchSection,
  ): void {
    if (openedId() !== pullRequestId) {
      return;
    }
    setCommitPatches((cache) => ({
      owner: pullRequestId,
      patches: new Map(
        cache.owner === pullRequestId ? cache.patches : undefined,
      ).set(sha, patch),
    }));
  }

  function currentPatch(): PatchSection | undefined {
    const current = viewContext.view();
    if (current.kind === "local") {
      return localPatch();
    }
    const sha = viewCommit(current);
    return sha === undefined ? pullRequestPatch() : cachedCommitPatch(sha);
  }

  const store: PatchStoreValue = {
    currentPatch,
    setPullRequestPatch,
    setLocalPatch,
    setCommitPatch,
    cachedCommitPatch,
    clearCommitPatches: () => setCommitPatches(emptyCommitPatches),
  };

  return (
    <PatchStore.Provider value={store}>{props.children}</PatchStore.Provider>
  );
}

export function usePatchStore(): PatchStoreValue {
  const context = useContext(PatchStore);
  if (context === undefined) {
    throw new Error("usePatchStore must be used within a PatchStoreProvider");
  }
  return context;
}
