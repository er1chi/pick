import { Result, TaggedError } from "better-result";
import { resolve } from "node:path";
import { createContext, createSignal, useContext } from "solid-js";
import { ForgeService } from "@/services/forge/forge-service";
import {
  ApplicationContext,
  type ForgeInitializationError,
  type ForgeKind,
} from "@/services/forge/types";
import { readGitRemoteOutput } from "@/services/local/local";

import type { JSX } from "@opentui/solid";
import type { Result as ResultType } from "better-result";
import type { Accessor } from "solid-js";

interface ForgeContextBase<T extends ApplicationContext> {
  readonly cwd: string;
  readonly kind: T;
}

interface ExistingForgeState {
  readonly forge: ForgeService;
  readonly forgeError: undefined;
}

interface NoForge {
  readonly forge: undefined;
}

interface ForgeErrorState extends NoForge {
  readonly forgeError: ForgeInitializationError;
}

type RemoteForgeContextState = ForgeContextBase<ForgeKind> &
  (ExistingForgeState | ForgeErrorState);

type LocalForgeContextState = (
  | ForgeContextBase<ApplicationContext.Default>
  | ForgeContextBase<ApplicationContext.Local>
) &
  NoForge;

export type ForgeContextState =
  | LocalForgeContextState
  | RemoteForgeContextState;

export type RepositoryForgeContextState = Exclude<
  ForgeContextState,
  ForgeContextBase<ApplicationContext.Default> & NoForge
>;

class RepositoryDirectoryChangeFailedError extends TaggedError(
  "RepositoryDirectoryChangeFailedError",
)<{
  readonly path: string;
  readonly message: string;
}> {}

class RepositoryContextInitializationFailedError extends TaggedError(
  "RepositoryContextInitializationFailedError",
)<{
  readonly path: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export type RepositorySelectionError =
  | RepositoryDirectoryChangeFailedError
  | RepositoryContextInitializationFailedError;

type RepositorySelectionResult = ResultType<void, RepositorySelectionError>;

const remoteEntryPattern = /^\S+\s+(\S+)\s+\((?:fetch|push)\)$/;
const githubScpRemotePattern = /^[^@/\s]+@([^:/\s]+):\S+$/;

function parseRemoteUrls(output: string): string[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = remoteEntryPattern.exec(line.trim());
    const url = match?.[1];

    return url ? [url] : [];
  });
}

function isGithubRemoteUrl(url: string): boolean {
  const scpMatch = githubScpRemotePattern.exec(url);
  if (scpMatch?.[1]?.toLowerCase() === "github.com") {
    return true;
  }

  return Result.try(() => new URL(url))
    .map(({ hostname }) => hostname.toLowerCase() === "github.com")
    .unwrapOr(false);
}

export async function initializeForgeContext(
  cwd = process.cwd(),
): Promise<ForgeContextState> {
  const activeCwd = resolve(cwd);
  const remoteOutput = await readGitRemoteOutput(activeCwd);
  if (remoteOutput.isErr()) {
    return {
      cwd: activeCwd,
      kind: ApplicationContext.Default,
      forge: undefined,
    };
  }

  const remoteUrls = parseRemoteUrls(remoteOutput.value);
  if (remoteUrls.length === 0) {
    return {
      cwd: activeCwd,
      kind: ApplicationContext.Local,
      forge: undefined,
    };
  }

  const kind = remoteUrls.some(isGithubRemoteUrl)
    ? ApplicationContext.GitHub
    : ApplicationContext.Forgejo;
  const initialization = await ForgeService.initialize(kind, activeCwd);

  if (initialization.isErr()) {
    return {
      cwd: activeCwd,
      kind,
      forge: undefined,
      forgeError: initialization.error,
    };
  }

  return {
    cwd: activeCwd,
    kind,
    forge: initialization.value,
    forgeError: undefined,
  };
}

type ForgeContextProviderProps = {
  readonly value: ForgeContextState;
  readonly children: JSX.Element;
};

export type ForgeContextValue = {
  readonly state: Accessor<ForgeContextState>;
  readonly selectRepository: (
    repositoryPath: string,
  ) => Promise<RepositorySelectionResult>;
};

const ForgeContext = createContext<ForgeContextValue>();

export function ForgeContextProvider(
  props: ForgeContextProviderProps,
): JSX.Element {
  const [state, setState] = createSignal(props.value);

  const selectRepository = async (
    repositoryPath: string,
  ): Promise<RepositorySelectionResult> => {
    const path = resolve(repositoryPath);
    const initialization = await Result.tryPromise({
      try: () => initializeForgeContext(path),
      catch: (cause) =>
        new RepositoryContextInitializationFailedError({
          path,
          cause,
          message: "Could not initialize the repository context",
        }),
    });

    if (initialization.isErr()) {
      return initialization;
    }

    const changeDirectory = Result.try({
      try: () => {
        process.chdir(path);
      },
      catch: () =>
        new RepositoryDirectoryChangeFailedError({
          path,
          message: `Could not change directory to ${path}`,
        }),
    });

    if (changeDirectory.isErr()) {
      return changeDirectory;
    }

    setState({ ...initialization.value, cwd: process.cwd() });
    return Result.ok();
  };

  const context: ForgeContextValue = { state, selectRepository };

  return (
    <ForgeContext.Provider value={context}>
      {props.children}
    </ForgeContext.Provider>
  );
}

export function useForgeContext(): ForgeContextValue {
  const context = useContext(ForgeContext);
  if (context === undefined) {
    throw new Error(
      "useForgeContext must be used within a ForgeContextProvider",
    );
  }

  return context;
}
