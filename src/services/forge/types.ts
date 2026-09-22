import { TaggedError } from "better-result";

import type { Result } from "better-result";

export enum ApplicationContext {
  Default = "application",
  Local = "local",
  GitHub = "github",
  Forgejo = "forgejo",
}

export type ForgeKind = ApplicationContext.GitHub | ApplicationContext.Forgejo;

export enum PullRequestState {
  Open = "open",
  Closed = "closed",
  Merged = "merged",
  Unknown = "unknown",
}

export type PullRequestListState = "open" | "closed" | "all";

export class ForgeExecutableUnavailableError extends TaggedError(
  "ForgeExecutableUnavailableError",
)<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeVersionCheckFailedError extends TaggedError(
  "ForgeVersionCheckFailedError",
)<{
  readonly kind: ForgeKind;
  readonly exitCode: number;
  readonly message: string;
}> {}

export type ForgeInitializationError =
  | ForgeExecutableUnavailableError
  | ForgeVersionCheckFailedError;

export class ForgeCommandSpawnFailedError extends TaggedError(
  "ForgeCommandSpawnFailedError",
)<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeCommandFailedError extends TaggedError(
  "ForgeCommandFailedError",
)<{
  readonly kind: ForgeKind;
  readonly exitCode: number;
  readonly message: string;
}> {}

export class ForgeOutputLimitExceededError extends TaggedError(
  "ForgeOutputLimitExceededError",
)<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeCancelledError extends TaggedError("ForgeCancelledError")<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeTimedOutError extends TaggedError("ForgeTimedOutError")<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeInvalidRequestError extends TaggedError(
  "ForgeInvalidRequestError",
)<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeInvalidJsonError extends TaggedError(
  "ForgeInvalidJsonError",
)<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

export class ForgeIncompatibleResponseError extends TaggedError(
  "ForgeIncompatibleResponseError",
)<{
  readonly kind: ForgeKind;
  readonly message: string;
}> {}

/** Raised by the service boundary when an operation throws unexpectedly. */
export class ForgeUnexpectedError extends TaggedError("ForgeUnexpectedError")<{
  readonly kind: ForgeKind;
  readonly cause: unknown;
  readonly message: string;
}> {}

export type CliExecutionError =
  | ForgeCommandSpawnFailedError
  | ForgeCommandFailedError
  | ForgeOutputLimitExceededError
  | ForgeCancelledError
  | ForgeTimedOutError;

export type ForgeOperationError =
  | CliExecutionError
  | ForgeInvalidRequestError
  | ForgeInvalidJsonError
  | ForgeIncompatibleResponseError
  | ForgeUnexpectedError;

export interface ForgeRepository {
  readonly fullName: string;
  readonly owner: string;
  readonly name: string;
  readonly url: string | null;
}

export interface ForgeUser {
  readonly id: string | null;
  readonly login: string;
  readonly displayName: string | null;
  readonly url: string | null;
}

export interface ForgeTeam {
  readonly id: string | null;
  readonly name: string;
  readonly slug: string | null;
  readonly url: string | null;
}

export interface PullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly state: PullRequestState;
  readonly isDraft: boolean | null;
  readonly author: ForgeUser | null;
  readonly updatedAt: string | null;
  readonly url: string | null;
}

export interface PullRequestList {
  readonly repository: ForgeRepository;
  readonly items: readonly PullRequestSummary[];
  readonly truncated: boolean;
}

export interface PullRequestRef {
  readonly ref: string | null;
  readonly sha: string | null;
  readonly repository: ForgeRepository | null;
}

export interface PullRequestLabel {
  readonly id: string | null;
  readonly name: string;
  readonly color: string | null;
  readonly description: string | null;
  readonly url: string | null;
}

export interface PullRequestMilestone {
  readonly id: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly state: string | null;
  readonly dueAt: string | null;
  readonly url: string | null;
}

export interface PullRequestReviewerRequests {
  readonly users: readonly ForgeUser[];
  readonly teams: readonly ForgeTeam[];
}

interface PullRequestMergeability {
  readonly mergeable: boolean | null;
  readonly mergeState: string | null;
  readonly reviewDecision: ForgeSection<string | null>;
  readonly mergeCommitSha: string | null;
}

export interface PullRequestCommit {
  readonly sha: string;
  readonly message: string;
  readonly author: ForgeUser | null;
  readonly committer: ForgeUser | null;
  readonly authoredAt: string | null;
  readonly committedAt: string | null;
  readonly url: string | null;
}

export interface PullRequestComment {
  readonly id: string;
  readonly author: ForgeUser | null;
  readonly body: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly url: string | null;
}

export interface PullRequestReviewComment extends PullRequestComment {
  readonly location: PullRequestCommentLocation | null;
  readonly replyToId: string | null;
  readonly reviewId: string | null;
}

interface PullRequestCommentLocation {
  readonly path: string;
  readonly line: number | null;
  readonly startLine: number | null;
  readonly side: "additions" | "deletions" | "unknown";
  readonly commitSha: string | null;
}

export interface PullRequestReview {
  readonly id: string;
  readonly author: ForgeUser | null;
  readonly body: string | null;
  readonly state: string;
  readonly submittedAt: string | null;
  readonly commitSha: string | null;
  readonly url: string | null;
}

