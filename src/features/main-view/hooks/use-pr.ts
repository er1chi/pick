import { createEffect, createMemo, on, onCleanup } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { useForgeContext } from "@/context/forge-context";
import {
  useViewContext,
  viewCommit,
  viewPullRequest,
} from "@/context/view-context";
import { failed } from "@/services/forge/section";

import type { Accessor } from "solid-js";
import type { ForgeService } from "@/services/forge/forge-service";
import type {
  ForgeOperationError,
  ForgeSection,
  PullRequestDocument,
  PullRequestPatch,
} from "@/services/forge/types";

type PullRequestPhase = "idle" | "loading" | "refreshing" | "ready" | "error";

export interface PullRequestContextValue {
  readonly data: Accessor<PullRequestDocument | undefined>;
  readonly phase: Accessor<PullRequestPhase>;
  readonly error: Accessor<ForgeOperationError | undefined>;
  refresh(): void;
}

interface PullRequestState {
  data: PullRequestDocument | undefined;
  phase: PullRequestPhase;
  error: ForgeOperationError | undefined;
  reload: number;
}

function isReusableCommitPatch(
  section: ForgeSection<PullRequestPatch>,
): boolean {
  return section.status !== "failed";
}

export function usePr(): PullRequestContextValue {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const [state, setState] = createStore<PullRequestState>({
    data: undefined,
    phase: "idle",
    error: undefined,
    reload: 0,
  });
  let requestId = 0;
  let controller: AbortController | undefined;

  function load(nextPhase: "loading" | "refreshing"): void {
    const opened = viewPullRequest(viewContext.view());
    const forge = forgeContext.state().forge;
    controller?.abort();
    controller = undefined;
    const id = ++requestId;
    if (opened === undefined || forge === undefined) {
      setState({ data: undefined, phase: "idle", error: undefined });
      viewContext.setPullRequestPatch(undefined);
      viewContext.clearCommitPatches();
      return;
    }
    setState({ data: undefined, phase: nextPhase, error: undefined });
    viewContext.setPullRequestPatch(undefined);
    viewContext.clearCommitPatches();
    const abort = new AbortController();
    controller = abort;
    void applyPullRequest(id, abort, forge, opened.number);
  }

  async function applyPullRequest(
    id: number,
    abort: AbortController,
    forge: ForgeService,
    number: number,
  ): Promise<void> {
    const result = await forge.loadPullRequest(number, {
      signal: abort.signal,
    });
    if (id !== requestId || abort.signal.aborted) {
      return;
    }
    if (result.isErr()) {
      setState({ phase: "error", error: result.error });
      return;
    }
    setState({ data: result.value, phase: "ready", error: undefined });
    viewContext.setPullRequestPatch(result.value.diff);
  }

  async function applyCommitPatch(
    pullRequestId: string,
    sha: string,
    abort: AbortController,
    forge: ForgeService,
  ): Promise<void> {
    const result = await forge.getCommitPatch(sha, { signal: abort.signal });
    if (abort.signal.aborted) {
      return;
    }
    if (result.isErr()) {
      viewContext.setCommitPatch(pullRequestId, sha, failed(result.error));
      return;
    }
    viewContext.setCommitPatch(pullRequestId, sha, result.value);
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
    on([commitSha, forge, () => state.reload], ([sha, currentForge]) => {
      if (sha === undefined || currentForge === undefined) {
        return;
      }
      const pullRequestId = viewPullRequest(viewContext.view())?.id;
      if (pullRequestId === undefined) {
        return;
      }
      const cached = viewContext.cachedCommitPatch(sha);
      if (cached !== undefined && isReusableCommitPatch(cached)) {
        return;
      }
      const abort = new AbortController();
      void applyCommitPatch(pullRequestId, sha, abort, currentForge);
      onCleanup(() => abort.abort());
    }),
  );

  function refresh(): void {
    load("refreshing");
    setState("reload", (reload) => reload + 1);
  }

  return {
    // Subscribe through the proxy, then return the original document. The
    // store wrapper must not replace the object callers cache and compare.
    data: () => {
      void state.data;
      return unwrap(state).data;
    },
    phase: () => state.phase,
    error: () => state.error,
    refresh,
  };
}
