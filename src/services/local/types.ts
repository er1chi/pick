import { TaggedError } from "better-result";

import type { PullRequestCommit } from "@/services/forge/types";

export class GitUnavailableError extends TaggedError("GitUnavailableError")<{
  readonly message: string;
}> {}

export class GitCommandFailedError extends TaggedError(
  "GitCommandFailedError",
)<{
  readonly exitCode: number;
  readonly message: string;
}> {}

export type GitError = GitUnavailableError | GitCommandFailedError;

export type GitBranchScope = "local" | "remote";

export interface GitBranch {
  readonly name: string;
  readonly current: boolean;
}

export interface GitStash {
  readonly ref: string;
  readonly message: string;
}

/** A local commit, shaped like a forge's pull request commit, plus whether a
 * remote branch already contains it. */
export interface GitCommit extends PullRequestCommit {
  readonly pushed: boolean;
}

export interface GitFileChange {
  readonly path: string;
  readonly status: string;
}
