import { createContext, createSignal, useContext } from "solid-js";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ForgeRepository } from "@/services/forge/types";

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

export type PullRequestView = PullRequestIdentity &
  (
    | { readonly kind: "pr" }
    | { readonly kind: "commit"; readonly sha: string }
    | {
        readonly kind: "diff";
        readonly path: string;
        readonly commit?: string;
      }
  );

/** Local changes, with the uncommitted file whose diff is open, if any. */
interface LocalView {
  readonly kind: "local";
  readonly file: string | undefined;
}

export type ActiveView = LocalView | PullRequestView;

const localView: LocalView = { kind: "local", file: undefined };

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
  view: ActiveView,
): PullRequestIdentity | undefined {
  if (view.kind === "local") {
    return undefined;
  }
  return { id: view.id, number: view.number };
}

export interface ViewContextValue {
  readonly view: Accessor<ActiveView>;
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
}

const ViewContext = createContext<ViewContextValue>();

export function ViewContextProvider(props: {
  readonly initialView?: ActiveView;
  readonly children: JSX.Element;
}): JSX.Element {
  const [view, setView] = createSignal<ActiveView>(
    props.initialView ?? localView,
  );

  function openPullRequest(
    repository: Pick<ForgeRepository, "owner" | "name">,
    number: number,
  ): void {
    setView({ kind: "pr", id: pullRequestViewId(repository, number), number });
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
    if (current.kind === "local") {
      setView({ kind: "local", file: path });
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
    if (current.kind === "local") {
      setView(localView);
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
    setView(localView);
  }

  const context: ViewContextValue = {
    view,
    openPullRequest,
    selectCommit,
    selectFile,
    clearSelection,
    closeFile,
    close,
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
