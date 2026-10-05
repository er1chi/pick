import {
  createContext,
  createEffect,
  createMemo,
  createResource,
  on,
  onCleanup,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { available, unsupported } from "@/services/forge/section";
import {
  pushBranch,
  readChangedFiles,
  readCommitPatch,
  readCommits,
  readWorkingTreePatch,
} from "@/services/local/local";
import { useForgeContext } from "./forge-context";
import { usePatchStore } from "./patch-store";
import { localSource, useViewContext, viewSourceId } from "./view-context";

import type { JSX } from "@opentui/solid";
import type { Result } from "better-result";
import type { Accessor } from "solid-js";
import type { ForgeSection } from "@/services/forge/types";
import type {
  GitCommit,
  GitError,
  GitFileChange,
} from "@/services/local/types";

export interface PushLog {
  readonly status: "idle" | "running" | "succeeded" | "failed";
  readonly lines: readonly string[];
}

export interface LocalRepositoryValue {
  readonly commits: Accessor<ForgeSection<readonly GitCommit[]> | undefined>;
  readonly changedFiles: Accessor<
    Result<readonly GitFileChange[], GitError> | undefined
  >;
  readonly hasUnpushedCommits: Accessor<boolean>;
  readonly pushLog: PushLog;
  push(): Promise<void>;
  dismissPushLog(): void;
}

const LocalRepositoryContext = createContext<LocalRepositoryValue>();

export function LocalRepositoryProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const patchStore = usePatchStore();
  const localCwd = () =>
    viewContext.view().source.kind === "local"
      ? forgeContext.state().cwd
      : undefined;
  const [pushLog, setPushLog] = createStore<{
    status: PushLog["status"];
    lines: string[];
  }>({ status: "idle", lines: [] });
  const [commits, { refetch }] = createResource(localCwd, readCommits);
  const [changedFiles] = createResource(localCwd, readChangedFiles);
  const [workingTreePatch] = createResource(localCwd, readWorkingTreePatch);
  const selectedCommit = createMemo(() =>
    localCwd() === undefined ? undefined : viewContext.view().commit,
  );

  createEffect(() => {
    const result = workingTreePatch.latest;
    if (result === undefined) {
      patchStore.setLocalPatch(undefined);
      return;
    }
    patchStore.setLocalPatch(
      result.isOk()
        ? available({ text: result.value })
        : unsupported(`Could not read local changes: ${result.error.message}`),
    );
  });

  createEffect(
    on(selectedCommit, (sha) => {
      if (
        sha === undefined ||
        patchStore.cachedCommitPatch(sha) !== undefined
      ) {
        return;
      }
      let current = true;
      onCleanup(() => {
        current = false;
      });
      void readCommitPatch(forgeContext.state().cwd, sha).then((result) => {
        if (!current) {
          return;
        }
        patchStore.setCommitPatch(
          viewSourceId(localSource),
          sha,
          result.isOk()
            ? available(result.value)
            : unsupported(`Could not read commit: ${result.error.message}`),
        );
      });
    }),
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
    changedFiles: () => changedFiles.latest,
    hasUnpushedCommits: () => {
      const result = commits.latest;
      return (
        result !== undefined &&
        result.isOk() &&
        result.value.some((commit) => !commit.pushed)
      );
    },
    pushLog,
    push: async () => {
      if (pushLog.status === "running") {
        return;
      }
      setPushLog({ status: "running", lines: [] });
      const pushed = await pushBranch(forgeContext.state().cwd, (line) =>
        setPushLog("lines", pushLog.lines.length, line),
      );
      await refetch();
      setPushLog("status", pushed.isOk() ? "succeeded" : "failed");
    },
    dismissPushLog: () => {
      if (pushLog.status !== "running") {
        setPushLog({ status: "idle", lines: [] });
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
