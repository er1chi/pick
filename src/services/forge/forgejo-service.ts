import { type } from "arktype";
import { Result } from "better-result";
import * as adapterHelpers from "./adapter-helpers";
import {
  addCommentTruncation,
  assemblePullRequestOverview,
  createPullRequestSummary,
  failed,
  incompatible,
  normalizeDate,
  normalizeLabel,
  normalizeMilestone,
  normalizeRepository,
  normalizeState,
  normalizeTeam,
  normalizeUser,
  unsupported,
} from "./normalization";
import * as schemaPrimitives from "./schema-primitives";
import {
  ApplicationContext,
  ForgeCancelledError,
  ForgeUnsupportedReasonCode,
} from "./types";

import type { Result as ResultType } from "better-result";
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
  PullRequestDevelopment,
  PullRequestDocument,
  PullRequestLinkedIssue,
  PullRequestList,
  PullRequestListOptions,
  PullRequestOverview,
  PullRequestOverviewOptions,
  PullRequestPatch,
  PullRequestRef,
  PullRequestProject,
  PullRequestResourceOptions,
  PullRequestReviewerRequests,
  PullRequestReviewsResource,
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

type ForgejoViewFlight = adapterHelpers.SharedCliFlight<ForgejoViewPayload>;

function cancelledView(): ResultType<ForgejoViewPayload, ForgeOperationError> {
  return Result.err(
    new ForgeCancelledError({
      kind,
      message: "The Forgejo pull request view request was cancelled",
    }),
  );
}

export class ForgejoService implements ForgeAdapter {
  public readonly kind = kind;

  private readonly repositoryReader: (
    signal: AbortSignal | undefined,
  ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>;

  private readonly viewFlights = new Map<string, ForgejoViewFlight>();

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

  public async loadPullRequest(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      (signal) => this.getRepository(signal),
      options.signal,
      (repository) => this.assemblePullRequest(number, repository, options),
    );
  }

  public async getPullRequestOverview(
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

    return overviewFromView(
      view.value,
      repository,
      number,
      conversationComments,
    );
  }

  public async getCommitPatch(
    _sha: string,
    _options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return Result.ok(
      unsupported<PullRequestPatch>(
        ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
        "The Forgejo CLI does not expose a diff for an individual commit",
      ),
    );
  }

  public async getPullRequestCommits(
    _number: number,
    _options: PullRequestResourceOptions = {},
  ): Promise<
    ResultType<ForgeSection<readonly PullRequestCommit[]>, ForgeOperationError>
  > {
    return Result.ok(
      unsupported<readonly PullRequestCommit[]>(
        ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
        "The Forgejo CLI does not provide structured pull request commits",
      ),
    );
  }

  public async getPullRequestChecks(
    _number: number,
    _options: PullRequestResourceOptions = {},
  ): Promise<
    ResultType<ForgeSection<readonly PullRequestCheck[]>, ForgeOperationError>
  > {
    return Result.ok(
      unsupported<readonly PullRequestCheck[]>(
        ForgeUnsupportedReasonCode.CliDoesNotProvideJson,
        "The Forgejo CLI exposes pull request status only as human-readable output",
      ),
    );
  }

