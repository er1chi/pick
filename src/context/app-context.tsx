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
} from "@/services/forge/types";

export type AppContextState =
  | {
      readonly cwd: string;
      readonly kind: ApplicationContext.Default;
      readonly forge: undefined;
      readonly forgeError: undefined;
    }
  | {
      readonly cwd: string;
      readonly kind: ApplicationContext.Local;
      readonly forge: undefined;
      readonly forgeError: undefined;
    }
  | {
      readonly cwd: string;
      readonly kind: ForgeKind;
      readonly forge: ForgeService;
      readonly forgeError: undefined;
    }
  | {
      readonly cwd: string;
      readonly kind: ForgeKind;
      readonly forge: undefined;
      readonly forgeError: ForgeInitializationError;
    };

type LocalAppContextState = Extract<
  AppContextState,
  { readonly kind: ApplicationContext.Local }
>;

type RemoteAppContextState = Extract<
  AppContextState,
  { readonly kind: ForgeKind }
>;

export type RepositoryAppContextState =
  | LocalAppContextState
  | RemoteAppContextState;

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
): Promise<AppContextState> {
  const activeCwd = resolve(cwd);
  const remoteOutput = await readGitRemoteOutput(activeCwd);
  if (remoteOutput.isErr()) {
    return {
      cwd: activeCwd,
      kind: ApplicationContext.Default,
      forge: undefined,
      forgeError: undefined,
    };
  }

  const remoteUrls = parseRemoteUrls(remoteOutput.value);
  if (remoteUrls.length === 0) {
    return {
      cwd: activeCwd,
      kind: ApplicationContext.Local,
      forge: undefined,
      forgeError: undefined,
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

type AppContextProviderProps = {
  readonly value: AppContextState;
  readonly children: JSX.Element;
};

export type AppContextValue = {
  readonly state: Accessor<AppContextState>;
  readonly selectRepository: (
    repositoryPath: string,
  ) => Promise<RepositorySelectionResult>;
};

const AppContext = createContext<AppContextValue>();

export function AppContextProvider(
  props: AppContextProviderProps,
): JSX.Element {
  const [state, setState] = createSignal(props.value);
  let transitionInProgress = false;

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
    try {
      const initialization = await Result.tryPromise({
        try: () => initializeAppContext(path),
        catch: (): RepositorySelectionError => ({
          code: RepositorySelectionErrorCode.ContextInitializationFailed,
          path,
        }),
      });

      if (initialization.isErr()) {
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
        return changeDirectory;
      }

      setState({ ...initialization.value, cwd: process.cwd() });
      return Result.ok();
    } finally {
      transitionInProgress = false;
    }
  };

  const context: AppContextValue = { state, selectRepository };

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
