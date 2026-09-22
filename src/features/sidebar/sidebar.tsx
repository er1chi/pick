import { CommitsBox } from "@/features/sidebar/components/commits-box";
import { FilesBox } from "@/features/sidebar/components/files-box";
import { PullRequestsBox } from "@/features/sidebar/components/pull-requests-box";

import type { BoxProps } from "@opentui/solid";
import type { PrTitles } from "@/features/main-view/hooks/use-pr-titles";

const SIDEBAR_WIDTH = 32;
const SIDEBAR_ROW_WIDTH = SIDEBAR_WIDTH - 2;

export interface SidebarProps extends BoxProps {
  readonly titles: PrTitles;
}

export function Sidebar(props: SidebarProps) {
  return (
    <box
      visible={props.visible}
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      minWidth={SIDEBAR_WIDTH}
      maxWidth={SIDEBAR_WIDTH}
      //flexGrow={0}
      //flexShrink={0}
      height="100%"
      overflow="hidden"
      gap={0}
    >
      <FilesBox rowWidth={SIDEBAR_ROW_WIDTH} />
      <CommitsBox rowWidth={SIDEBAR_ROW_WIDTH} />
      <PullRequestsBox titles={props.titles} rowWidth={SIDEBAR_ROW_WIDTH} />
    </box>
  );
}
