import { Match, Switch, type Accessor } from "solid-js";
import { useSelectedCommit } from "../hooks/use-selected-commit";
import { CommitOverview } from "./commit-overview";
import { SelectedDiffBody } from "./selected-diff";

import type { JSX } from "@opentui/solid";
import type { LocalView } from "@/context/view-context";
import type { MainBodyProps } from "../types";

interface LocalBodyProps extends MainBodyProps {
  readonly view: LocalView;
}

/** A local file diff, from the working tree or a selected commit, or the
 * selected commit itself. */
export function LocalBody(props: LocalBodyProps): JSX.Element {
  const commit = useSelectedCommit();
  return (
    <Switch>
      <Match when={props.view.file}>
        {(path: Accessor<string>) => (
          <SelectedDiffBody
            path={path()}
            commitSha={props.view.commit}
            commit={commit()}
            label={
              props.view.commit === undefined
                ? "Working tree diff"
                : "Commit diff"
            }
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
    </Switch>
  );
}
