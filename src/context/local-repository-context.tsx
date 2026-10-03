import { createContext, createResource, useContext } from "solid-js";
import { available, unsupported } from "@/services/forge/section";
import { readCommits } from "@/services/local/local";
import { useForgeContext } from "./forge-context";
import { useViewContext } from "./view-context";

import type { JSX } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ForgeSection } from "@/services/forge/types";
import type { GitCommit } from "@/services/local/types";

export interface LocalRepositoryValue {
  readonly commits: Accessor<ForgeSection<readonly GitCommit[]> | undefined>;
}

const LocalRepositoryContext = createContext<LocalRepositoryValue>();

export function LocalRepositoryProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const forgeContext = useForgeContext();
  const viewContext = useViewContext();
  const [commits] = createResource(
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
