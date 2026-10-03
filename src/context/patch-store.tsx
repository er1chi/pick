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

/** Cache owner for commit patches read from the local repository. */
export const localCommitPatchOwner = "local";

const emptyCommitPatches: CommitPatchCache = {
  owner: undefined,
  patches: new Map(),
};

export interface PatchStoreValue {
  /**
   * The patch the files pane and the main diff both read. A selected commit
   * uses that commit's patch; otherwise this is the pull request diff, or
   * the working tree diff in the local view.
   */
  readonly currentPatch: Accessor<PatchSection | undefined>;
  setPullRequestPatch(patch: PatchSection | undefined): void;
  setLocalPatch(patch: PatchSection | undefined): void;
  /**
   * Store one commit's patch for the open pull request, or for the local
   * repository under `localCommitPatchOwner`. A result for any other owner is
   * ignored, so the cache never holds more than one.
   */
  setCommitPatch(owner: string, sha: string, patch: PatchSection): void;
  cachedCommitPatch(sha: string): PatchSection | undefined;
  clearCommitPatches(): void;
}

const PatchStore = createContext<PatchStoreValue>();

export function PatchStoreProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const viewContext = useViewContext();
  const ownerId = () =>
    viewPullRequest(viewContext.view())?.id ?? localCommitPatchOwner;
  const [pullRequestPatch, setPullRequestPatch] = createSignal<
    PatchSection | undefined
  >();
  const [localPatch, setLocalPatch] = createSignal<PatchSection | undefined>();
  const [commitPatches, setCommitPatches] =
    createSignal<CommitPatchCache>(emptyCommitPatches);

  function cachedCommitPatch(sha: string): PatchSection | undefined {
    const cache = commitPatches();
    return cache.owner === ownerId() ? cache.patches.get(sha) : undefined;
  }

  function setCommitPatch(
    owner: string,
    sha: string,
    patch: PatchSection,
  ): void {
    if (ownerId() !== owner) {
      return;
    }
    setCommitPatches((cache) => ({
      owner,
      patches: new Map(cache.owner === owner ? cache.patches : undefined).set(
        sha,
        patch,
      ),
    }));
  }

  function currentPatch(): PatchSection | undefined {
    const current = viewContext.view();
    const sha = viewCommit(current);
    if (sha !== undefined) {
      return cachedCommitPatch(sha);
    }
    return current.kind === "local" ? localPatch() : pullRequestPatch();
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
