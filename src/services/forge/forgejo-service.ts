import { type } from "arktype";
import { Result } from "better-result";
import { ForgeAdapterBase, ForgeCli } from "./forge-cli";
import {
  addCommentTruncation,
  incompatible,
  normalizeDate,
  normalizeLabel,
  normalizeMilestone,
  normalizeOverviewFields,
  normalizeRepository,
  normalizeState,
  normalizeTeams,
  normalizeUser,
  normalizeUsers,
} from "./normalization";
import * as schemaPrimitives from "./schema-primitives";
import { failed, unsupported } from "./section";
import { ApplicationContext } from "./types";

import type { Result as ResultType } from "better-result";
import type { CliRunner } from "./forge-cli";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  ForgeUser,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestComment,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestDocument,
  PullRequestList,
  PullRequestListOptions,
  PullRequestOverview,
  PullRequestPatch,
  PullRequestRef,
  PullRequestResourceOptions,
  PullRequestReviewerRequests,
  PullRequestReviewsResource,
  PullRequestSummary,
} from "./types";

const executable = "fj";
const kind = ApplicationContext.Forgejo;
const unsupportedCommits = unsupported<readonly PullRequestCommit[]>(
  "The Forgejo CLI does not provide structured pull request commits",
);
const unsupportedChecks = unsupported<readonly PullRequestCheck[]>(
  "The Forgejo CLI exposes pull request status only as human-readable output",
);
const unsupportedDevelopment: PullRequestDevelopment = {
  projects: unsupported(
    "Forgejo pull request projects are not exposed by the current CLI",
  ),
  linkedIssues: unsupported(
    "Forgejo linked issue data is not exposed by the current CLI",
  ),
};
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

export class ForgejoService extends ForgeAdapterBase implements ForgeAdapter {
  constructor(cli: ForgeCli) {
    super(
      cli,
      cli.cachedJson(["--json", "repo", "view"], decodeRepository(cli)),
    );
  }

  public static async initialize(cwd: string, run?: CliRunner) {
    const initialized = await ForgeCli.initialize(kind, executable, cwd, run);
    return initialized.map((cli) => new ForgejoService(cli));
  }

  public async getPullRequests(
    listOptions: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return this.cli.pullRequestList(
      this.repository,
      (repository, _limit, state) => [
        "--json",
        "pr",
        "search",
        "--state",
        state,
        "--repo",
        repository.fullName,
      ],
      decodeList(this.cli),
      listOptions,
    );
  }

  public async loadPullRequest(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    return this.withRepository(options.signal, (repository) =>
      this.assemblePullRequest(number, repository, options),
    );
  }

  public async getCommitPatch(
    _sha: string,
    _options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return Result.ok(
      unsupported<PullRequestPatch>(
        "The Forgejo CLI does not expose a diff for an individual commit",
      ),
    );
  }

  private async assemblePullRequest(
    number: number,
    repository: ForgeRepository,
    options: PullRequestResourceOptions,
  ): Promise<PullRequestDocument> {
    const signal = options.signal;
    const diffTask = this.cli.patch(
      [
        "--json",
        "pr",
        "view",
        String(number),
        "--repo",
        repository.fullName,
        "diff",
      ],
      signal,
    );
    const viewTask = this.readPullRequestView(
      number,
      repository.fullName,
      signal,
    );
    const commentsTask = this.cli.section(
      [
        "--json",
        "pr",
        "view",
        String(number),
        "--repo",
        repository.fullName,
        "comments",
      ],
      commentsSchema,
      decodeComments,
      "Forgejo comments response did not match the schema",
      signal,
    );

    const [view, comments] = await Promise.all([viewTask, commentsTask]);

    const details = view.isErr()
      ? Result.err(view.error)
      : normalizeDetailsFields(view.value, repository, number);
    const reviews = view.isErr()
      ? failedReviews(view.error)
      : reviewsFromView(view.value);

    const overview = view.isErr()
      ? Result.err(view.error)
      : overviewFromView(view.value, repository, number, comments);

    const diff = await diffTask;
    return {
      overview,
      details,
      diff,
      commits: unsupportedCommits,
      reviews,
      checks: unsupportedChecks,
      development: unsupportedDevelopment,
    };
  }

  private readPullRequestView(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ForgejoViewPayload, ForgeOperationError>> {
    return this.cli.json(
      ["--json", "pr", "view", String(number), "--repo", repository],
      decodeView(this.cli),
      signal,
    );
  }
}

function decodeRepository(cli: ForgeCli) {
  return (cause: unknown): ResultType<ForgeRepository, ForgeOperationError> => {
    const payload = cli.parse(
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
  };
}

function decodeList(cli: ForgeCli) {
  return (
    cause: unknown,
  ): ResultType<readonly PullRequestSummary[], ForgeOperationError> =>
    cli
      .parse(
        issueSchema.array(),
        cause,
        "Forgejo pull request list did not match the schema",
      )
      .map((payload) => payload.map(normalizeSummary));
}

function decodeView(cli: ForgeCli) {
  return (
    cause: unknown,
  ): ResultType<ForgejoViewPayload, ForgeOperationError> =>
    cli.parse(
      viewSchema,
      cause,
      "Forgejo pull request response did not match the schema",
    );
}

function decodeComments(
  payload: readonly ForgejoComment[],
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  return Result.ok(payload.map(normalizeComment));
}

function normalizeSummary(payload: ForgejoIssue): PullRequestSummary {
  const pullRequest = payload.pull_request;
  return {
    number: payload.number,
    title: payload.title,
    state: normalizeState(payload.state, pullRequest?.merged === true),
    isDraft: pullRequest?.draft ?? null,
    author: normalizeUser(payload.user),
    updatedAt: normalizeDate(payload.updated_at),
    url: payload.html_url ?? payload.url ?? null,
  };
}

function normalizeDetailsFields(
  payload: ForgejoViewPayload,
  repository: ForgeRepository,
  expectedNumber: number,
): ResultType<PullRequestDetails, ForgeOperationError> {
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

function failedReviews(error: ForgeOperationError): PullRequestReviewsResource {
  return {
    reviews: failed(error),
    reviewComments: failed(error),
    requestedReviewers: failed(error),
  };
}

function reviewsFromView(
  payload: ForgejoViewPayload,
): PullRequestReviewsResource {
  return {
    reviews: unsupported(
      "The Forgejo CLI does not expose submitted pull request reviews",
    ),
    reviewComments: unsupported(
      "The Forgejo CLI does not expose inline review comments",
    ),
    requestedReviewers: normalizeRequestedReviewers(payload),
  };
}

function overviewFromView(
  payload: ForgejoViewPayload,
  repository: ForgeRepository,
  number: number,
  conversationComments: ForgeSection<readonly PullRequestComment[]>,
): ResultType<PullRequestOverview, ForgeOperationError> {
  const fields = normalizeOverviewFields(kind, payload, number);
  if (fields.isErr()) {
    return fields;
  }
  return Result.ok({
    repository,
    ...fields.value,
    conversationComments: addCommentTruncation(
      conversationComments,
      payload.comments ?? null,
    ),
  });
}

function normalizeRequestedReviewers(
  payload: ForgejoViewPayload,
): ForgeSection<PullRequestReviewerRequests> {
  if (
    payload.requested_reviewers === undefined ||
    payload.requested_reviewers_teams === undefined
  ) {
    return unsupported(
      "Forgejo did not include requested reviewer fields in the PR response",
    );
  }

  const users = normalizeUsers(payload.requested_reviewers);
  const teams = normalizeTeams(payload.requested_reviewers_teams);

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
  return normalizeUsers(users);
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
