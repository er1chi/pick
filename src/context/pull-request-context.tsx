import { createContext, Show, useContext } from "solid-js";
import { usePr } from "@/features/main-view/hooks/use-pr";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { PullRequestContextValue } from "@/features/main-view/hooks/use-pr";

export type { PullRequestContextValue } from "@/features/main-view/hooks/use-pr";

const PullRequestContext = createContext<PullRequestContextValue>();

function LivePullRequestProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const value = usePr();
  return (
    <PullRequestContext.Provider value={value}>
      {props.children}
    </PullRequestContext.Provider>
  );
}

export function PullRequestProvider(props: {
  readonly value?: PullRequestContextValue;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <Show
      when={props.value}
      fallback={
        <LivePullRequestProvider>{props.children}</LivePullRequestProvider>
      }
    >
      {(value: Accessor<PullRequestContextValue>) => (
        <PullRequestContext.Provider value={value()}>
          {props.children}
        </PullRequestContext.Provider>
      )}
    </Show>
  );
}

export function usePullRequest(): PullRequestContextValue {
  const context = useContext(PullRequestContext);
  if (context === undefined) {
    throw new Error("usePullRequest must be used within a PullRequestProvider");
  }
  return context;
}
