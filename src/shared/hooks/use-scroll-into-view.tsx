import { createEffect } from "solid-js";

import type { ScrollBoxRenderable } from "@opentui/core";

export function useScrollIntoView(
  identify: () => string | undefined,
  scrollBox: () => ScrollBoxRenderable | undefined,
): void {
  createEffect(() => {
    const id = identify();
    if (id !== undefined) {
      scrollBox()?.scrollChildIntoView(id);
    }
  });
}
