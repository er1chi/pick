import { ForgejoService } from "./forgejo/service";
import { GithubService } from "./github/service";
import { ForgeKind } from "./types";

import type { Result } from "better-result";
import type { Forge, ForgeInitializationError } from "./types";

export async function initializeForge(
  kind: ForgeKind,
  cwd: string,
  remoteOutput: string,
): Promise<Result<Forge, ForgeInitializationError>> {
  return kind === ForgeKind.GitHub
    ? GithubService.initialize(cwd, remoteOutput)
    : ForgejoService.initialize(cwd, remoteOutput);
}
