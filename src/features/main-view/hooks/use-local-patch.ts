import { createEffect, createResource } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { useViewContext, viewPullRequest } from "@/context/view-context";
import { available, unsupported } from "@/services/forge/section";
import { readWorkingTreePatch } from "@/services/local/local";

/** Loads the uncommitted changes as the current patch while no pull request is
 * open, so the local diff reads the same way a pull request diff does. */
export function useLocalPatch(): void {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const [patch] = createResource(
    () =>
      viewPullRequest(viewContext.view()) === undefined
        ? forgeContext.state().cwd
        : undefined,
    (cwd) => readWorkingTreePatch(cwd),
  );

  createEffect(() => {
    const result = patch.latest;
    if (result === undefined) {
      viewContext.setLocalPatch(undefined);
      return;
    }
    // A git failure is not a forge error, so it surfaces as the reason the
    // patch is unavailable rather than as a failed forge section.
    viewContext.setLocalPatch(
      result.isOk()
        ? available({ text: result.value })
        : unsupported(`Could not read local changes: ${result.error.message}`),
    );
  });
}
