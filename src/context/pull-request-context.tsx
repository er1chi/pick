import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
  useContext,
} from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import {
  useViewContext,
  viewCommit,
  viewPullRequest,
} from "@/context/view-context";
import { failed } from "@/services/forge/normalization";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type {
  ForgeOperationError,
  ForgeSection,
  PullRequestDocument,
  PullRequestPatch,
} from "@/services/forge/types";

export type PullRequestPhase =
  | "idle"
  | "loading"
  | "refreshing"
  | "ready"
  | "error";

export interface PullRequestContextValue {
  readonly data: Accessor<PullRequestDocument | undefined>;
  readonly phase: Accessor<PullRequestPhase>;
  readonly error: Accessor<ForgeOperationError | undefined>;
  refresh(): void;
}

const PullRequestContext = createContext<PullRequestContextValue>();

function isReusableCommitPatch(
  section: ForgeSection<PullRequestPatch>,
): boolean {
  return section.status !== "failed";
}

function useLivePullRequest(): PullRequestContextValue {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const [data, setData] = createSignal<PullRequestDocument | undefined>();
  const [phase, setPhase] = createSignal<PullRequestPhase>("idle");
  const [error, setError] = createSignal<ForgeOperationError | undefined>();
  const [patchReload, setPatchReload] = createSignal(0);
  let requestId = 0;
  let controller: AbortController | undefined;

  function load(nextPhase: "loading" | "refreshing"): void {
    const opened = viewPullRequest(viewContext.view());
    const forge = forgeContext.state().forge;
    controller?.abort();
    controller = undefined;
    const id = ++requestId;
    setData(undefined);
    setError(undefined);
    viewContext.setPullRequestPatch(undefined);
    viewContext.clearCommitPatches();
    if (opened === undefined || forge === undefined) {
      setPhase("idle");
      return;
    }
    setPhase(nextPhase);
    const abort = new AbortController();
    controller = abort;
    void forge
      .loadPullRequest(opened.number, { signal: abort.signal })
      .then((result) => {
        if (id !== requestId || abort.signal.aborted) {
          return;
        }
        if (result.isErr()) {
          setPhase("error");
          setError(result.error);
          return;
        }
        setData(result.value);
        setPhase("ready");
        viewContext.setPullRequestPatch(result.value.diff);
      });
  }

  // Memos compare with ===, so a new view object with the same pull request
  // id or commit sha does not rerun the load. Selecting a file, or opening a
  // commit whose patch is already stored, reads that stored patch.
  const openedId = createMemo(() => viewPullRequest(viewContext.view())?.id);
  const forge = createMemo(() => forgeContext.state().forge);
  const commitSha = createMemo(() => {
    const opened = viewContext.view();
    return opened === undefined ? undefined : viewCommit(opened);
  });

  createEffect(
    on([openedId, forge], () => {
      load("loading");
      onCleanup(() => controller?.abort());
    }),
  );

  createEffect(
    on([commitSha, forge, patchReload], ([sha, currentForge]) => {
      if (sha === undefined || currentForge === undefined) {
        return;
      }
      const cached = viewContext.cachedCommitPatch(sha);
      if (cached !== undefined && isReusableCommitPatch(cached)) {
        return;
      }
      const abort = new AbortController();
      void currentForge
        .getCommitPatch(sha, { signal: abort.signal })
        .then((result) => {
          if (abort.signal.aborted) {
            return;
          }
          if (result.isErr()) {
            viewContext.setCommitPatch(sha, failed(result.error));
            return;
          }
          viewContext.setCommitPatch(sha, result.value);
        });
      onCleanup(() => abort.abort());
    }),
  );

  function refresh(): void {
    load("refreshing");
    setPatchReload((value) => value + 1);
  }

  return { data, phase, error, refresh };
}

function LivePullRequestProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const value = useLivePullRequest();
  return (
    <PullRequestContext.Provider value={value}>
      {props.children}
    </PullRequestContext.Provider>
  );
}

export function PullRequestProvider(props: {
  readonly value?: PullRequestContextValue;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <Show
      when={props.value}
      fallback={
        <LivePullRequestProvider>{props.children}</LivePullRequestProvider>
      }
    >
      {(value: Accessor<PullRequestContextValue>) => (
        <PullRequestContext.Provider value={value()}>
          {props.children}
        </PullRequestContext.Provider>
      )}
    </Show>
  );
}

export function usePullRequest(): PullRequestContextValue {
  const context = useContext(PullRequestContext);
  if (context === undefined) {
    throw new Error("usePullRequest must be used within a PullRequestProvider");
  }
  return context;
}
