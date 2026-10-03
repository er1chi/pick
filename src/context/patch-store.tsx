import { createContext, createSignal, useContext } from "solid-js";
import { useViewContext, viewSourceId } from "./view-context";

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
  readonly currentPatch: Accessor<PatchSection | undefined>;
  setPullRequestPatch(patch: PatchSection | undefined): void;
  setLocalPatch(patch: PatchSection | undefined): void;
  setCommitPatch(owner: string, sha: string, patch: PatchSection): void;
  cachedCommitPatch(sha: string): PatchSection | undefined;
  clearCommitPatches(): void;
}

const PatchStore = createContext<PatchStoreValue>();

export function PatchStoreProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const viewContext = useViewContext();
  const ownerId = () => viewSourceId(viewContext.view().source);
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
    if (current.commit !== undefined) {
      return cachedCommitPatch(current.commit);
    }
    return current.source.kind === "local" ? localPatch() : pullRequestPatch();
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
