import { createEffect, createResource } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { useViewContext, viewPullRequest } from "@/context/view-context";
import { available, unsupported } from "@/services/forge/section";
import { readWorkingTreePatch } from "@/services/local/local";

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
    viewContext.setLocalPatch(
      result.isOk()
        ? available({ text: result.value })
        : unsupported(`Could not read local changes: ${result.error.message}`),
    );
  });
}
