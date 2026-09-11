import type { Result } from "better-result";
import type { Comment, Issue, PullRequest } from "./models";

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

export type ForgeOperation =
  | "pullRequests.get"
  | "pullRequests.getComments"
  | "issues.create"
  | "issues.getComments";

type ForgeOperationContext = {
  readonly kind: ForgeKind;
  readonly operation: ForgeOperation;
};

export type ForgeOperationError =
  | (ForgeOperationContext & { readonly code: "cli-unavailable" })
  | (ForgeOperationContext & {
      readonly code: "authentication-required";
    })
  | (ForgeOperationContext & { readonly code: "not-found" })
  | (ForgeOperationContext & { readonly code: "permission-denied" })
  | (ForgeOperationContext & { readonly code: "command-failed" })
  | (ForgeOperationContext & { readonly code: "invalid-response" })
  | (ForgeOperationContext & { readonly code: "not-implemented" });

export interface GetPullRequestInput {
  readonly number: number;
}

export interface GetPullRequestCommentsInput {
  readonly number: number;
}

export interface CreateIssueInput {
  readonly title: string;
  readonly body?: string;
}

export interface GetIssueCommentsInput {
  readonly number: number;
}

export interface PullRequestOperations {
  get(
    input: GetPullRequestInput,
  ): Promise<Result<PullRequest, ForgeOperationError>>;
  getComments(
    input: GetPullRequestCommentsInput,
  ): Promise<Result<readonly Comment[], ForgeOperationError>>;
}

export interface IssueOperations {
  create(input: CreateIssueInput): Promise<Result<Issue, ForgeOperationError>>;
  getComments(
    input: GetIssueCommentsInput,
  ): Promise<Result<readonly Comment[], ForgeOperationError>>;
}

export interface ForgeService {
  readonly kind: ForgeKind;
  readonly pullRequests: PullRequestOperations;
  readonly issues: IssueOperations;
}
