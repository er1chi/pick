import { Result, TaggedError } from "better-result";
import { resolve } from "node:path";
import { createContext, createSignal, useContext } from "solid-js";
import { forgeKindForRemotes, initializeForge } from "@/services/forge/forge";
import { readGitRemoteOutput } from "@/services/local/local";

import type { JSX } from "@opentui/solid";
import type { Result as ResultType } from "better-result";
import type { Accessor } from "solid-js";
import type {
  Forge,
  ForgeInitializationError,
  ForgeKind,
} from "@/services/forge/types";

/** The contexts without a forge: outside any repository, and a repository
 * with no remotes. A repository with a forge is identified by its `ForgeKind`. */
export enum ApplicationContext {
  Default = "application",
  Local = "local",
}

interface ForgeContextBase<T extends ApplicationContext | ForgeKind> {
  readonly cwd: string;
  readonly kind: T;
}

interface ExistingForgeState {
  readonly forge: Forge;
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

class RepositoryContextInitializationFailedError extends TaggedError(
  "RepositoryContextInitializationFailedError",
)<{
  readonly path: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

type RepositorySelectionResult = ResultType<
  void,
  RepositoryContextInitializationFailedError
>;

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

  const kind = forgeKindForRemotes(remoteOutput.value);
  if (kind === undefined) {
    return {
      cwd: activeCwd,
      kind: ApplicationContext.Local,
      forge: undefined,
    };
  }

  const initialization = await initializeForge(kind, activeCwd);
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
  let latestSelection = 0;

  const selectRepository = async (
    repositoryPath: string,
  ): Promise<RepositorySelectionResult> => {
    const selection = ++latestSelection;
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

    if (selection !== latestSelection) {
      return Result.ok();
    }
    if (initialization.isErr()) {
      return initialization;
    }

    setState(initialization.value);
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
