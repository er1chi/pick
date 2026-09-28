import { createEffect, createResource } from "solid-js";
import { useForgeContext } from "@/context/forge-context";
import { usePatchStore } from "@/context/patch-store";
import { useViewContext } from "@/context/view-context";
import { available, unsupported } from "@/services/forge/section";
import { readWorkingTreePatch } from "@/services/local/local";

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
}