export interface PullRequestCheck {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly description: string | null;
  readonly link: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly workflow: string | null;
}

export interface PullRequestProject {
  readonly id: string;
  readonly title: string;
  readonly number: number | null;
  readonly url: string | null;
  readonly state: string | null;
  readonly kind: "v2" | "classic" | "unknown";
}

export interface PullRequestLinkedIssue {
  readonly repository: ForgeRepository | null;
  readonly number: number;
  readonly title: string | null;
  readonly state: PullRequestState;
  readonly url: string | null;
  readonly relation: "closing-reference";
}

export interface PullRequestPatch {
  readonly format: "git-patch" | "unified-diff";
  readonly text: string;
  readonly byteLength: number;
}

export enum ForgeUnsupportedReasonCode {
  ProviderDoesNotExpose = "provider-does-not-expose",
  CliDoesNotProvideJson = "cli-does-not-provide-json",
  ProviderResponseDoesNotInclude = "provider-response-does-not-include",
}

export interface ForgeUnsupportedReason {
  readonly code: ForgeUnsupportedReasonCode;
  readonly diagnostic: string;
}

export type ForgeSection<T> =
  | {
      readonly status: "available";
      readonly value: T;
      readonly truncated: boolean;
    }
  | {
      readonly status: "unsupported";
      readonly reason: ForgeUnsupportedReason;
    }
  | {
      readonly status: "failed";
      readonly error: ForgeOperationError;
    }
  | {
      readonly status: "not-requested";
    };

export interface PullRequestOverview {
  readonly repository: ForgeRepository;
  readonly number: number;
  readonly body: string | null;
  readonly conversationComments: ForgeSection<readonly PullRequestComment[]>;
}

interface PullRequestDetailsCounts {
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly conversationComments: number | null;
  readonly reviewComments: number | null;
}

export interface PullRequestDetails {
  readonly repository: ForgeRepository;
  readonly number: number;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly closedAt: string | null;
  readonly mergedAt: string | null;
  readonly mergedBy: ForgeUser | null;
  readonly base: PullRequestRef;
  readonly head: PullRequestRef;
  readonly counts: PullRequestDetailsCounts;
  readonly labels: readonly PullRequestLabel[];
  readonly assignees: readonly ForgeUser[];
  readonly milestone: PullRequestMilestone | null;
  readonly maintainerCanModify: boolean | null;
  readonly mergeability: PullRequestMergeability;
}

export interface PullRequestReviewsResource {
  readonly reviews: ForgeSection<readonly PullRequestReview[]>;
  readonly reviewComments: ForgeSection<readonly PullRequestReviewComment[]>;
  readonly requestedReviewers: ForgeSection<PullRequestReviewerRequests>;
}

export interface PullRequestDevelopment {
  readonly projects: ForgeSection<readonly PullRequestProject[]>;
  readonly linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>;
}

export interface PullRequestListOptions {
  readonly signal?: AbortSignal;
  readonly limit?: number;
  readonly state?: PullRequestListState;
}

export interface PullRequestOverviewOptions {
  readonly signal?: AbortSignal;
}

export interface PullRequestResourceOptions {
  readonly signal?: AbortSignal;
}

/** The loaded fields of one pull request. */
export interface PullRequestDocument {
  readonly overview: Result<PullRequestOverview, ForgeOperationError>;
  readonly details: Result<PullRequestDetails, ForgeOperationError>;
  readonly diff: ForgeSection<PullRequestPatch>;
  readonly commits: ForgeSection<readonly PullRequestCommit[]>;
  readonly reviews: PullRequestReviewsResource;
  readonly checks: ForgeSection<readonly PullRequestCheck[]>;
  readonly development: PullRequestDevelopment;
}

export interface ForgeAdapter {
  readonly kind: ForgeKind;

  getPullRequests(
    options?: PullRequestListOptions,
  ): Promise<Result<PullRequestList, ForgeOperationError>>;

  /**
   * Loads one pull request. GitHub issues a single `pr view` for the fields
   * that command can return, and separate calls for paginated collections and
   * the patch.
   */
  loadPullRequest(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDocument, ForgeOperationError>>;

  getPullRequestOverview(
    number: number,
    options?: PullRequestOverviewOptions,
  ): Promise<Result<PullRequestOverview, ForgeOperationError>>;

  getPullRequestDetails(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDetails, ForgeOperationError>>;

  getPullRequestDiff(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<ForgeSection<PullRequestPatch>, ForgeOperationError>>;

  getPullRequestCommits(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<
    Result<ForgeSection<readonly PullRequestCommit[]>, ForgeOperationError>
  >;

  getPullRequestReviews(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestReviewsResource, ForgeOperationError>>;

  getPullRequestChecks(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<
    Result<ForgeSection<readonly PullRequestCheck[]>, ForgeOperationError>
  >;

  getPullRequestDevelopment(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDevelopment, ForgeOperationError>>;

  /**
   * The change introduced by a single commit, as a patch of that commit against
   * its parent. Not derivable from the pull request diff, which has no commit
   * boundaries.
   */
  getCommitPatch(
    sha: string,
    options?: PullRequestResourceOptions,
  ): Promise<Result<ForgeSection<PullRequestPatch>, ForgeOperationError>>;
}
