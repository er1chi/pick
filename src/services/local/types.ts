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

export interface GitCommit {
  readonly sha: string;
  /** The commit subject, its first message line. */
  readonly message: string;
  /** Whether any remote-tracking branch already contains the commit. */
  readonly pushed: boolean;
}
