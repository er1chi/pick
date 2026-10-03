import { Result } from "better-result";
import { runCli } from "@/utils/cli";
import { GitCommandFailedError, GitUnavailableError } from "./types";

import type { PullRequestPatch } from "@/services/forge/types";
import type {
  GitBranch,
  GitBranchScope,
  GitCommit,
  GitError,
  GitFileChange,
  GitStash,
} from "./types";

async function runGit(
  cwd: string,
  args: readonly string[],
  okExitCodes: readonly number[] = [0],
): Promise<Result<string, GitError>> {
  const execution = await runCli("git", args, cwd);
  return execution
    .mapError(
      (error): GitError => new GitUnavailableError({ message: error.message }),
    )
    .andThen(({ stdout, exitCode }) =>
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

const branchFormat = "--format=%(HEAD)\t%(refname:short)\t%(symref)";

export async function readBranches(
  cwd: string,
  scope: GitBranchScope,
): Promise<Result<readonly GitBranch[], GitError>> {
  const args =
    scope === "remote"
      ? ["branch", "-r", branchFormat]
      : ["branch", branchFormat];
  const output = await runGit(cwd, args);
  return output.map((text) =>
    text.split("\n").flatMap((line) => {
      const [head, name, symref] = line.split("\t");
      return name === undefined || name === "" || symref !== ""
        ? []
        : [{ name, current: head === "*" }];
    }),
  );
}

export async function readStashes(
  cwd: string,
): Promise<Result<readonly GitStash[], GitError>> {
  const output = await runGit(cwd, ["stash", "list", "--format=%gd%x09%s"]);
  return output.map((text) =>
    text.split("\n").flatMap((line) => {
      const [ref, ...message] = line.split("\t");
      return ref === undefined || ref === ""
        ? []
        : [{ ref, message: message.join("\t") }];
    }),
  );
}

const commitLimit = 200;

// Fields are NUL-separated and records end with a record separator, since a
// full commit message can hold any other delimiter.
const commitFields = ["%H", "%an", "%cn", "%aI", "%cI", "%B"];
const commitFormat = `--format=${commitFields.join("%x00")}%x1e`;

function parseCommit(
  record: string,
  unpushed: ReadonlySet<string>,
): readonly GitCommit[] {
  const [
    sha = "",
    author = "",
    committer = "",
    authoredAt = "",
    committedAt = "",
    ...message
  ] = record.replace(/^\n/, "").split("\0");
  return sha === ""
    ? []
    : [
        {
          sha,
          message: message.join("\0").trimEnd(),
          author: author === "" ? null : { login: author },
          committer: committer === "" ? null : { login: committer },
          authoredAt: authoredAt === "" ? null : authoredAt,
          committedAt: committedAt === "" ? null : committedAt,
          url: null,
          pushed: !unpushed.has(sha),
        },
      ];
}

export async function readCommits(
  cwd: string,
): Promise<Result<readonly GitCommit[], GitError>> {
  const limit = `--max-count=${commitLimit}`;
  const [log, localOnly] = await Promise.all([
    runGit(cwd, ["log", limit, commitFormat]),
    runGit(cwd, ["log", limit, "--format=%H", "HEAD", "--not", "--remotes"]),
  ]);
  return Result.gen(function* () {
    const unpushed = new Set((yield* localOnly).split("\n"));
    const text = yield* log;
    return Result.ok(
      text.split("\x1e").flatMap((record) => parseCommit(record, unpushed)),
    );
  });
}

export async function readChangedFiles(
  cwd: string,
): Promise<Result<readonly GitFileChange[], GitError>> {
  const output = await runGit(cwd, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  return output.map((text) => {
    const entries = text.split("\0");
    const files: GitFileChange[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index] ?? "";
      if (entry.length < 4) {
        continue;
      }
      const status = entry.slice(0, 2);
      files.push({ path: entry.slice(3), status });
      if (/[RC]/.test(status)) {
        index += 1;
      }
    }
    return files;
  });
}

const diffOptions = ["--no-color", "--no-ext-diff"];

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

export async function readCommitPatch(
  cwd: string,
  sha: string,
): Promise<Result<PullRequestPatch, GitError>> {
  const output = await runGit(cwd, [
    "show",
    ...diffOptions,
    "--format=",
    "--diff-merges=first-parent",
    sha,
  ]);
  return output.map((text) => ({ text }));
}
