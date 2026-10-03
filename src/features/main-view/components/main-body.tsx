import { Match, Switch, type Accessor } from "solid-js";
import { useSelectedCommit } from "../hooks/use-selected-commit";
import { CommitOverview } from "./commit-overview";
import { OverviewScreen } from "./overview-screen";
import { SelectedDiffBody } from "./selected-diff";

import type { JSX } from "@opentui/solid";
import type { ActiveView } from "@/context/view-context";
import type { PullRequestSummary } from "@/services/forge/types";
import type { MainBodyProps } from "../types";

function diffLabel(view: ActiveView): string {
  if (view.commit !== undefined) {
    return "Commit diff";
  }
  return view.source.kind === "local"
    ? "Working tree diff"
    : "Pull request diff";
}

interface MainBodyComponentProps extends MainBodyProps {
  readonly view: ActiveView;
  readonly summary: Accessor<PullRequestSummary | undefined>;
}

/** The open file's diff, else the selected commit, else the pull request
 * overview. The local source has no overview of its own. */
export function MainBody(props: MainBodyComponentProps): JSX.Element {
  const commit = useSelectedCommit();
  return (
    <Switch>
      <Match when={props.view.file}>
        {(path: Accessor<string>) => (
          <SelectedDiffBody
            path={path()}
            commitSha={props.view.commit}
            commit={commit()}
            label={diffLabel(props.view)}
            revealLocked={props.revealLocked}
            maxWidth={props.maxWidth}
            setDiffScroll={props.setDiffScroll}
          />
        )}
      </Match>
      <Match when={props.view.commit}>
        {(sha: Accessor<string>) => (
          <CommitOverview
            sha={sha()}
            maxWidth={props.maxWidth}
            scrollRef={props.setOverviewScroll}
          />
        )}
      </Match>
      <Match when={props.view.source.kind === "pull-request"}>
        <scrollbox
          ref={props.setOverviewScroll}
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          width="100%"
          stickyScroll
          stickyStart="top"
        >
          <OverviewScreen summary={props.summary} />
        </scrollbox>
      </Match>
    </Switch>
  );
}
