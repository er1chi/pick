import type { ScrollBoxRenderable } from "@opentui/core";
import type { SplitFileDiffScrollTarget } from "@/packages/pierre/solid/diffs";

export enum LoadStatus {
  Idle = "idle",
  Loading = "loading",
  Settled = "settled",
}

export interface MainBodyProps {
  readonly revealLocked: boolean;
  readonly maxWidth: number;
  readonly setOverviewScroll: (target: ScrollBoxRenderable | undefined) => void;
  readonly setDiffScroll: (
    target: SplitFileDiffScrollTarget | undefined,
  ) => void;
}
