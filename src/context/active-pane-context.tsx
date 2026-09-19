import { createSimpleContext } from "@/utils/create-simple-context";

import type { SetStoreFunction } from "solid-js/store";
import type { RepositoryPane } from "@/types";

interface PaneState {
  active: RepositoryPane;
  /**
   * Monotonic token bumped on every explicit focus request. Pane focus effects
   * subscribe to it so a numbered keypress re-asserts focus even when `active`
   * is already the requested pane. This keeps the logical pane in sync after a
   * pointer click moves real terminal focus without changing `active`.
   */
  focusRequest: number;
}

export const PaneStore = createSimpleContext<PaneState>({
  name: "pane",
  init: {
    active: "pull-requests",
    focusRequest: 0,
  },
});

/**
 * Point the workspace at `pane` and issue a fresh focus request, so effects
 * re-assert DOM focus even when the logical pane value is unchanged.
 */
export function requestPaneFocus(
  get: PaneState,
  set: SetStoreFunction<PaneState>,
  pane: RepositoryPane,
): void {
  set({ active: pane, focusRequest: get.focusRequest + 1 });
}
