import { lstat, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

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

export interface RecentRepository {
  readonly name: string;
  readonly path: string;
  readonly displayPath: string;
  readonly lastActivityAt: number;
}

interface RepositoryCandidate {
  readonly path: string;
  readonly lastActivityAt: number;
}

async function readDirectory(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function findGitMarker(
  directoryPath: string,
  entries: Awaited<ReturnType<typeof readDirectory>>,
): Promise<string | null> {
  const entry = entries.find((entry) => entry.name === ".git");
  if (entry == null || entry.isSymbolicLink()) {
    return null;
  }

  if (entry.isDirectory() || entry.isFile()) {
    return join(directoryPath, entry.name);
  }

  const markerPath = join(directoryPath, entry.name);
  try {
    const markerStats = await lstat(markerPath);
    return markerStats.isDirectory() || markerStats.isFile()
      ? markerPath
      : null;
  } catch {
    return null;
  }
}

async function resolveGitDirectory(
  repositoryPath: string,
  gitMarkerPath: string,
): Promise<string> {
  try {
    const markerStats = await lstat(gitMarkerPath);
    if (!markerStats.isFile()) {
      return gitMarkerPath;
    }

    const markerContents = await readFile(gitMarkerPath, "utf8");
    const firstLine = markerContents.split(/\r?\n/)[0]?.trim();
    const gitDirectory = firstLine?.match(/^gitdir:\s*(.+)$/i)?.[1]?.trim();

    return gitDirectory == null || gitDirectory.length === 0
      ? gitMarkerPath
      : resolve(repositoryPath, gitDirectory);
  } catch {
    return gitMarkerPath;
  }
}

async function readGitPathReference(
  filePath: string,
  basePath: string,
): Promise<string | null> {
  try {
    const firstLine = (await readFile(filePath, "utf8"))
      .split(/\r?\n/)[0]
      ?.trim();
    return firstLine == null || firstLine.length === 0
      ? null
      : resolve(basePath, firstLine);
  } catch {
    return null;
  }
}

async function readModificationTime(filePath: string): Promise<number> {
  try {
    return (await lstat(filePath)).mtimeMs;
  } catch {
    return 0;
  }
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
): Promise<readonly RepositoryCandidate[]> {
  const directories = [rootPath];
  const candidates: RepositoryCandidate[] = [];

  while (directories.length > 0) {
    const directoryPath = directories.pop();
    if (directoryPath == null) {
      continue;
    }

    const entries = await readDirectory(directoryPath);
    const gitMarkerPath = await findGitMarker(directoryPath, entries);
    if (gitMarkerPath != null) {
      candidates.push({
        path: directoryPath,
        lastActivityAt: await readRepositoryActivity(
          directoryPath,
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
      directories.push(join(directoryPath, entry.name));
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
  readonly RecentRepository[]
> {
  const rootPath = resolve(homedir(), DISCOVERY_ROOT_NAME);
  const candidates = await findRepositoryCandidates(rootPath);
  const topLevelRepositories = collapseNestedRepositories(rootPath, candidates);

  return topLevelRepositories
    .map((repository) => ({
      name: basename(repository.path),
      path: repository.path,
      displayPath: displayPath(rootPath, repository.path),
      lastActivityAt: repository.lastActivityAt,
    }))
    .sort(compareRepositories)
    .slice(0, MAX_RECENT_REPOSITORIES);
}
