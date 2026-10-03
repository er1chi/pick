import { TaggedError } from "better-result";

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

export interface GitCommit {
  readonly sha: string;
  readonly message: string;
  readonly pushed: boolean;
}

export interface GitFileChange {
  readonly path: string;
  readonly status: string;
}
