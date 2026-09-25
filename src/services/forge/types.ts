import { TaggedError } from "better-result";

import type { Result } from "better-result";

export enum ForgeKind {
  GitHub = "github",
  Forgejo = "forgejo",
}

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
  readonly cause: CliExecutionError;
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

/** The CLI reached the host it resolved from the git remote, but the host did
 * not answer as the forge's API: `fj` keeps the port of an SSH remote
 * (`ssh://git@host:222/...`) and sends its HTTPS request to the SSH port.
 * `url` is kept out of `message` so the UI decides whether to reveal it. */
export class ForgeInvalidConnectionUrlError extends TaggedError(
  "ForgeInvalidConnectionUrlError",
)<{
  readonly kind: ForgeKind;
  readonly url: string;
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

export class ForgeUnexpectedError extends TaggedError("ForgeUnexpectedError")<{
  readonly kind: ForgeKind;
  readonly cause: unknown;
  readonly message: string;
}> {}

export type CliExecutionError =
  | ForgeCommandSpawnFailedError
  | ForgeCommandFailedError
  | ForgeInvalidConnectionUrlError
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
  readonly login: string;
}

export interface ForgeTeam {
  readonly name: string;
}

export interface PullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly state: PullRequestState;
  readonly isDraft: boolean | null;
  readonly author: ForgeUser | null;
}

export interface PullRequestList {
  readonly repository: ForgeRepository;
  readonly items: readonly PullRequestSummary[];
  readonly truncated: boolean;
}

export interface PullRequestRef {
  readonly ref: string | null;
  readonly sha: string | null;
}

export interface PullRequestReviewerRequests {
  readonly users: readonly ForgeUser[];
  readonly teams: readonly ForgeTeam[];
}

interface PullRequestMergeability {
  readonly mergeable: boolean | null;
  readonly mergeState: string | null;
  readonly reviewDecision: string | null;
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
  readonly author: ForgeUser | null;
  readonly body: string | null;
  readonly createdAt: string | null;
}

export interface PullRequestReviewComment extends PullRequestComment {
  readonly path: string | null;
}

export interface PullRequestReview {
  readonly author: ForgeUser | null;
  readonly body: string | null;
  readonly state: string;
  readonly submittedAt: string | null;
}

export interface PullRequestCheck {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly link: string | null;
}

export interface PullRequestProject {
  readonly title: string;
  readonly status: string | null;
}

export interface PullRequestLinkedIssue {
  readonly repository: string;
  readonly number: number;
}

export interface PullRequestPatch {
  readonly text: string;
}

export type ForgeSection<T> =
  | {
      readonly status: "available";
      readonly value: T;
      readonly truncated: boolean;
    }
  | {
      readonly status: "unsupported";
      readonly reason: string;
    }
  | {
      readonly status: "failed";
      readonly error: ForgeOperationError;
    };

export interface PullRequestDetails {
  readonly repository: ForgeRepository;
  readonly number: number;
  readonly body: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly mergedAt: string | null;
  readonly base: PullRequestRef;
  readonly head: PullRequestRef;
  readonly additions: number | null;
  readonly deletions: number | null;
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

export interface PullRequestResourceOptions {
  readonly signal?: AbortSignal;
}

/** A loaded pull request. Each part loads independently, so one failing part
 * never hides the others. */
export interface PullRequestDocument {
  readonly details: ForgeSection<PullRequestDetails>;
  readonly comments: ForgeSection<readonly PullRequestComment[]>;
  readonly diff: ForgeSection<PullRequestPatch>;
  readonly commits: ForgeSection<readonly PullRequestCommit[]>;
  readonly reviews: PullRequestReviewsResource;
  readonly checks: ForgeSection<readonly PullRequestCheck[]>;
  readonly development: PullRequestDevelopment;
}

/** A connected forge. Calls never reject: every failure is a `Result` error
 * or a failed section. */
export interface Forge {
  readonly kind: ForgeKind;

  getPullRequests(
    options?: PullRequestListOptions,
  ): Promise<Result<PullRequestList, ForgeOperationError>>;

  loadPullRequest(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDocument, ForgeOperationError>>;

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
