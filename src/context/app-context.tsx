import { Result } from "better-result";
import { resolve } from "node:path";
import { createContext, createSignal, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { Result as ResultType } from "better-result";
import { ForgeService } from "@/services/forge/forge-service";
import {
  ApplicationContext,
  type ForgeInitializationError,
  type ForgeKind,
  type ForgeOperationError,
  type PullRequestList,
  type PullRequestListOptions,
  type PullRequestOverview,
  type PullRequestOverviewOptions,
  type PullRequestResource,
  type PullRequestResourceKind,
  type PullRequestResourceOptions,
} from "@/services/forge/types";

interface AppContextBase<T extends ApplicationContext> {
  readonly cwd: string;
  readonly kind: T;
}

interface ExistingForgeState {
  readonly forgeError: undefined;
}

interface ForgeErrorState {
  readonly forgeError: ForgeInitializationError;
}

type RemoteAppContextState = AppContextBase<ForgeKind> &
  (ExistingForgeState | ForgeErrorState);
type LocalAppContextState =
  | AppContextBase<ApplicationContext.Default>
  | AppContextBase<ApplicationContext.Local>;
export type AppContextState = LocalAppContextState | RemoteAppContextState;

export type RepositoryAppContextState = Exclude<
  AppContextState,
  AppContextBase<ApplicationContext.Default>
>;

export interface AppContextBootstrap {
  readonly state: AppContextState;
  readonly forge: ForgeService | undefined;
}

export enum ForgeContextErrorCode {
  NoActiveForge = "no-active-forge",
}

export type ForgeContextError =
  | ForgeOperationError
  | {
      readonly code: ForgeContextErrorCode.NoActiveForge;
      readonly cwd: string;
    };

interface ForgeContext {
  readonly getPullRequests: (
    options?: PullRequestListOptions,
  ) => Promise<ResultType<PullRequestList, ForgeContextError>>;
  readonly getPullRequestOverview: (
    number: number,
    options?: PullRequestOverviewOptions,
  ) => Promise<ResultType<PullRequestOverview, ForgeContextError>>;
  readonly getPullRequestResource: (
    number: number,
    resourceKind: PullRequestResourceKind,
    options?: PullRequestResourceOptions,
  ) => Promise<ResultType<PullRequestResource, ForgeContextError>>;
}

export enum RepositorySelectionErrorCode {
  DirectoryChangeFailed = "directory-change-failed",
  ContextInitializationFailed = "context-initialization-failed",
  TransitionInProgress = "transition-in-progress",
}

export type RepositorySelectionError = {
  readonly code: RepositorySelectionErrorCode;
  readonly path: string;
};

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

enum GitRemoteErrorCode {
  GitUnavailable = "git-unavailable",
  GitCommandFailed = "git-command-failed",
}

type GitRemoteError =
  | {
      readonly code: GitRemoteErrorCode.GitUnavailable;
    }
  | {
      readonly code: GitRemoteErrorCode.GitCommandFailed;
      readonly exitCode: number;
    };

async function readGitRemoteOutput(
  cwd: string,
): Promise<Result<string, GitRemoteError>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn(["git", "remote", "-v"], {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, , exitCode] = await Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]);

      return { stdout, exitCode };
    },
    catch: (): GitRemoteError => ({
      code: GitRemoteErrorCode.GitUnavailable,
    }),
  });

  return execution.andThen(({ stdout, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err<never, GitRemoteError>({
          code: GitRemoteErrorCode.GitCommandFailed,
          exitCode,
        }),
  );
}

export async function initializeAppContext(
  cwd = process.cwd(),
): Promise<AppContextBootstrap> {
  const activeCwd = resolve(cwd);
  const remoteOutput = await readGitRemoteOutput(activeCwd);
  if (remoteOutput.isErr()) {
    return {
      state: {
        cwd: activeCwd,
        kind: ApplicationContext.Default,
      },
      forge: undefined,
    };
  }

  const remoteUrls = parseRemoteUrls(remoteOutput.value);
  if (remoteUrls.length === 0) {
    return {
      state: {
        cwd: activeCwd,
        kind: ApplicationContext.Local,
      },
      forge: undefined,
    };
  }

  const kind = remoteUrls.some(isGithubRemoteUrl)
    ? ApplicationContext.GitHub
    : ApplicationContext.Forgejo;
  const initialization = await ForgeService.initialize(kind, activeCwd);

  if (initialization.isErr()) {
    return {
      state: {
        cwd: activeCwd,
        kind,
        forgeError: initialization.error,
      },
      forge: undefined,
    };
  }

  return {
    state: {
      cwd: activeCwd,
      kind,
      forgeError: undefined,
    },
    forge: initialization.value,
  };
}

type AppContextProviderProps = {
  readonly value: AppContextBootstrap;
  readonly children: JSX.Element;
};

export type AppContextValue = {
  readonly state: Accessor<AppContextState>;
  readonly forge: ForgeContext;
  readonly selectRepository: (
    repositoryPath: string,
  ) => Promise<RepositorySelectionResult>;
};

const AppContext = createContext<AppContextValue>();

export function AppContextProvider(
  props: AppContextProviderProps,
): JSX.Element {
  const [state, setState] = createSignal(props.value.state);
  const [activeForge, setActiveForge] = createSignal<ForgeService | undefined>(
    props.value.forge,
  );
  let transitionInProgress = false;

  function runWithActiveForge<T>(
    operation: (
      service: ForgeService,
    ) => Promise<ResultType<T, ForgeOperationError>>,
  ): Promise<ResultType<T, ForgeContextError>> {
    const service = activeForge();
    if (service === undefined) {
      return Promise.resolve(
        Result.err({
          code: ForgeContextErrorCode.NoActiveForge,
          cwd: state().cwd,
        }),
      );
    }
    return operation(service);
  }

  const forge: ForgeContext = {
    getPullRequests: (options) =>
      runWithActiveForge((service) => service.getPullRequests(options)),
    getPullRequestOverview: (number, options) =>
      runWithActiveForge((service) =>
        service.getPullRequestOverview(number, options),
      ),
    getPullRequestResource: (number, resourceKind, options) =>
      runWithActiveForge((service) =>
        service.getPullRequestResource(number, resourceKind, options),
      ),
  };

  const selectRepository = async (
    repositoryPath: string,
  ): Promise<RepositorySelectionResult> => {
    const path = resolve(repositoryPath);
    if (transitionInProgress) {
      return Result.err<void, RepositorySelectionError>({
        code: RepositorySelectionErrorCode.TransitionInProgress,
        path,
      });
    }

    transitionInProgress = true;
    const previousForge = activeForge();
    setActiveForge(undefined);
    try {
      const initialization = await Result.tryPromise({
        try: () => initializeAppContext(path),
        catch: (): RepositorySelectionError => ({
          code: RepositorySelectionErrorCode.ContextInitializationFailed,
          path,
        }),
      });

      if (initialization.isErr()) {
        setActiveForge(previousForge);
        return initialization;
      }

      const changeDirectory = Result.try({
        try: () => {
          process.chdir(path);
        },
        catch: (): RepositorySelectionError => ({
          code: RepositorySelectionErrorCode.DirectoryChangeFailed,
          path,
        }),
      });

      if (changeDirectory.isErr()) {
        setActiveForge(previousForge);
        return changeDirectory;
      }

      setState({ ...initialization.value.state, cwd: process.cwd() });
      setActiveForge(initialization.value.forge);
      return Result.ok();
    } finally {
      transitionInProgress = false;
    }
  };

  const context: AppContextValue = { state, forge, selectRepository };

  return (
    <AppContext.Provider value={context}>{props.children}</AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }

  return context;
}
