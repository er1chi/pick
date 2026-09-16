import { type } from "arktype";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { ApplicationContext, ForgeUnsupportedReasonCode } from "./types";
import * as schemaPrimitives from "./schema-primitives";
import * as adapterHelpers from "./adapter-helpers";
import {
  addCommentTruncation,
  assemblePullRequestOverview,
  createPullRequestSummary,
  incompatible,
  invalidRequest,
  normalizeDate,
  normalizeMilestone,
  normalizeRepository,
  normalizeState,
  normalizeTeam,
  normalizeUser,
  unsupported,
} from "./normalization";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  ForgeTeam,
  ForgeUser,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestComment,
  PullRequestDetails,
  PullRequestDiffResource,
  PullRequestFile,
  PullRequestLinkedIssue,
  PullRequestList,
  PullRequestListOptions,
  PullRequestOverview,
  PullRequestOverviewOptions,
  PullRequestPatch,
  PullRequestRef,
  PullRequestProject,
  PullRequestResource,
  PullRequestResourceKind,
  PullRequestResourceOptions,
  PullRequestReview,
  PullRequestReviewComment,
  PullRequestReviewerRequests,
  PullRequestSummary,
} from "./types";

const executableName = "fj";
const kind = ApplicationContext.Forgejo;
const userSchema = type({
  login: "string",
  id: schemaPrimitives.optionalIdentifier,
  full_name: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
});
const teamSchema = type({
  name: "string",
  slug: schemaPrimitives.optionalNullableString,
  id: schemaPrimitives.optionalIdentifier,
  html_url: schemaPrimitives.optionalNullableString,
});
const repositorySchema = type({
  full_name: "string",
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const branchSchema = type({
  label: schemaPrimitives.optionalNullableString,
  ref: schemaPrimitives.optionalNullableString,
  sha: schemaPrimitives.optionalNullableString,
  repo: repositorySchema.or("null").optional(),
});
const labelSchema = type({
  id: schemaPrimitives.optionalIdentifier,
  name: "string",
  color: schemaPrimitives.optionalNullableString,
  description: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const milestoneSchema = type({
  id: schemaPrimitives.optionalIdentifier,
  title: "string",
  description: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
  due_on: schemaPrimitives.optionalDate,
  html_url: schemaPrimitives.optionalNullableString,
});
const pullRequestMetaSchema = type({
  draft: schemaPrimitives.optionalBoolean,
  merged: schemaPrimitives.optionalBoolean,
  merged_at: schemaPrimitives.optionalDate,
  html_url: schemaPrimitives.optionalNullableString,
});
const issueSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: "string",
  body: schemaPrimitives.optionalNullableString,
  state: "string",
  user: userSchema.or("null").optional(),
  url: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
  created_at: schemaPrimitives.optionalDate,
  updated_at: schemaPrimitives.optionalDate,
  pull_request: pullRequestMetaSchema.or("null").optional(),
});

const viewSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: "string",
  body: schemaPrimitives.optionalNullableString,
  state: "string",
  draft: schemaPrimitives.optionalBoolean,
  merged: schemaPrimitives.optionalBoolean,
  user: userSchema.or("null").optional(),
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
  created_at: schemaPrimitives.optionalDate,
  updated_at: schemaPrimitives.optionalDate,
  closed_at: schemaPrimitives.optionalDate,
  merged_at: schemaPrimitives.optionalDate,
  merged_by: userSchema.or("null").optional(),
  base: branchSchema.or("null").optional(),
  head: branchSchema.or("null").optional(),
  additions: schemaPrimitives.optionalNumber,
  deletions: schemaPrimitives.optionalNumber,
  changed_files: schemaPrimitives.optionalNumber,
  comments: schemaPrimitives.optionalNumber,
  review_comments: schemaPrimitives.optionalNumber,
  labels: labelSchema.array().or("null"),
  assignee: userSchema.or("null").optional(),
  assignees: userSchema.array().or("null"),
  milestone: milestoneSchema.or("null"),
  allow_maintainer_edit: schemaPrimitives.optionalBoolean,
  mergeable: schemaPrimitives.optionalBoolean,
  merge_commit_sha: schemaPrimitives.optionalNullableString,
  requested_reviewers: userSchema.array().or("null").optional(),
  requested_reviewers_teams: teamSchema.array().or("null").optional(),
});

