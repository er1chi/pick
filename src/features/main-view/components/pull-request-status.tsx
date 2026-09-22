import cliSpinners from "cli-spinners";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { usePullRequest } from "@/context/pull-request-context";
import { useViewContext, viewCommit } from "@/context/view-context";
import { oneLine } from "@/features/main-view/components/pr-view-chrome";
import { colors } from "@/theme";

import type { Accessor, JSX } from "solid-js";

function useSpinnerFrame(active: Accessor<boolean>): Accessor<string> {
  const spinner = cliSpinners.dots;
  const [index, setIndex] = createSignal(0);

  createEffect(() => {
    if (!active()) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % spinner.frames.length);
    }, spinner.interval);
    onCleanup(() => clearInterval(timer));
  });

  return () => spinner.frames[index()] ?? "";
}

export function PullRequestStatusLine(): JSX.Element {
  const pullRequest = usePullRequest();
  const viewContext = useViewContext();
  const activity = (): "loading" | "refreshing" | undefined => {
    const phase = pullRequest.phase();
    if (phase === "loading" || phase === "refreshing") {
      return phase;
    }
    const current = viewContext.view();
    if (
      current !== undefined &&
      viewCommit(current) !== undefined &&
      viewContext.currentPatch() === undefined
    ) {
      return "loading";
    }
    return undefined;
  };
  const frame = useSpinnerFrame(() => activity() !== undefined);
  const failure = () =>
    pullRequest.phase() === "error" ? pullRequest.error()?.message : undefined;

  return (
    <>
      <Show when={activity()}>
        {(label: Accessor<"loading" | "refreshing">) =>
          oneLine(
            <text fg={colors.muted} wrapMode="none" truncate>
              {`${frame()} ${label()}...`}
            </text>,
          )
        }
      </Show>
      <Show when={failure()}>
        {(message: Accessor<string>) =>
          oneLine(
            <text fg={colors.yellow} wrapMode="none" truncate>
              {`Could not load pull request. ${message()} Press r to retry.`}
            </text>,
          )
        }
      </Show>
    </>
  );
}
