import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";

export interface SidebarPaneProps {
  readonly titles: PrTitles;
  readonly content: PrViewContent;
  readonly rowWidth: number;
}
