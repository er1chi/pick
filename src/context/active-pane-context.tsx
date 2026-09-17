import { createSimpleContext } from "@/utils/create-simple-context";
import type { RepositoryPane } from "@/types";

interface PaneState {
  active: RepositoryPane;
}

export const PaneStore = createSimpleContext<PaneState>({
  name: "pane",
  init: {
    active: "sidebar",
  },
});
