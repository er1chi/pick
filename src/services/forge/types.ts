import type { Result } from "better-result";

export enum ApplicationContext {
  App = "application",
  GitHub = "github",
  Forgejo = "forgejo",
}

export type ForgeKind = ApplicationContext.GitHub | ApplicationContext.Forgejo;

export enum ForgeInitializationErrorCode {
  ExecutableUnavailable = "executable-unavailable",
  VersionCheckFailed = "version-check-failed",
}

export enum ForgeOperationErrorCode {
  CommandSpawnFailed = "command-spawn-failed",
  CommandFailed = "command-failed",
  InvalidJson = "invalid-json",
  IncompatibleResponse = "incompatible-response",
}

export enum PullRequestState {
  Open = "open",
  Closed = "closed",
  Merged = "merged",
}

export type ForgeInitializationError =
  | {
      readonly kind: ForgeKind;
      readonly code: ForgeInitializationErrorCode.ExecutableUnavailable;
    }
  | {
      readonly kind: ForgeKind;
      readonly code: ForgeInitializationErrorCode.VersionCheckFailed;
      readonly exitCode: number;
    };

export type CliExecutionError =
  | {
      readonly kind: ForgeKind;
      readonly code: ForgeOperationErrorCode.CommandSpawnFailed;
      readonly diagnostic: string;
    }
  | {
      readonly kind: ForgeKind;
      readonly code: ForgeOperationErrorCode.CommandFailed;
      readonly exitCode: number;
      readonly diagnostic: string;
    };

export type ForgeOperationError =
  | CliExecutionError
  | {
      readonly kind: ForgeKind;
      readonly code: ForgeOperationErrorCode.InvalidJson;
      readonly diagnostic: string;
    }
  | {
      readonly kind: ForgeKind;
      readonly code: ForgeOperationErrorCode.IncompatibleResponse;
      readonly diagnostic: string;
    };

export interface ForgeAuthor {
  readonly login: string;
}

export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: PullRequestState;
  readonly author: ForgeAuthor | null;
}

export interface PullRequestComment {
  readonly id: string;
  readonly author: ForgeAuthor | null;
  readonly body: string | null;
  readonly createdAt: string;
}

export interface ForgeAdapter {
  readonly kind: ForgeKind;
  getPullRequest(
    number: number,
  ): Promise<Result<PullRequest, ForgeOperationError>>;
  getPullRequestComments(
    number: number,
  ): Promise<Result<readonly PullRequestComment[], ForgeOperationError>>;
}

export type CliCheckError =
  | {
      readonly code: ForgeInitializationErrorCode.ExecutableUnavailable;
    }
  | {
      readonly code: ForgeInitializationErrorCode.VersionCheckFailed;
      readonly exitCode: number;
    };