const commentSchema = type({
  id: schemaPrimitives.safeIntegerSchema,
  user: userSchema.or("null").optional(),
  html_url: schemaPrimitives.optionalNullableString,
  body: schemaPrimitives.optionalNullableString,
  created_at: schemaPrimitives.optionalDate,
  updated_at: schemaPrimitives.optionalDate,
});
const commentsSchema = commentSchema.array();

type ForgejoViewPayload = typeof viewSchema.infer;
type ForgejoIssue = typeof issueSchema.infer;
type ForgejoComment = typeof commentSchema.infer;
type ForgejoBranch = typeof branchSchema.infer;
type ForgejoDetailsFields = PullRequestDetails;

export class ForgejoService implements ForgeAdapter {
  public readonly kind = kind;

  private readonly repositoryReader: (
    signal: AbortSignal | undefined,
  ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>;

  public static initialize(cwd: string) {
    return adapterHelpers.initializeForgeAdapter(
      kind,
      executableName,
      cwd,
      () => new ForgejoService(cwd),
    );
  }

  public async getPullRequests(
    listOptions: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return adapterHelpers.loadForgePullRequestList(
      (repository, _limit, state) => [
        "--json",
        "pr",
        "search",
        "--state",
        state,
        "--repo",
        repository.fullName,
      ],
      normalizeList,
      (signal) => this.getRepository(signal),
      kind,
      executableName,
      this.cwd,
      listOptions,
    );
  }

  public getPullRequestOverview(
    number: number,
    options: PullRequestOverviewOptions = {},
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      (signal) => this.getRepository(signal),
      options.signal,
      (repository) =>
        this.readForgejoOverview(number, repository, options.signal),
    );
  }

  private async readForgejoOverview(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    const [view, conversationComments] = await Promise.all([
      this.getView(number, repository.fullName, signal),
      this.readComments(number, repository.fullName, signal),
    ]);
    if (view.isErr()) {
      return view;
    }

    const fields = normalizeOverviewFields(view.value, number);
    if (fields.isErr()) {
      return fields;
    }

    return Result.ok(
      assemblePullRequestOverview(
        repository,
        fields.value,
        addCommentTruncation(conversationComments, view.value.comments ?? null),
      ),
    );
  }

