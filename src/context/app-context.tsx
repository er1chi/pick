import { Result } from "better-result";
import { createContext, useContext } from "solid-js";
import type { JSX } from "@opentui/solid";
import {
  GithubService,
  type GithubServiceInitializationError,
} from "@/services/forge/github-service";
import {
  ForgejoService,
  type ForgejoServiceInitializationError,
} from "@/services/forge/forgejo-service";

export type AppContextState =
  | {
      readonly kind: "application";
    }
  | {
      readonly kind: "github";
      readonly github: Result<GithubService, GithubServiceInitializationError>;
    }
  | {
      readonly kind: "forgejo";
      readonly forgejo: Result<
        ForgejoService,
        ForgejoServiceInitializationError
      >;
    };

type RemoteEntry = {
  readonly url: string;
};

const remoteEntryPattern = /^\S+\s+(\S+)\s+\((?:fetch|push)\)$/;
const githubScpRemotePattern = /^[^@/\s]+@([^:/\s]+):\S+$/;

function parseRemoteEntries(output: string): RemoteEntry[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = remoteEntryPattern.exec(line.trim());
    const url = match?.[1];

    return url ? [{ url }] : [];
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

type GitRemoteError =
  | {
      readonly code: "git-unavailable";
    }
  | {
      readonly code: "git-command-failed";
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
    catch: () => ({ code: "git-unavailable" as const }),
  });

  return execution.andThen(({ stdout, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err({ code: "git-command-failed" as const, exitCode }),
  );
}

export async function initializeAppContext(
  cwd = process.cwd(),
): Promise<AppContextState> {
  const remoteEntries = (await readGitRemoteOutput(cwd))
    .map(parseRemoteEntries)
    .unwrapOr([]);
  if (remoteEntries.length === 0) {
    return { kind: "application" };
  }

  if (remoteEntries.some(({ url }) => isGithubRemoteUrl(url))) {
    return {
      kind: "github",
      github: await GithubService.initialize(),
    };
  }

  return {
    kind: "forgejo",
    forgejo: await ForgejoService.initialize(),
  };
}

type AppContextProviderProps = {
  readonly value: AppContextState;
  readonly children: JSX.Element;
};

const AppContext = createContext<AppContextState>();

export function AppContextProvider(
  props: AppContextProviderProps,
): JSX.Element {
  return (
    <AppContext.Provider value={props.value}>
      {props.children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextState {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }

  return context;
}
