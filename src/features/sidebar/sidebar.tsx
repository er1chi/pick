import { CommitsBox } from "@/features/sidebar/components/commits-box";
import { FilesBox } from "@/features/sidebar/components/files-box";
import { PullRequestsBox } from "@/features/sidebar/components/pull-requests-box";

import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";

const SIDEBAR_WIDTH = 32;
const SIDEBAR_ROW_WIDTH = SIDEBAR_WIDTH - 2;

export interface SidebarProps {
  readonly titles: PrTitles;
  readonly content: PrViewContent;
}

export function Sidebar(props: SidebarProps) {
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
      <FilesBox content={props.content} rowWidth={SIDEBAR_ROW_WIDTH} />
      <CommitsBox content={props.content} rowWidth={SIDEBAR_ROW_WIDTH} />
      <PullRequestsBox titles={props.titles} rowWidth={SIDEBAR_ROW_WIDTH} />
    </box>
  );
}
