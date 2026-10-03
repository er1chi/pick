import type { ScrollBoxRenderable } from "@opentui/core";
import type { SplitFileDiffScrollTarget } from "@/packages/pierre/solid/diffs";

export enum LoadStatus {
  Idle = "idle",
  Loading = "loading",
  Settled = "settled",
}

/** What the main pane hands each content body: display options and the
 * scroll targets its key bindings drive. */
export interface MainBodyProps {
  readonly revealLocked: boolean;
  readonly maxWidth: number;
  readonly setOverviewScroll: (target: ScrollBoxRenderable | undefined) => void;
  readonly setDiffScroll: (
    target: SplitFileDiffScrollTarget | undefined,
  ) => void;
}
