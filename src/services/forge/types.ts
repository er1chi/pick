import type { Result } from "better-result";

export type ForgeKind = "github" | "forgejo";

export type ForgeInitializationError =
  | {
      readonly kind: ForgeKind;
      readonly code: "executable-unavailable";
    }
  | {
      readonly kind: ForgeKind;
      readonly code: "version-check-failed";
      readonly exitCode: number;
    };

export type CliExecutionError =
  | {
      readonly kind: ForgeKind;
      readonly code: "command-spawn-failed";
      readonly diagnostic: string;
    }
  | {
      readonly kind: ForgeKind;
      readonly code: "command-failed";
      readonly exitCode: number;
      readonly diagnostic: string;
    };

export type ForgeOperationError =
  | CliExecutionError
  | {
      readonly kind: ForgeKind;
      readonly code: "invalid-json";
      readonly diagnostic: string;
    }
  | {
      readonly kind: ForgeKind;
      readonly code: "incompatible-response";
      readonly diagnostic: string;
    };

export type PullRequestState = "open" | "closed" | "merged";

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
      readonly code: "executable-unavailable";
    }
  | {
      readonly code: "version-check-failed";
      readonly exitCode: number;
    };
