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
  deleteBranch,
  deleteRemoteBranch,
  dropStash,
  pullBranch,
  pushBranch,
  readBranches,
  readChangedFiles,
  readCommitPatch,
  readCommits,
  readStashes,
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
  GitBranch,
  GitBranchNotMergedError,
  GitBranchScope,
  GitCommit,
  GitError,
  GitFileChange,
  GitStash,
} from "@/services/local/types";

type GitResult<T> = Result<T, GitError> | undefined;

export interface RemoteLog {
  readonly title: string;
  readonly status: "idle" | "running" | "succeeded" | "failed";
  readonly lines: readonly string[];
}

export interface LocalRepositoryValue {
  readonly commits: Accessor<ForgeSection<readonly GitCommit[]> | undefined>;
  readonly changedFiles: Accessor<GitResult<readonly GitFileChange[]>>;
  readonly stashes: Accessor<GitResult<readonly GitStash[]>>;
  branches(scope: GitBranchScope): GitResult<readonly GitBranch[]>;
  readonly hasUnpushedCommits: Accessor<boolean>;
  readonly remoteLog: RemoteLog;
  push(): Promise<void>;
  pull(): Promise<void>;
  deleteRemoteBranch(name: string): Promise<void>;
  deleteBranch(
    name: string,
    force: boolean,
  ): Promise<Result<void, GitError | GitBranchNotMergedError>>;
  dropStash(ref: string): Promise<Result<void, GitError>>;
  dismissRemoteLog(): void;
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
  const cwd = () => forgeContext.state().cwd;
  const [remoteLog, setRemoteLog] = createStore<{
    title: string;
    status: RemoteLog["status"];
    lines: string[];
  }>({ title: "", status: "idle", lines: [] });
  const [commits, { refetch: refetchCommits }] = createResource(
    localCwd,
    readCommits,
  );
  const [changedFiles, { refetch: refetchChangedFiles }] = createResource(
    localCwd,
    readChangedFiles,
  );
  const [workingTreePatch, { refetch: refetchWorkingTreePatch }] =
    createResource(localCwd, readWorkingTreePatch);
  const [localBranches, { refetch: refetchLocalBranches }] = createResource(
    cwd,
    (path) => readBranches(path, "local"),
  );
  const [remoteBranches, { refetch: refetchRemoteBranches }] = createResource(
    cwd,
    (path) => readBranches(path, "remote"),
  );
  const [stashes, { refetch: refetchStashes }] = createResource(
    cwd,
    readStashes,
  );

  async function runRemote(
    title: string,
    command: typeof pushBranch,
  ): Promise<void> {
    if (remoteLog.status === "running") {
      return;
    }
    setRemoteLog({ title, status: "running", lines: [] });
    const result = await command(cwd(), (line) =>
      setRemoteLog("lines", remoteLog.lines.length, line),
    );
    await Promise.all([
      refetchCommits(),
      refetchChangedFiles(),
      refetchWorkingTreePatch(),
      refetchLocalBranches(),
      refetchRemoteBranches(),
    ]);
    setRemoteLog("status", result.isOk() ? "succeeded" : "failed");
  }
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
      void readCommitPatch(cwd(), sha).then((result) => {
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
    stashes: () => stashes.latest,
    branches: (scope) =>
      scope === "local" ? localBranches.latest : remoteBranches.latest,
    hasUnpushedCommits: () => {
      const result = commits.latest;
      return (
        result !== undefined &&
        result.isOk() &&
        result.value.some((commit) => !commit.pushed)
      );
    },
    remoteLog,
    push: () => runRemote("Push", pushBranch),
    pull: () => runRemote("Sync", pullBranch),
    deleteRemoteBranch: (name) =>
      runRemote(`Delete ${name}`, (path, onLine) =>
        deleteRemoteBranch(path, name, onLine),
      ),
    deleteBranch: async (name, force) => {
      const deleted = await deleteBranch(cwd(), name, force);
      await refetchLocalBranches();
      return deleted;
    },
    dropStash: async (ref) => {
      const dropped = await dropStash(cwd(), ref);
      await refetchStashes();
      return dropped;
    },
    dismissRemoteLog: () => {
      if (remoteLog.status !== "running") {
        setRemoteLog({ status: "idle", lines: [] });
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
