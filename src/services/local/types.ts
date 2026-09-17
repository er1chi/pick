export enum GitRemoteErrorCode {
  GitUnavailable = "git-unavailable",
  GitCommandFailed = "git-command-failed",
}

export type GitRemoteError =
  | {
      readonly code: GitRemoteErrorCode.GitUnavailable;
    }
  | {
      readonly code: GitRemoteErrorCode.GitCommandFailed;
      readonly exitCode: number;
    };
