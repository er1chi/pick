import type { Accessor } from "solid-js";

export type RepositoryPane = "sidebar" | "content";

export interface PaneFocus {
  readonly pane: Accessor<RepositoryPane>;
  focus(pane: RepositoryPane): void;
}