  public getPullRequestResource(
    number: number,
    resourceKind: PullRequestResourceKind,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestResource, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      (signal) => this.getRepository(signal),
      options.signal,
      (repository) =>
        this.readForgejoResource(
          number,
          resourceKind,
          repository,
          options.signal,
        ),
    );
  }

  private async readForgejoResource(
    number: number,
    resourceKind: PullRequestResourceKind,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestResource, ForgeOperationError>> {
    switch (resourceKind) {
      case "details":
        return this.getDetailsResource(number, repository, signal);
      case "diff":
        return this.readForgejoDiffResource(
          number,
          repository.fullName,
          signal,
        );
      case "commits":
        return Result.ok({
          kind: "commits",
          value: {
            commits: unsupported<readonly PullRequestCommit[]>(
              ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
              "The Forgejo CLI does not provide structured pull request commits",
            ),
          },
        });
      case "reviews":
        return this.getReviewsResource(number, repository.fullName, signal);
      case "checks":
        return Result.ok({
          kind: "checks",
          value: {
            checks: unsupported<readonly PullRequestCheck[]>(
              ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
              "The Forgejo CLI exposes pull request status only as human-readable output",
            ),
          },
        });
      case "development":
        return Result.ok({
          kind: "development",
          value: {
            projects: unsupported<readonly PullRequestProject[]>(
              ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
              "Forgejo pull request projects are not exposed by the current CLI",
            ),
            linkedIssues: unsupported<readonly PullRequestLinkedIssue[]>(
              ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
              "Forgejo linked issue data is not exposed by the current CLI",
            ),
          },
        });
    }

    return invalidRequest(
      kind,
      `Unknown pull request resource: ${resourceKind}`,
    );
  }

  private async getReviewsResource(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestResource, ForgeOperationError>> {
    const view = await this.getView(number, repository, signal);
    if (view.isErr()) {
      return view;
    }

    return Result.ok({
      kind: "reviews",
      value: {
        reviews: unsupported<readonly PullRequestReview[]>(
          ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
          "The Forgejo CLI does not expose submitted pull request reviews",
        ),
        reviewComments: unsupported<readonly PullRequestReviewComment[]>(
          ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
          "The Forgejo CLI does not expose inline review comments",
        ),
        requestedReviewers: normalizeRequestedReviewers(view.value),
      },
    });
  }

  private async getDetailsResource(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestResource, ForgeOperationError>> {
    const view = await this.getView(number, repository.fullName, signal);
    if (view.isErr()) {
      return view;
    }

    const details = normalizeDetailsFields(view.value, repository, number);
    if (details.isErr()) {
      return details;
    }

    return Result.ok({
      kind: "details",
      value: { details: details.value },
    });
  }

  private async readForgejoDiffResource(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestResource, ForgeOperationError>> {
    const patch = await this.readPatch(number, repository, signal);
    const value: PullRequestDiffResource = {
      patch,
      files: unsupported<readonly PullRequestFile[]>(
        ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
        "The Forgejo CLI does not provide structured changed files",
      ),
    };
    return Result.ok({ kind: "diff", value });
  }

  private async getView(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ForgejoViewPayload, ForgeOperationError>> {
    return adapterHelpers.executeForgeJson(
      kind,
      executableName,
      this.cwd,
      ["--json", "pr", "view", String(number), "--repo", repository],
      normalizeViewPayload,
      signal,
    );
  }

  private getRepository(signal: AbortSignal | undefined) {
    return this.repositoryReader(signal);
  }

  private async readComments(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<readonly PullRequestComment[]>> {
    const result = await adapterHelpers.executeForgeJson(
      kind,
      executableName,
      this.cwd,
      [
        "--json",
        "pr",
        "view",
        String(number),
        "--repo",
        repository,
        "comments",
      ],
      normalizeComments,
      signal,
    );
    return adapterHelpers.sectionFromResult(result);
  }

  private readPatch(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<PullRequestPatch>> {
    return adapterHelpers.readForgePatch(
      kind,
      executableName,
      this.cwd,
      [
        "--json",
        "pr",
        "view",
        String(number),
        "--repo",
        repository,
        "diff",
        "--patch",
      ],
      signal,
    );
  }

  private constructor(private readonly cwd: string) {
    this.repositoryReader = adapterHelpers.createCachedForgeRepositoryReader(
      ["--json", "repo", "view"],
      normalizeRepositoryPayload,
      kind,
      executableName,
      cwd,
    );
  }
}

function normalizeRepositoryPayload(
  cause: unknown,
): ResultType<ForgeRepository, ForgeOperationError> {
  const payload = adapterHelpers.parseForgeSchema(
    kind,
    repositorySchema,
    cause,
    "Forgejo repository response did not match the schema",
  );
  if (payload.isErr()) {
    return payload;
  }
  return normalizeRepository(
    kind,
    payload.value.full_name,
    payload.value.html_url ?? payload.value.url,
  );
}

function normalizeList(
  cause: unknown,
): ResultType<readonly PullRequestSummary[], ForgeOperationError> {
  const payload = issueSchema.array()(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `Forgejo pull request list did not match the schema: ${payload.summary}`,
    );
  }
  return Result.ok(payload.map(normalizeSummary));
}

function normalizeSummary(payload: ForgejoIssue): PullRequestSummary {
  const pullRequest = payload.pull_request;
  return createPullRequestSummary(
    payload.number,
    payload.title,
    normalizeState(payload.state, pullRequest?.merged === true),
    pullRequest?.draft ?? null,
    normalizeUser(payload.user),
    normalizeDate(payload.updated_at),
    payload.html_url ?? payload.url ?? null,
  );
}

function normalizeViewPayload(
  cause: unknown,
): ResultType<ForgejoViewPayload, ForgeOperationError> {
  const payload = viewSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `Forgejo pull request response did not match the schema: ${payload.summary}`,
    );
  }
  return Result.ok(payload);
}

function normalizeOverviewFields(
  payload: ForgejoViewPayload,
  expectedNumber: number,
): ResultType<
  Pick<PullRequestOverview, "number" | "body">,
  ForgeOperationError
> {
  if (payload.number !== expectedNumber) {
    return incompatible(
      kind,
      `Forgejo pull request overview number did not match ${expectedNumber}`,
    );
  }
  return Result.ok({ number: payload.number, body: payload.body ?? null });
}

function normalizeDetailsFields(
  payload: ForgejoViewPayload,
  repository: ForgeRepository,
  expectedNumber: number,
): ResultType<ForgejoDetailsFields, ForgeOperationError> {
  if (payload.number !== expectedNumber) {
    return incompatible(
      kind,
      `Forgejo pull request details number did not match ${expectedNumber}`,
    );
  }

  const base = normalizeBranch(payload.base);
  if (base.isErr()) {
    return base;
  }
  const head = normalizeBranch(payload.head);
  if (head.isErr()) {
    return head;
  }

  return Result.ok({
    repository,
    number: payload.number,
    createdAt: normalizeDate(payload.created_at),
    updatedAt: normalizeDate(payload.updated_at),
    closedAt: normalizeDate(payload.closed_at),
    mergedAt: normalizeDate(payload.merged_at),
    mergedBy: normalizeUser(payload.merged_by),
    base: base.value,
    head: head.value,
    counts: {
      additions: payload.additions ?? null,
      deletions: payload.deletions ?? null,
      changedFiles: payload.changed_files ?? null,
      conversationComments: payload.comments ?? null,
      reviewComments: payload.review_comments ?? null,
    },
    labels: (payload.labels ?? []).map((label) => ({
      id: label.id === null || label.id === undefined ? null : String(label.id),
      name: label.name,
      color: label.color ?? null,
      description: label.description ?? null,
      url: label.url ?? null,
    })),
    assignees: normalizeAssignees(payload),
    milestone:
      payload.milestone === null
        ? null
        : normalizeMilestone({
            ...payload.milestone,
            dueAt: normalizeDate(payload.milestone.due_on),
            url: payload.milestone.html_url,
          }),
    maintainerCanModify: payload.allow_maintainer_edit ?? null,
    mergeability: {
      mergeable: payload.mergeable ?? null,
      mergeState: null,
      reviewDecision: unsupported(
        ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
        "Forgejo review decision is not exposed by the current CLI",
      ),
      mergeCommitSha: payload.merge_commit_sha ?? null,
    },
  });
}

function normalizeBranch(
  payload: ForgejoBranch | null | undefined,
): ResultType<PullRequestRef, ForgeOperationError> {
  if (payload === null || payload === undefined) {
    return Result.ok({ ref: null, sha: null, repository: null });
  }

  const branchRepository = payload.repo;
  if (branchRepository === null || branchRepository === undefined) {
    return Result.ok({
      ref: payload.ref ?? payload.label ?? null,
      sha: payload.sha ?? null,
      repository: null,
    });
  }

  return normalizeRepository(
    kind,
    branchRepository.full_name,
    branchRepository.html_url ?? branchRepository.url,
  ).map((repository) => ({
    ref: payload.ref ?? payload.label ?? null,
    sha: payload.sha ?? null,
    repository,
  }));
}

function normalizeRequestedReviewers(
  payload: ForgejoViewPayload,
): ForgeSection<PullRequestReviewerRequests> {
  if (
    payload.requested_reviewers === undefined ||
    payload.requested_reviewers_teams === undefined
  ) {
    return unsupported(
      ForgeUnsupportedReasonCode.ProviderResponseDoesNotInclude,
      "Forgejo did not include requested reviewer fields in the PR response",
    );
  }

  const users = (payload.requested_reviewers ?? []).flatMap((user) => {
    const normalized = normalizeUser(user);
    return normalized === null ? [] : [normalized];
  });
  const teams = (payload.requested_reviewers_teams ?? [])
    .map((team) => normalizeTeam(team))
    .filter((team): team is ForgeTeam => team !== null);

  return {
    status: "available",
    value: { users, teams },
    truncated: false,
  };
}

function normalizeAssignees(payload: ForgejoViewPayload): readonly ForgeUser[] {
  const assignees = payload.assignees ?? [];
  let users = assignees;
  if (
    users.length === 0 &&
    payload.assignee !== null &&
    payload.assignee !== undefined
  ) {
    users = [payload.assignee];
  }
  return users.flatMap((user) => {
    const normalized = normalizeUser(user);
    return normalized === null ? [] : [normalized];
  });
}

function normalizeComments(
  cause: unknown,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  const payload = commentsSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `Forgejo comments response did not match the schema: ${payload.summary}`,
    );
  }

  return Result.ok(payload.map(normalizeComment));
}

function normalizeComment(payload: ForgejoComment): PullRequestComment {
  return {
    id: String(payload.id),
    author: normalizeUser(payload.user),
    body: payload.body ?? null,
    createdAt: normalizeDate(payload.created_at),
    updatedAt: normalizeDate(payload.updated_at),
    url: payload.html_url ?? null,
  };
}
