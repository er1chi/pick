import {
  createContext,
  createEffect,
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
  PullRequestDocument,
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

  createEffect(
    on(
      [
        () => viewPullRequest(viewContext.view())?.id,
        () => forgeContext.state().forge,
      ],
      () => {
        load("loading");
        onCleanup(() => controller?.abort());
      },
    ),
  );

  createEffect(
    on(
      [
        () => {
          const opened = viewContext.view();
          return opened === undefined ? undefined : viewCommit(opened);
        },
        () => forgeContext.state().forge,
        patchReload,
      ],
      ([sha, forge]) => {
        if (sha === undefined || forge === undefined) {
          viewContext.setCommitPatch(undefined);
          return;
        }
        const abort = new AbortController();
        viewContext.setCommitPatch(undefined);
        void forge
          .getCommitPatch(sha, { signal: abort.signal })
          .then((result) => {
            if (abort.signal.aborted) {
              return;
            }
            if (result.isErr()) {
              viewContext.setCommitPatch(failed(result.error));
              return;
            }
            viewContext.setCommitPatch(result.value);
          });
        onCleanup(() => abort.abort());
      },
    ),
  );

  function refresh(): void {
    viewContext.setCommitPatch(undefined);
    setPatchReload((value) => value + 1);
    load("refreshing");
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
