import { Result } from "better-result";
import { normalizeRepository } from "./normalization";
import { ForgeInvalidRequestError, ForgeKind } from "./types";

import type { ForgeOperationError, ForgeRepository } from "./types";

const remoteEntryPattern = /^(\S+)\s+(\S+)\s+\((?:fetch|push)\)$/;
const scpRemotePattern = /^[^@/\s]+@([^:/\s]+):(\S+)$/;
const githubHost = "github.com";
const webProtocols = new Set(["http:", "https:"]);

interface RemoteLocation {
  readonly host: string;
  /** The web origin of the forge, such as `https://codeberg.org`. */
  readonly origin: string;
  readonly path: string;
}

function readRemotes(remoteOutput: string) {
  return remoteOutput.split(/\r?\n/).flatMap((line) => {
    const [, name, url] = remoteEntryPattern.exec(line.trim()) ?? [];
    return name !== undefined && url !== undefined ? [{ name, url }] : [];
  });
}

function locateRemote(url: string): RemoteLocation | undefined {
  const scp = scpRemotePattern.exec(url);
  if (scp !== null) {
    const host = scp[1]?.toLowerCase() ?? "";
    return { host, origin: `https://${host}`, path: cleanPath(scp[2] ?? "") };
  }
  return Result.try(() => new URL(url))
    .map((parsed) => ({
      host: parsed.hostname.toLowerCase(),
      origin: webProtocols.has(parsed.protocol)
        ? parsed.origin
        : `https://${parsed.hostname}`,
      path: cleanPath(parsed.pathname),
    }))
    .unwrapOr(undefined);
}

function cleanPath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
}

/** The forge behind `git remote -v` output, or `undefined` when the
 * repository has no remotes. Any non-GitHub remote is treated as Forgejo. */
export function forgeKindForRemotes(
  remoteOutput: string,
): ForgeKind | undefined {
  const remotes = readRemotes(remoteOutput);
  if (remotes.length === 0) {
    return undefined;
  }
  return remotes.some(({ url }) => locateRemote(url)?.host === githubHost)
    ? ForgeKind.GitHub
    : ForgeKind.Forgejo;
}

/** The repository behind the `origin` remote, or else the first remote that
 * belongs to `kind`. */
export function repositoryForRemotes(
  kind: ForgeKind,
  remoteOutput: string,
): Result<ForgeRepository, ForgeOperationError> {
  const located = readRemotes(remoteOutput)
    .toSorted(
      (a, b) => Number(b.name === "origin") - Number(a.name === "origin"),
    )
    .flatMap(({ url }) => {
      const location = locateRemote(url);
      return location !== undefined &&
        (location.host === githubHost) === (kind === ForgeKind.GitHub)
        ? [location]
        : [];
    })[0];
  if (located === undefined) {
    return Result.err(
      new ForgeInvalidRequestError({
        kind,
        message: `No ${kind} remote to resolve the repository from`,
      }),
    );
  }
  return normalizeRepository(
    kind,
    located.path,
    `${located.origin}/${located.path}`,
  );
}
