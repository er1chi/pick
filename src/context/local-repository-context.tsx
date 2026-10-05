import { toast } from "@tuiparts/toast/solid";
import { createContext, createResource, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { available, unsupported } from "@/services/forge/section";
import { pushBranch, readCommits } from "@/services/local/local";
import { useForgeContext } from "./forge-context";
import { useViewContext } from "./view-context";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ForgeSection } from "@/services/forge/types";
import type { GitCommit } from "@/services/local/types";

type PushStatus = "running" | "succeeded" | "failed";

export interface PushLog {
  readonly status: PushStatus;
  readonly lines: readonly string[];
}

export interface LocalRepositoryValue {
  readonly commits: Accessor<ForgeSection<readonly GitCommit[]> | undefined>;
  readonly hasUnpushedCommits: Accessor<boolean>;
  readonly pushing: Accessor<boolean>;
  readonly pushLog: Accessor<PushLog | undefined>;
  push(): Promise<void>;
  dismissPushLog(): void;
}

const LocalRepositoryContext = createContext<LocalRepositoryValue>();

export function LocalRepositoryProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const [log, setLog] = createStore<{
    status: PushStatus | undefined;
    lines: string[];
  }>({ status: undefined, lines: [] });
  const pushing = () => log.status === "running";
  const [commits, { refetch }] = createResource(
    () =>
      viewContext.view().source.kind === "local"
        ? forgeContext.state().cwd
        : undefined,
    (cwd) => readCommits(cwd),
  );

  const value: LocalRepositoryValue = {
    commits: () => {
      const result = commits.latest;
      if (result === undefined) {
        return undefined;
      }
      return result.isOk()
        ? available(result.value)
        : unsupported(`Could not read commits: ${result.error.message}`);
    },
    hasUnpushedCommits: () => {
      const result = commits.latest;
      return (
        result !== undefined &&
        result.isOk() &&
        result.value.some((commit) => !commit.pushed)
      );
    },
    pushing,
    pushLog: () =>
      log.status === undefined
        ? undefined
        : { status: log.status, lines: log.lines },
    push: async () => {
      if (pushing()) {
        return;
      }
      setLog({ status: "running", lines: [] });
      const pushed = await pushBranch(forgeContext.state().cwd, (line) =>
        setLog("lines", log.lines.length, line),
      );
      await refetch();
      setLog("status", pushed.isOk() ? "succeeded" : "failed");
      if (pushed.isErr()) {
        toast.error(`Could not push: ${pushed.error.message}`);
      }
    },
    dismissPushLog: () => {
      if (!pushing()) {
        setLog({ status: undefined, lines: [] });
      }
    },
  };

  return (
    <LocalRepositoryContext.Provider value={value}>
      {props.children}
    </LocalRepositoryContext.Provider>
  );
}

export function useLocalRepository(): LocalRepositoryValue {
  const context = useContext(LocalRepositoryContext);
  if (context === undefined) {
    throw new Error(
      "useLocalRepository must be used within a LocalRepositoryProvider",
    );
  }
  return context;
}
