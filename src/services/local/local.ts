import { Result } from "better-result";
import { GitCommandFailedError, GitUnavailableError } from "./types";

import type { GitCommit, GitError } from "./types";

/** Runs git and returns its stdout. `okExitCodes` lists the codes that mean
 * success, since some commands (like `diff --no-index`) exit 1 on a result. */
async function runGit(
  cwd: string,
  args: readonly string[],
  okExitCodes: readonly number[] = [0],
): Promise<Result<string, GitError>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn(["git", ...args], {
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
    catch: () =>
      new GitUnavailableError({
        message: "git could not be executed",
      }),
  });

  return execution.andThen(({ stdout, exitCode }) =>
    okExitCodes.includes(exitCode)
      ? Result.ok(stdout)
      : Result.err<never, GitError>(
          new GitCommandFailedError({
            exitCode,
            message: `git ${args.join(" ")} exited with code ${exitCode}`,
          }),
        ),
  );
}

export async function readGitRemoteOutput(
  cwd: string,
): Promise<Result<string, GitError>> {
  return runGit(cwd, ["remote", "-v"]);
}

const commitLimit = 200;

/** The most recent commits on the checked-out branch, newest first. A commit
 * counts as pushed once any remote-tracking branch reaches it. */
export async function readCommits(
  cwd: string,
): Promise<Result<readonly GitCommit[], GitError>> {
  const limit = `--max-count=${commitLimit}`;
  const [log, localOnly] = await Promise.all([
    runGit(cwd, ["log", limit, "--format=%H%x09%s"]),
    // Both walks share one order, so the local commits among the listed ones
    // are always within the same limit.
    runGit(cwd, ["log", limit, "--format=%H", "HEAD", "--not", "--remotes"]),
  ]);
  return Result.gen(function* () {
    const unpushed = new Set((yield* localOnly).split("\n"));
    const text = yield* log;
    return Result.ok(
      text.split("\n").flatMap((line) => {
        const [sha, ...subject] = line.split("\t");
        return sha === undefined || sha === ""
          ? []
          : [{ sha, message: subject.join("\t"), pushed: !unpushed.has(sha) }];
      }),
    );
  });
}

/** Paths with uncommitted changes, staged or not, including untracked files. */
export async function readChangedFiles(
  cwd: string,
): Promise<Result<readonly string[], GitError>> {
  const output = await runGit(cwd, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  return output.map((text) => {
    const entries = text.split("\0");
    const paths: string[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index] ?? "";
      if (entry.length < 4) {
        continue;
      }
      paths.push(entry.slice(3));
      // Renames and copies are followed by an entry holding the source path.
      if (/[RC]/.test(entry.slice(0, 2))) {
        index += 1;
      }
    }
    return paths;
  });
}

const diffOptions = ["--no-color", "--no-ext-diff"];

/** Every uncommitted change as one patch: staged and unstaged edits to tracked
 * files against `HEAD`, followed by each untracked file as an addition. */
export async function readWorkingTreePatch(
  cwd: string,
): Promise<Result<string, GitError>> {
  const [tracked, untracked] = await Promise.all([
    runGit(cwd, ["diff", ...diffOptions, "HEAD"]),
    runGit(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  if (untracked.isErr()) {
    return untracked;
  }
  const additions = await Promise.all(
    untracked.value
      .split("\0")
      .filter((path) => path !== "")
      .map((path) =>
        runGit(
          cwd,
          ["diff", ...diffOptions, "--no-index", "--", "/dev/null", path],
          [0, 1],
        ),
      ),
  );
  return Result.all([tracked, ...additions]).map((parts) => parts.join(""));
}
