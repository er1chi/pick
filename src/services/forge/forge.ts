import { Result } from "better-result";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import { ForgeKind } from "./types";

import type { Forge, ForgeInitializationError } from "./types";

const remoteEntryPattern = /^\S+\s+(\S+)\s+\((?:fetch|push)\)$/;
const githubScpRemotePattern = /^[^@/\s]+@([^:/\s]+):\S+$/;

export async function initializeForge(
  kind: ForgeKind,
  cwd: string,
): Promise<Result<Forge, ForgeInitializationError>> {
  return kind === ForgeKind.GitHub
    ? GithubService.initialize(cwd)
    : ForgejoService.initialize(cwd);
}

/** The forge behind `git remote -v` output, or `undefined` when the
 * repository has no remotes. Any non-GitHub remote is treated as Forgejo. */
export function forgeKindForRemotes(
  remoteOutput: string,
): ForgeKind | undefined {
  const urls = remoteOutput.split(/\r?\n/).flatMap((line) => {
    const url = remoteEntryPattern.exec(line.trim())?.[1];
    return url ? [url] : [];
  });
  if (urls.length === 0) {
    return undefined;
  }
  return urls.some(isGithubRemoteUrl) ? ForgeKind.GitHub : ForgeKind.Forgejo;
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
