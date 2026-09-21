import { RGBA, type BoxRenderable } from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/solid";
import { testRender, useRenderer } from "@opentui/solid";
import { describe, expect, test } from "bun:test";
import {
  createMemo,
  createSignal,
  For,
  onMount,
  type JSX,
  type Setter,
} from "solid-js";
import { PaneStore } from "@/context/active-pane-context";
import {
  pullRequestViewId,
  ViewContextProvider,
  type ActiveView,
} from "@/context/view-context";
import { idleLoadState } from "@/features/pr-view/load-state";
import { createAppKeymap } from "@/shared/keymap";
import { colors } from "@/theme";
import { Pane } from "@/types";
import { CommitsBox } from "./commits-box";

import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import type { PullRequestCommit } from "@/services/forge/types";

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

const openPullRequest: ActiveView = {
  kind: "pr",
  id: pullRequestViewId({ owner: "octocat", name: "hello" }, 1),
  number: 1,
};

const content: PrViewContent = {
  overview: () => idleLoadState(),
  details: () => idleLoadState(),
  commits: () => [COMMIT_A, COMMIT_B],
  commitsState: () => idleLoadState(),
  reviews: () => idleLoadState(),
  checks: () => idleLoadState(),
  development: () => idleLoadState(),
  currentPatch: () => idleLoadState(),
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
        <ViewContextProvider initialView={openPullRequest}>
          <FocusCommitsPane />
          <CommitsBox content={content} rowWidth={30} />
        </ViewContextProvider>
      </KeymapProvider>
    </PaneStore.Provider>
  );
}

function FocusCommitsPane(): null {
  const [_pane, setPane] = PaneStore.use();
  onMount(() => setPane({ active: Pane.Commits }));
  return null;
}

interface LayoutHarnessControls {
  readonly setCommits: Setter<readonly PullRequestCommit[]>;
  readonly setFileRows: Setter<number>;
}

function CommitsBoxLayoutHarness(props: {
  readonly ready: (controls: LayoutHarnessControls) => void;
}): JSX.Element {
  const renderer = useRenderer();
  const keymap = createMemo(() => createAppKeymap(renderer));
  const [commits, setCommits] = createSignal<readonly PullRequestCommit[]>([]);
  const [fileRows, setFileRows] = createSignal(1);
  const reactiveContent: PrViewContent = { ...content, commits };

  onMount(() => props.ready({ setCommits, setFileRows }));

  return (
    <PaneStore.Provider>
      <KeymapProvider keymap={keymap()}>
        <ViewContextProvider initialView={openPullRequest}>
          <box flexDirection="column" width={40} height={20}>
            <box flexGrow={1} minHeight={0} overflow="hidden">
              <For each={Array.from({ length: fileRows() })}>
                {(_, index) => <text id={`file-row-${index()}`}>file</text>}
              </For>
            </box>
            <CommitsBox content={reactiveContent} rowWidth={30} />
          </box>
        </ViewContextProvider>
      </KeymapProvider>
    </PaneStore.Provider>
  );
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

function commitsBoxHeight(setup: TestSetup): number {
  const node = setup.renderer.root.findDescendantById(Pane.Commits);
  if (node === undefined) {
    throw new Error("missing commits box renderable");
  }
  // SAFETY: Pane.Commits is only assigned to the commits SidebarBox.
  return (node as BoxRenderable).height;
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

  test("grows from its empty row to a stable capped height", async () => {
    let controls: LayoutHarnessControls | undefined;
    const setup = await testRender(
      () => <CommitsBoxLayoutHarness ready={(value) => (controls = value)} />,
      { width: 40, height: 20 },
    );

    try {
      await setup.waitFor(() => controls !== undefined);
      expect(commitsBoxHeight(setup)).toBe(3);

      controls?.setCommits(
        Array.from({ length: 20 }, (_, index) => ({
          ...COMMIT_A,
          sha: String(index).padStart(40, "0"),
        })),
      );
      await setup.waitFor(() => commitsBoxHeight(setup) === 15);

      controls?.setFileRows(20);
      await setup.waitFor(
        () =>
          setup.renderer.root.findDescendantById("file-row-19") !== undefined,
      );
      expect(commitsBoxHeight(setup)).toBe(15);
    } finally {
      setup.renderer.destroy();
    }
  });
});
