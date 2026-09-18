import { useBindings } from "@opentui/keymap/solid";
import { PaneStore, requestPaneFocus } from "@/context/active-pane-context";
import { CommitsBox } from "@/features/sidebar/commits-box";
import { FilesBox } from "@/features/sidebar/files-box";
import { PullRequestsBox } from "@/features/sidebar/pull-requests-box";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";

const SIDEBAR_WIDTH = 32;
// The sidebar border consumes one column on each side.
const SIDEBAR_ROW_WIDTH = SIDEBAR_WIDTH - 2;

export interface SidebarProps {
  readonly titles: PrTitles;
  readonly content: PrViewContent;
}

export function Sidebar(props: SidebarProps) {
  const [pane, setPane] = PaneStore.use();

  // Global numeric focus shared by every pane, including the main content.
  // Every keypress issues a fresh request so real focus is re-asserted even if
  // a pointer click moved it without updating `pane.active`.
  useBindings(() => ({
    commands: [
      {
        name: "pane.files",
        run: () => requestPaneFocus(pane, setPane, "files"),
      },
      {
        name: "pane.commits",
        run: () => requestPaneFocus(pane, setPane, "commits"),
      },
      {
        name: "pane.pull-requests",
        run: () => requestPaneFocus(pane, setPane, "pull-requests"),
      },
      {
        name: "pane.content",
        run: () => requestPaneFocus(pane, setPane, "content"),
      },
    ],
    bindings: [
      { key: "0", cmd: "pane.files" },
      { key: "1", cmd: "pane.commits" },
      { key: "2", cmd: "pane.pull-requests" },
      { key: "3", cmd: "pane.content" },
    ],
  }));

  return (
    <box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      minWidth={SIDEBAR_WIDTH}
      maxWidth={SIDEBAR_WIDTH}
      flexGrow={0}
      flexShrink={0}
      height="100%"
      overflow="hidden"
      gap={0}
    >
      <FilesBox
        titles={props.titles}
        content={props.content}
        rowWidth={SIDEBAR_ROW_WIDTH}
      />
      <CommitsBox
        titles={props.titles}
        content={props.content}
        rowWidth={SIDEBAR_ROW_WIDTH}
      />
      <PullRequestsBox
        titles={props.titles}
        content={props.content}
        rowWidth={SIDEBAR_ROW_WIDTH}
      />
    </box>
  );
}
