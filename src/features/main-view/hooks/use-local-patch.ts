import { createEffect, createMemo, createResource, on } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { usePatchStore } from "@/context/patch-store";
import {
  localSource,
  useViewContext,
  viewSourceId,
} from "@/context/view-context";
import { available, unsupported } from "@/services/forge/section";
import { readCommitPatch, readWorkingTreePatch } from "@/services/local/local";

export function useLocalPatch(): void {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const patchStore = usePatchStore();
  const [patch] = createResource(
    () =>
      viewContext.view().source.kind === "local"
        ? forgeContext.state().cwd
        : undefined,
    (cwd) => readWorkingTreePatch(cwd),
  );
  const commitSha = createMemo(() => {
    const view = viewContext.view();
    return view.source.kind === "local" ? view.commit : undefined;
  });

  createEffect(() => {
    const result = patch.latest;
    if (result === undefined) {
      patchStore.setLocalPatch(undefined);
      return;
    }
    patchStore.setLocalPatch(
      result.isOk()
        ? available({ text: result.value })
        : unsupported(`Could not read local changes: ${result.error.message}`),
    );
  });

  createEffect(
    on(commitSha, (sha) => {
      if (
        sha === undefined ||
        patchStore.cachedCommitPatch(sha) !== undefined
      ) {
        return;
      }
      void readCommitPatch(forgeContext.state().cwd, sha).then((result) => {
        patchStore.setCommitPatch(
          viewSourceId(localSource),
          sha,
          result.isOk()
            ? available(result.value)
            : unsupported(`Could not read commit: ${result.error.message}`),
        );
      });
    }),
  );
}
