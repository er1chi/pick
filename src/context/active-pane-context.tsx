import { createSimpleContext } from "@/shared/hooks/create-simple-context";
import { Pane } from "@/types";

export interface PaneState {
  active: Pane;
}

export const PaneStore = createSimpleContext<PaneState>({
  name: "pane",
  init: {
    active: Pane.PullRequests,
  },
});
