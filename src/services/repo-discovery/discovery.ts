import { Result, TaggedError } from "better-result";
import { lstat, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { RepositoryDiscoveryError, type RecentRepository } from "./types";

import type { Result as ResultType } from "better-result";
import type { Dirent, Stats } from "node:fs";

const DISCOVERY_ROOT_NAME = "Developer";
const MAX_RECENT_REPOSITORIES = 8;
const DIRECTORIES_TO_SKIP = new Set([".git", "node_modules"]);
const GIT_ACTIVITY_PATHS = [
  "",
  "HEAD",
  "index",
  "logs",
  "logs/HEAD",
  "refs",
  "refs/heads",
  "refs/tags",
  "packed-refs",
  "FETCH_HEAD",
  "ORIG_HEAD",
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
] as const;

class OptionalReadFailed extends TaggedError("OptionalReadFailed")<{
  readonly path: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

class DirectoryReadFailed extends TaggedError("DirectoryReadFailed")<{
  readonly path: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

interface RepositoryCandidate {
  readonly path: string;
  readonly lastActivityAt: number;
}

interface PendingDirectory {
  readonly path: string;
  readonly entries?: readonly Dirent[];
}

async function readDirectory(
  directoryPath: string,
): Promise<ResultType<readonly Dirent[], DirectoryReadFailed>> {
  return Result.tryPromise({
    try: () => readdir(directoryPath, { withFileTypes: true }),
    catch: (cause) =>
      new DirectoryReadFailed({
        path: directoryPath,
        cause,
        message: "Could not read a directory while discovering repositories",
      }),
  });
}

async function readDiscoveryRoot(
  rootPath: string,
): Promise<ResultType<readonly Dirent[], RepositoryDiscoveryError>> {
  const entries = await readDirectory(rootPath);
  return entries.mapError(
    (error) =>
      new RepositoryDiscoveryError({
        path: rootPath,
        cause: error.cause,
        message: "Could not search the repository discovery directory",
      }),
  );
}

async function readDirectoryBestEffort(
  directoryPath: string,
): Promise<readonly Dirent[]> {
  const entries = await readDirectory(directoryPath);
  return entries.match({
    ok: (directoryEntries) => directoryEntries,
    err: () => [],
  });
}

async function readFileStats(
  filePath: string,
): Promise<ResultType<Stats, OptionalReadFailed>> {
  return Result.tryPromise({
    try: () => lstat(filePath),
    catch: (cause) =>
      new OptionalReadFailed({
        path: filePath,
        cause,
        message: "Optional repository metadata was unavailable",
      }),
  });
}

async function readFileText(
  filePath: string,
): Promise<ResultType<string, OptionalReadFailed>> {
  return Result.tryPromise({
    try: () => readFile(filePath, "utf8"),
    catch: (cause) =>
      new OptionalReadFailed({
        path: filePath,
        cause,
        message: "Optional repository metadata was unavailable",
      }),
  });
}

async function findGitMarker(
  directoryPath: string,
  entries: readonly Dirent[],
): Promise<string | null> {
  const entry = entries.find(
    (directoryEntry) => directoryEntry.name === ".git",
  );
  if (entry == null || entry.isSymbolicLink()) {
    return null;
  }

  if (entry.isDirectory() || entry.isFile()) {
    return join(directoryPath, entry.name);
  }

  const markerPath = join(directoryPath, entry.name);
  const markerStats = await readFileStats(markerPath);
  return markerStats.match({
    ok: (stats) => (stats.isDirectory() || stats.isFile() ? markerPath : null),
    err: () => null,
  });
}

async function resolveGitDirectory(
  repositoryPath: string,
  gitMarkerPath: string,
): Promise<string> {
  const markerStats = await readFileStats(gitMarkerPath);
  if (markerStats.isErr() || !markerStats.value.isFile()) {
    return gitMarkerPath;
  }

  const markerContents = await readFileText(gitMarkerPath);
  if (markerContents.isErr()) {
    return gitMarkerPath;
  }

  const firstLine = markerContents.value.split(/\r?\n/)[0]?.trim();
  const gitDirectory = firstLine?.match(/^gitdir:\s*(.+)$/i)?.[1]?.trim();

  return gitDirectory == null || gitDirectory.length === 0
    ? gitMarkerPath
    : resolve(repositoryPath, gitDirectory);
}

async function readGitPathReference(
  filePath: string,
  basePath: string,
): Promise<string | null> {
  const fileContents = await readFileText(filePath);
  if (fileContents.isErr()) {
    return null;
  }

  const firstLine = fileContents.value.split(/\r?\n/)[0]?.trim();
  return firstLine == null || firstLine.length === 0
    ? null
    : resolve(basePath, firstLine);
}

async function readModificationTime(filePath: string): Promise<number> {
  const stats = await readFileStats(filePath);
  return stats.match({
    ok: ({ mtimeMs }) => mtimeMs,
    err: () => 0,
  });
}

function addGitActivityPaths(
  paths: Set<string>,
  gitDirectoryPath: string,
): void {
  for (const activityPath of GIT_ACTIVITY_PATHS) {
    paths.add(join(gitDirectoryPath, activityPath));
  }
}

async function readRepositoryActivity(
  repositoryPath: string,
  gitMarkerPath: string,
): Promise<number> {
  const gitDirectoryPath = await resolveGitDirectory(
    repositoryPath,
    gitMarkerPath,
  );
  const activityPaths = new Set<string>([gitMarkerPath]);
  addGitActivityPaths(activityPaths, gitDirectoryPath);

  const commonGitDirectoryPath = await readGitPathReference(
    join(gitDirectoryPath, "commondir"),
    gitDirectoryPath,
  );
  if (commonGitDirectoryPath != null) {
    addGitActivityPaths(activityPaths, commonGitDirectoryPath);
  }

  const modificationTimes = await Promise.all(
    [...activityPaths].map(readModificationTime),
  );
  return Math.max(0, ...modificationTimes);
}

async function findRepositoryCandidates(
  rootPath: string,
  rootEntries: readonly Dirent[],
): Promise<readonly RepositoryCandidate[]> {
  const directories: PendingDirectory[] = [
    { path: rootPath, entries: rootEntries },
  ];
  const candidates: RepositoryCandidate[] = [];

  while (directories.length > 0) {
    const directory = directories.pop();
    if (directory == null) {
      continue;
    }

    const entries =
      directory.entries ?? (await readDirectoryBestEffort(directory.path));
    const gitMarkerPath = await findGitMarker(directory.path, entries);
    if (gitMarkerPath != null) {
      candidates.push({
        path: directory.path,
        lastActivityAt: await readRepositoryActivity(
          directory.path,
          gitMarkerPath,
        ),
      });
    }

    for (const entry of entries) {
      if (
        entry.isSymbolicLink() ||
        DIRECTORIES_TO_SKIP.has(entry.name) ||
        !entry.isDirectory()
      ) {
        continue;
      }
      directories.push({ path: join(directory.path, entry.name) });
    }
  }

  return candidates;
}

function pathDepth(rootPath: string, repositoryPath: string): number {
  const relativePath = relative(rootPath, repositoryPath);
  return relativePath.length === 0 ? 0 : relativePath.split(sep).length;
}

function isNestedPath(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function collapseNestedRepositories(
  rootPath: string,
  candidates: readonly RepositoryCandidate[],
): readonly RepositoryCandidate[] {
  const topLevelCandidates: RepositoryCandidate[] = [];
  const candidatesByDepth = [...candidates].sort(
    (left, right) =>
      pathDepth(rootPath, left.path) - pathDepth(rootPath, right.path),
  );

  for (const candidate of candidatesByDepth) {
    const ancestorIndex = topLevelCandidates.findIndex((ancestor) =>
      isNestedPath(ancestor.path, candidate.path),
    );
    if (ancestorIndex === -1) {
      topLevelCandidates.push(candidate);
      continue;
    }

    const ancestor = topLevelCandidates[ancestorIndex]!;
    if (candidate.lastActivityAt > ancestor.lastActivityAt) {
      topLevelCandidates[ancestorIndex] = {
        ...ancestor,
        lastActivityAt: candidate.lastActivityAt,
      };
    }
  }

  return topLevelCandidates;
}

function displayPath(rootPath: string, repositoryPath: string): string {
  const relativePath = relative(rootPath, repositoryPath);
  if (relativePath.length === 0) {
    return `~/${DISCOVERY_ROOT_NAME}`;
  }

  return `~/${DISCOVERY_ROOT_NAME}/${relativePath.split(sep).join("/")}`;
}

function compareRepositories(
  left: RecentRepository,
  right: RecentRepository,
): number {
  if (left.lastActivityAt !== right.lastActivityAt) {
    return right.lastActivityAt - left.lastActivityAt;
  }
  return left.displayPath.localeCompare(right.displayPath);
}

export async function discoverRecentRepositories(): Promise<
  ResultType<readonly RecentRepository[], RepositoryDiscoveryError>
> {
  const rootPath = resolve(homedir(), DISCOVERY_ROOT_NAME);
  return Result.gen(async function* () {
    const rootEntries = yield* Result.await(readDiscoveryRoot(rootPath));
    const candidates = await findRepositoryCandidates(rootPath, rootEntries);
    const topLevelRepositories = collapseNestedRepositories(
      rootPath,
      candidates,
    );

    return Result.ok(
      topLevelRepositories
        .map((repository) => ({
          name: basename(repository.path),
          path: repository.path,
          displayPath: displayPath(rootPath, repository.path),
          lastActivityAt: repository.lastActivityAt,
        }))
        .sort(compareRepositories)
        .slice(0, MAX_RECENT_REPOSITORIES),
    );
  });
}
