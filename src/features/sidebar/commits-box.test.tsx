import { RGBA, type BoxRenderable } from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/solid";
import { testRender } from "@opentui/solid";
import { useRenderer } from "@opentui/solid";
import { describe, expect, test } from "bun:test";
import { requestPaneFocus, PaneStore } from "@/context/active-pane-context";
import { idleLoadState } from "@/features/pr-view/load-state";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import { CommitsBox } from "@/features/sidebar/commits-box";
import { createAppKeymap } from "@/shared/keymap";
import type { PullRequestCommit } from "@/services/forge/types";
import { colors } from "@/theme";
import { createMemo, onMount, type JSX } from "solid-js";

type TestSetup = Awaited<ReturnType<typeof testRender>>;

const COMMIT_A: PullRequestCommit = {
  sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  message: "add sidebar layout",
  author: null,
  committer: null,
  authoredAt: null,
  committedAt: null,
  url: null,
};

const COMMIT_B: PullRequestCommit = {
  sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  message: "fix commits highlight",
  author: null,
  committer: null,
  authoredAt: null,
  committedAt: null,
  url: null,
};

const titles: PrTitles = {
  list: () => idleLoadState(),
  filter: () => "open",
  highlightedNumber: () => null,
  openedNumber: () => 1,
  setFilter: () => {},
  cycleFilter: () => {},
  moveHighlight: () => {},
  openHighlighted: () => false,
  closeOpened: () => {},
  retry: () => {},
};

const content: PrViewContent = {
  overview: () => idleLoadState(),
  details: () => idleLoadState(),
  commits: () => [COMMIT_A, COMMIT_B],
  commitsState: () => idleLoadState(),
  reviews: () => idleLoadState(),
  checks: () => idleLoadState(),
  development: () => idleLoadState(),
  // Overview: no commit is activated, so the only highlight is keyboard-driven.
  view: () => ({ kind: "overview" }),
  selectFile: () => {},
  selectCommit: () => {},
  currentPatch: () => idleLoadState(),
  clearSelection: () => {},
  retry: () => {},
};

/** Mounts CommitsBox with the pane context pointed at "commits" so its
 * keymap layer receives `j` once the box is focused. */
function CommitsBoxHarness(): JSX.Element {
  const renderer = useRenderer();
  // Create the keymap once; it needs the renderer, not per-render setup.
  const keymap = createMemo(() => createAppKeymap(renderer));
  return (
    <PaneStore.Provider>
      <KeymapProvider keymap={keymap()}>
        <FocusCommitsPane />
        <CommitsBox titles={titles} content={content} rowWidth={30} />
      </KeymapProvider>
    </PaneStore.Provider>
  );
}

function FocusCommitsPane(): null {
  const [pane, setPane] = PaneStore.use();
  onMount(() => requestPaneFocus(pane, setPane, "commits"));
  return null;
}

/** SelectableRow paints its selected background with `colors.border`. */
const selectedBackground = RGBA.fromHex(colors.border).toInts();

function rowBackground(setup: TestSetup, sha: string): readonly number[] {
  const row = setup.renderer.root.findDescendantById(`commit-${sha}`);
  if (row === undefined) {
    throw new Error(`missing commit row renderable: ${sha}`);
  }
  // SAFETY: `commit-<sha>` ids are only assigned to SelectableRow's box.
  return (row as BoxRenderable).backgroundColor.toInts();
}

function isSelected(setup: TestSetup, sha: string): boolean {
  const background = rowBackground(setup, sha);
  return selectedBackground.every(
    (channel, index) => channel === background[index],
  );
}

describe("CommitsBox", () => {
  test("j moves the keyboard highlight from the first to the second commit", async () => {
    const setup = await testRender(() => <CommitsBoxHarness />, {
      width: 40,
      height: 12,
    });
    try {
      await setup.waitFor(() => isSelected(setup, COMMIT_A.sha));

      // First paint: the first commit row carries the selected background.
      expect(isSelected(setup, COMMIT_A.sha)).toBe(true);
      expect(isSelected(setup, COMMIT_B.sha)).toBe(false);

      setup.mockInput.pressKey("j");
      await setup.waitFor(() => isSelected(setup, COMMIT_B.sha));

      // The highlight moves: second row selected, first row cleared.
      expect(isSelected(setup, COMMIT_B.sha)).toBe(true);
      expect(isSelected(setup, COMMIT_A.sha)).toBe(false);
    } finally {
      setup.renderer.destroy();
    }
  });
});
