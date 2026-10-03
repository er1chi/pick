import { createContext, createSignal, useContext } from "solid-js";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ForgeRepository } from "@/services/forge/types";

export function pullRequestViewId(
  repository: Pick<ForgeRepository, "owner" | "name">,
  number: number,
): string {
  return `${repository.owner}/${repository.name}#${number}`;
}

export interface PullRequestSource {
  readonly kind: "pull-request";
  readonly id: string;
  readonly number: number;
}

interface LocalSource {
  readonly kind: "local";
}

export type ViewSource = LocalSource | PullRequestSource;

export interface ActiveView {
  readonly source: ViewSource;
  readonly commit: string | undefined;
  readonly file: string | undefined;
}

export const localSource: LocalSource = { kind: "local" };

export function viewSourceId(source: ViewSource): string {
  return source.kind === "local" ? "local" : source.id;
}

export function pullRequestView(
  repository: Pick<ForgeRepository, "owner" | "name">,
  number: number,
): ActiveView {
  return {
    source: {
      kind: "pull-request",
      id: pullRequestViewId(repository, number),
      number,
    },
    commit: undefined,
    file: undefined,
  };
}

const localView: ActiveView = {
  source: localSource,
  commit: undefined,
  file: undefined,
};

export function viewPullRequest(
  view: ActiveView,
): PullRequestSource | undefined {
  return view.source.kind === "pull-request" ? view.source : undefined;
}

export interface ViewContextValue {
  readonly view: Accessor<ActiveView>;
  openPullRequest(
    repository: Pick<ForgeRepository, "owner" | "name">,
    number: number,
  ): void;
  selectCommit(sha: string): void;
  selectFile(path: string): void;
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
    setView(pullRequestView(repository, number));
  }

  function selectCommit(sha: string): void {
    setView({ source: view().source, commit: sha, file: undefined });
  }

  function selectFile(path: string): void {
    setView({ ...view(), file: path });
  }

  function closeFile(): void {
    const current = view();
    setView(
      current.file === undefined
        ? { ...current, commit: undefined }
        : { ...current, file: undefined },
    );
  }

  function close(): void {
    setView(localView);
  }

  const context: ViewContextValue = {
    view,
    openPullRequest,
    selectCommit,
    selectFile,
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
