import { ApplicationContext, ForgeUnsupportedReasonCode } from "./types";
import { type } from "arktype";
import * as schemaPrimitives from "./schema-primitives";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import * as adapterHelpers from "./adapter-helpers";
import {
  addCommentTruncation,
  assemblePullRequestDetails,
  available,
  createPullRequestSummary,
  incompatible,
  normalizeDate,
  normalizeLabel,
  normalizeMilestone,
  normalizeRepository,
  normalizeState,
  normalizeTeam,
  normalizeUser,
  notRequested,
  unsupported,
} from "./normalization";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  ForgeTeam,
  ForgeUser,
  PullRequestCollections,
  PullRequestCommit,
  PullRequestDetailCore,
  PullRequestComment,
  PullRequestDetails,
  PullRequestDetailsOptions,
  PullRequestFile,
  PullRequestList,
  PullRequestListOptions,
  PullRequestPatch,
  PullRequestRef,
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

const coreSchema = type({
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

type ForgejoCorePayload = typeof coreSchema.infer;
type ForgejoIssue = typeof issueSchema.infer;
type ForgejoComment = typeof commentSchema.infer;
type ForgejoBranch = typeof branchSchema.infer;

interface ForgejoCore extends PullRequestDetailCore {
  readonly comments: number | null;
  readonly reviewComments: number | null;
  readonly requestedReviewers: ForgeSection<PullRequestReviewerRequests>;
}

export class ForgejoService implements ForgeAdapter {
  public readonly kind = kind;

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
      (repository) => [
        "--json",
        "pr",
        "search",
        "--state",
        "all",
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

  public async getPullRequestDetails(
    number: number,
    detailOptions: PullRequestDetailsOptions = {},
  ): Promise<ResultType<PullRequestDetails, ForgeOperationError>> {
    const repository = await this.getRepository(detailOptions.signal);
    if (repository.isErr()) {
      return repository;
    }

    const core = await adapterHelpers.executeForgeJson(
      kind,
      executableName,
      this.cwd,
      [
        "--json",
        "pr",
        "view",
        String(number),
        "--repo",
        repository.value.fullName,
      ],
      normalizeCore,
      detailOptions.signal,
    );
    if (core.isErr()) {
      return core;
    }

    const commentsPromise = this.readComments(
      number,
      repository.value.fullName,
      detailOptions.signal,
    );
    const patchPromise =
      detailOptions.includeDiff === false
        ? Promise.resolve(notRequested<PullRequestPatch>())
        : this.readPatch(
            number,
            repository.value.fullName,
            detailOptions.signal,
          );
    const [conversationComments, patch] = await Promise.all([
      commentsPromise,
      patchPromise,
    ]);

    return Result.ok(
      buildDetails(repository.value, core.value, conversationComments, patch),
    );
  }

  private constructor(private readonly cwd: string) {}

  private async getRepository(
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ForgeRepository, ForgeOperationError>> {
    return adapterHelpers.readForgeRepository(
      ["--json", "repo", "view"],
      normalizeRepositoryPayload,
      kind,
      executableName,
      this.cwd,
      signal,
    );
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

function normalizeCore(
  cause: unknown,
): ResultType<ForgejoCore, ForgeOperationError> {
  const payload = coreSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `Forgejo pull request response did not match the schema: ${payload.summary}`,
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

  const requestedReviewers = normalizeRequestedReviewers(payload);
  return Result.ok({
    body: payload.body ?? null,
    summary: {
      number: payload.number,
      title: payload.title,
      state: normalizeState(
        payload.state,
        payload.merged === true ||
          (payload.merged_at !== null && payload.merged_at !== undefined),
      ),
      isDraft: payload.draft ?? null,
      author: normalizeUser(payload.user),
      updatedAt: normalizeDate(payload.updated_at),
      url: payload.html_url ?? payload.url ?? null,
    },
    createdAt: normalizeDate(payload.created_at),
    updatedAt: normalizeDate(payload.updated_at),
    closedAt: normalizeDate(payload.closed_at),
    mergedAt: normalizeDate(payload.merged_at),
    mergedBy: normalizeUser(payload.merged_by),
    base: base.value,
    head: head.value,
    additions: payload.additions ?? null,
    deletions: payload.deletions ?? null,
    changedFiles: payload.changed_files ?? null,
    comments: payload.comments ?? null,
    reviewComments: payload.review_comments ?? null,
    labels: (payload.labels ?? []).map(normalizeLabel),
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
    requestedReviewers,
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
  payload: ForgejoCorePayload,
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

  return available({ users, teams });
}

function normalizeAssignees(payload: ForgejoCorePayload): readonly ForgeUser[] {
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

function buildDetails(
  repository: ForgeRepository,
  core: ForgejoCore,
  conversationComments: ForgeSection<readonly PullRequestComment[]>,
  patch: ForgeSection<PullRequestPatch>,
): PullRequestDetails {
  const comments = addCommentTruncation(conversationComments, core.comments);
  const unsupportedCommits = unsupported<readonly PullRequestCommit[]>(
    ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
    "The Forgejo CLI does not provide structured pull request commits",
  );
  const unsupportedFiles = unsupported<readonly PullRequestFile[]>(
    ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
    "The Forgejo CLI does not provide structured changed files",
  );
  const unsupportedReviews = unsupported<readonly PullRequestReview[]>(
    ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
    "The Forgejo CLI does not expose submitted pull request reviews",
  );
  const unsupportedReviewComments = unsupported<
    readonly PullRequestReviewComment[]
  >(
    ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
    "The Forgejo CLI does not expose inline review comments",
  );

  const collections: PullRequestCollections = {
    commits: unsupportedCommits,
    conversationComments: comments,
    reviewComments: unsupportedReviewComments,
    reviews: unsupportedReviews,
    requestedReviewers: core.requestedReviewers,
    files: unsupportedFiles,
    checks: unsupported(
      ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
      "The Forgejo CLI exposes pull request status only as human-readable output",
    ),
    projects: unsupported(
      ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
      "Forgejo pull request projects are not exposed by the current CLI",
    ),
    linkedIssues: unsupported(
      ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
      "Forgejo linked issue data is not exposed by the current CLI",
    ),
    patch,
  };

  return assemblePullRequestDetails({
    repository,
    core,
    counts: {
      additions: core.additions,
      deletions: core.deletions,
      changedFiles: core.changedFiles,
      commits: null,
      conversationComments: core.comments,
      reviewComments: core.reviewComments,
    },
    collections,
  });
}