  public async getPullRequestDevelopment(
    _number: number,
    _options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDevelopment, ForgeOperationError>> {
    return Result.ok({
      projects: unsupported<readonly PullRequestProject[]>(
        ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
        "Forgejo pull request projects are not exposed by the current CLI",
      ),
      linkedIssues: unsupported<readonly PullRequestLinkedIssue[]>(
        ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
        "Forgejo linked issue data is not exposed by the current CLI",
      ),
    });
  }

  public async getPullRequestReviews(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestReviewsResource, ForgeOperationError>> {
    const loaded = await this.readForgejoView(number, options.signal);
    return loaded.map(({ payload }) => reviewsFromView(payload));
  }

  public async getPullRequestDetails(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDetails, ForgeOperationError>> {
    const loaded = await this.readForgejoView(number, options.signal);
    return loaded.andThen(({ repository, payload }) =>
      normalizeDetailsFields(payload, repository, number),
    );
  }

  private async readForgejoView(
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<
    ResultType<
      { repository: ForgeRepository; payload: ForgejoViewPayload },
      ForgeOperationError
    >
  > {
    return adapterHelpers.withForgeRepository(
      (innerSignal) => this.getRepository(innerSignal),
      signal,
      async (repository) => {
        const view = await this.getView(number, repository.fullName, signal);
        return view.map((payload) => ({ repository, payload }));
      },
    );
  }

  public async getPullRequestDiff(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    const repository = await this.getRepository(options.signal);
    if (repository.isErr()) {
      return repository;
    }

    return Result.ok(
      await this.readPatch(number, repository.value.fullName, options.signal),
    );
  }

  private async assemblePullRequest(
    number: number,
    repository: ForgeRepository,
    options: PullRequestResourceOptions,
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    const signal = options.signal;
    const diffTask = this.readPatch(number, repository.fullName, signal);
    const viewTask = this.getView(number, repository.fullName, signal);
    const commentsTask = this.readComments(number, repository.fullName, signal);
    const [commits, checks, development] = await Promise.all([
      this.getPullRequestCommits(number, { signal }),
      this.getPullRequestChecks(number, { signal }),
      this.getPullRequestDevelopment(number, { signal }),
    ]);
    const commitsSection = sectionValue(commits);
    const checksSection = sectionValue(checks);
    const developmentSection = development.isOk()
      ? development.value
      : {
          projects: failed<readonly PullRequestProject[]>(development.error),
          linkedIssues: failed<readonly PullRequestLinkedIssue[]>(
            development.error,
          ),
        };

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
    return Result.ok({
      overview,
      details,
      diff,
      commits: commitsSection,
      reviews,
      checks: checksSection,
      development: developmentSection,
    });
  }

  private async getView(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ForgejoViewPayload, ForgeOperationError>> {
    if (signal?.aborted === true) {
      return cancelledView();
    }

    const key = `${repository}#${number}`;
    let flight = this.viewFlights.get(key);
    if (flight === undefined) {
      flight = this.startViewFlight(key, number, repository);
      this.viewFlights.set(key, flight);
    }
    const current = flight;
    return adapterHelpers.joinSharedCliFlight(
      current,
      signal,
      () => this.finishViewFlight(current),
      cancelledView,
    );
  }

  private startViewFlight(
    key: string,
    number: number,
    repository: string,
  ): ForgejoViewFlight {
    const controller = new AbortController();
    const promise = this.runViewFlight(key, controller, number, repository);
    return { key, controller, promise, waiters: 0 };
  }

  private async runViewFlight(
    key: string,
    controller: AbortController,
    number: number,
    repository: string,
  ): Promise<ResultType<ForgejoViewPayload, ForgeOperationError>> {
    const result = await adapterHelpers.executeForgeJson(
      kind,
      executableName,
      this.cwd,
      ["--json", "pr", "view", String(number), "--repo", repository],
      normalizeViewPayload,
      controller.signal,
    );
    // The flight only exists while it is in flight: dropping it on settle
    // keeps retry() honest and stops aborted calls from poisoning it.
    if (this.viewFlights.get(key)?.controller === controller) {
      this.viewFlights.delete(key);
    }
    return result;
  }

  private finishViewFlight(flight: ForgejoViewFlight): void {
    if (this.viewFlights.get(flight.key) !== flight) {
      return;
    }
    this.viewFlights.delete(flight.key);
    flight.controller.abort();
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

  private async readPatch(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<PullRequestPatch>> {
    return adapterHelpers.readForgePatch(
      kind,
      executableName,
      this.cwd,
      ["--json", "pr", "view", String(number), "--repo", repository, "diff"],
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
  return adapterHelpers
    .parseForgeSchema(
      kind,
      issueSchema.array(),
      cause,
      "Forgejo pull request list did not match the schema",
    )
    .map((payload) => payload.map(normalizeSummary));
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
  return adapterHelpers.parseForgeSchema(
    kind,
    viewSchema,
    cause,
    "Forgejo pull request response did not match the schema",
  );
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

function sectionValue<T>(
  result: ResultType<ForgeSection<T>, ForgeOperationError>,
): ForgeSection<T> {
  return result.isOk() ? result.value : failed(result.error);
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
      ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
      "The Forgejo CLI does not expose submitted pull request reviews",
    ),
    reviewComments: unsupported(
      ForgeUnsupportedReasonCode.ProviderDoesNotExpose,
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
  const fields = normalizeOverviewFields(payload, number);
  if (fields.isErr()) {
    return fields;
  }
  return Result.ok(
    assemblePullRequestOverview(
      repository,
      fields.value,
      addCommentTruncation(conversationComments, payload.comments ?? null),
    ),
  );
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
  return adapterHelpers
    .parseForgeSchema(
      kind,
      commentsSchema,
      cause,
      "Forgejo comments response did not match the schema",
    )
    .map((payload) => payload.map(normalizeComment));
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
