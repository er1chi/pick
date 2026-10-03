import { createEffect, createMemo, createResource, on } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { localCommitPatchOwner, usePatchStore } from "@/context/patch-store";
import { useViewContext } from "@/context/view-context";
import { available, unsupported } from "@/services/forge/section";
import { readCommitPatch, readWorkingTreePatch } from "@/services/local/local";

export function useLocalPatch(): void {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const patchStore = usePatchStore();
  const [patch] = createResource(
    () =>
      viewContext.view().kind === "local"
        ? forgeContext.state().cwd
        : undefined,
    (cwd) => readWorkingTreePatch(cwd),
  );
  const commitSha = createMemo(() => {
    const view = viewContext.view();
    return view.kind === "local" ? view.commit : undefined;
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

  // A commit's patch never changes, so one read per commit is kept in the
  // patch store until a pull request replaces the cache.
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
          localCommitPatchOwner,
          sha,
          result.isOk()
            ? available({ text: result.value })
            : unsupported(`Could not read commit: ${result.error.message}`),
        );
      });
    }),
  );
}
