import type { PrTitles } from "../main-view/hooks/use-pr-titles";

export interface SidebarPaneProps {
  readonly rowWidth: number;
}

export interface PullRequestPaneProps {
  readonly titles: PrTitles;
  readonly rowWidth: number;
}
