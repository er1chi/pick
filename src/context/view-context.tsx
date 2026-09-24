import { createContext, createSignal, useContext } from "solid-js";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type {
  ForgeRepository,
  ForgeSection,
  PullRequestPatch,
} from "@/services/forge/types";

export function pullRequestViewId(
  repository: Pick<ForgeRepository, "owner" | "name">,
  number: number,
): string {
  return `${repository.owner}-${repository.name}-${number}`;
}

interface PullRequestIdentity {
  readonly id: string;
  readonly number: number;
}

export type ActiveView = PullRequestIdentity &
  (
    | { readonly kind: "pr" }
    | { readonly kind: "commit"; readonly sha: string }
    | {
        readonly kind: "diff";
        readonly path: string;
        readonly commit?: string;
      }
  );

/** The commit a view is anchored to, when the view is a commit or a commit diff. */
export function viewCommit(view: ActiveView): string | undefined {
  if (view.kind === "commit") {
    return view.sha;
  }
  if (view.kind === "diff") {
    return view.commit;
  }
  return undefined;
}

export function viewPullRequest(
  view: ActiveView | undefined,
): PullRequestIdentity | undefined {
  if (view === undefined) {
    return undefined;
  }
  return { id: view.id, number: view.number };
}

export interface ViewContextValue {
  readonly view: Accessor<ActiveView | undefined>;
  /**
   * The patch the files pane and the main diff both read. A selected commit
   * uses that commit's patch; otherwise this is the pull request diff.
   */
  readonly currentPatch: Accessor<ForgeSection<PullRequestPatch> | undefined>;
  openPullRequest(
    repository: Pick<ForgeRepository, "owner" | "name">,
    number: number,
  ): void;
  selectCommit(sha: string): void;
  selectFile(path: string): void;
  clearSelection(): void;
  /**
   * Close the open file diff, keeping a selected commit; with no diff
   * open, behaves like clearSelection.
   */
  closeFile(): void;
  close(): void;
  setPullRequestPatch(patch: ForgeSection<PullRequestPatch> | undefined): void;
  /**
   * Store one commit's patch for the open pull request. A result for any other
   * pull request is ignored, so the cache never holds more than one.
   */
  setCommitPatch(
    pullRequestId: string,
    sha: string,
    patch: ForgeSection<PullRequestPatch>,
  ): void;
  cachedCommitPatch(sha: string): ForgeSection<PullRequestPatch> | undefined;
  clearCommitPatches(): void;
}

const ViewContext = createContext<ViewContextValue>();

export function ViewContextProvider(props: {
  readonly initialView?: ActiveView;
  readonly children: JSX.Element;
}): JSX.Element {
  const [view, setView] = createSignal<ActiveView | undefined>(
    props.initialView,
  );
  const [pullRequestPatch, setPullRequestPatch] = createSignal<
    ForgeSection<PullRequestPatch> | undefined
  >();
  const commitPatches = new Map<string, ForgeSection<PullRequestPatch>>();
  let commitPatchOwner: string | undefined;
  const [commitPatchVersion, setCommitPatchVersion] = createSignal(0);

  function currentPatch(): ForgeSection<PullRequestPatch> | undefined {
    const current = view();
    const sha = current === undefined ? undefined : viewCommit(current);
    if (sha !== undefined) {
      commitPatchVersion();
      return commitPatches.get(sha);
    }
    return pullRequestPatch();
  }

  function setCommitPatch(
    pullRequestId: string,
    sha: string,
    patch: ForgeSection<PullRequestPatch>,
  ): void {
    if (viewPullRequest(view())?.id !== pullRequestId) {
      return;
    }
    if (commitPatchOwner !== pullRequestId) {
      commitPatches.clear();
      commitPatchOwner = pullRequestId;
    }
    commitPatches.set(sha, patch);
    setCommitPatchVersion((version) => version + 1);
  }

  function cachedCommitPatch(
    sha: string,
  ): ForgeSection<PullRequestPatch> | undefined {
    commitPatchVersion();
    if (commitPatchOwner !== viewPullRequest(view())?.id) {
      return undefined;
    }
    return commitPatches.get(sha);
  }

  function clearCommitPatches(): void {
    commitPatchOwner = undefined;
    if (commitPatches.size === 0) {
      return;
    }
    commitPatches.clear();
    setCommitPatchVersion((version) => version + 1);
  }

  function openPullRequest(
    repository: Pick<ForgeRepository, "owner" | "name">,
    number: number,
  ): void {
    const id = pullRequestViewId(repository, number);
    if (viewPullRequest(view())?.id !== id) {
      setPullRequestPatch(undefined);
      clearCommitPatches();
    }
    setView({ kind: "pr", id, number });
  }

  function selectCommit(sha: string): void {
    const current = viewPullRequest(view());
    if (current === undefined) {
      return;
    }
    setView({ kind: "commit", id: current.id, number: current.number, sha });
  }

  function selectFile(path: string): void {
    const current = view();
    if (current === undefined) {
      return;
    }
    const commit = viewCommit(current);
    if (commit === undefined) {
      setView({
        kind: "diff",
        id: current.id,
        number: current.number,
        path,
      });
      return;
    }
    setView({
      kind: "diff",
      id: current.id,
      number: current.number,
      path,
      commit,
    });
  }

  function clearSelection(): void {
    const current = viewPullRequest(view());
    if (current === undefined) {
      return;
    }
    setView({ kind: "pr", id: current.id, number: current.number });
  }

  function closeFile(): void {
    const current = view();
    if (current === undefined) {
      return;
    }
    if (current.kind === "diff" && current.commit !== undefined) {
      setView({
        kind: "commit",
        id: current.id,
        number: current.number,
        sha: current.commit,
      });
      return;
    }
    clearSelection();
  }

  function close(): void {
    setPullRequestPatch(undefined);
    clearCommitPatches();
    setView(undefined);
  }

  const context: ViewContextValue = {
    view,
    currentPatch,
    openPullRequest,
    selectCommit,
    selectFile,
    clearSelection,
    closeFile,
    close,
    setPullRequestPatch,
    setCommitPatch,
    cachedCommitPatch,
    clearCommitPatches,
  };

  return (
    <ViewContext.Provider value={context}>
      {props.children}
    </ViewContext.Provider>
  );
}

export function useViewContext(): ViewContextValue {
  const context = useContext(ViewContext);
  if (context === undefined) {
    throw new Error("useViewContext must be used within a ViewContextProvider");
  }
  return context;
}
