import { createMemo } from "solid-js/types/server/reactive.js";
import { PaneStore } from "@/context/active-pane-context";

import type { Pane } from "@/types";

export function useFocusedPane(current: Pane) {
  const [pane] = PaneStore.use();
  const isFocused = createMemo(() => pane.active === current);

  return isFocused;
}
