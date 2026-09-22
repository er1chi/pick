import { Show, type Accessor } from "solid-js";
import { colors } from "@/theme";
import { truncateEnd } from "@/utils/truncate";

import type { JSX } from "@opentui/solid";

// The main pane gives up the fixed sidebar (32), its own border (2), and its
// horizontal padding (3) from the terminal width. Header and metadata lines are
// bounded by that budget so they truncate at the end instead of wrapping.
export const MAIN_PANE_CHROME = 37;
// The top context row shares its width with the close affordances. The diff
// affordance only appears once a file or commit context is selected, so the
// reserved width tracks whichever affordances are actually shown.
export const CLOSE_PR_LABEL = "[x] Close PR";
export const CLOSE_DIFF_LABEL = "[o] Close diff";
export const CLOSE_AFFORDANCE_GAP = 1;

/** Bounds content to exactly one visual row so it truncates instead of wrapping. */
export function oneLine(content: JSX.Element): JSX.Element {
  return (
    <box width="100%" height={1} flexGrow={0} flexShrink={0} overflow="hidden">
      {content}
    </box>
  );
}

export function renderMutedLine(
  line: string | undefined,
  maxWidth?: number,
): JSX.Element {
  return (
    <Show when={line}>
      {(value: Accessor<string>) =>
        oneLine(
          <text fg={colors.muted} wrapMode="none" truncate>
            {maxWidth === undefined ? value() : truncateEnd(value(), maxWidth)}
          </text>,
        )
      }
    </Show>
  );
}
