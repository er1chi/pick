import { Match, Switch, type Accessor } from "solid-js";
import { useSelectedCommit } from "../hooks/use-selected-commit";
import { CommitOverview } from "./commit-overview";
import { OverviewScreen } from "./overview-screen";
import { SelectedDiffBody } from "./selected-diff";

import type { JSX } from "@opentui/solid";
import type { PullRequestView } from "@/context/view-context";
import type { PullRequestSummary } from "@/services/forge/types";
import type { MainBodyProps } from "../types";

type DiffView = Extract<PullRequestView, { kind: "diff" }>;

interface PullRequestBodyProps extends MainBodyProps {
  readonly view: PullRequestView;
  readonly summary: Accessor<PullRequestSummary | undefined>;
}

/** The open pull request's overview, selected commit, or file diff. */
export function PullRequestBody(props: PullRequestBodyProps): JSX.Element {
  const commit = useSelectedCommit();
  const diffView = () => (props.view.kind === "diff" ? props.view : undefined);
  const commitSha = () =>
    props.view.kind === "commit" ? props.view.sha : undefined;

  return (
    <Switch>
      <Match when={props.view.kind === "pr"}>
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
      <Match when={commitSha()}>
        {(sha: Accessor<string>) => (
          <CommitOverview
            sha={sha()}
            maxWidth={props.maxWidth}
            scrollRef={props.setOverviewScroll}
          />
        )}
      </Match>
      <Match when={diffView()}>
        {(view: Accessor<DiffView>) => (
          <SelectedDiffBody
            path={view().path}
            commitSha={view().commit}
            commit={commit()}
            label={
              view().commit === undefined ? "Pull request diff" : "Commit diff"
            }
            revealLocked={props.revealLocked}
            maxWidth={props.maxWidth}
            setDiffScroll={props.setDiffScroll}
          />
        )}
      </Match>
    </Switch>
  );
}
