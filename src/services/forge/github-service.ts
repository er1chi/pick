import { type } from "arktype";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import * as schemaPrimitives from "./schema-primitives";
import * as adapterHelpers from "./adapter-helpers";
import { ApplicationContext } from "./types";
import {
  assemblePullRequestDetails,
  available,
  createPullRequestSummary,
  incompatible,
  normalizeDate,
  normalizeGithubState,
  normalizeIdentifier,
  normalizeLabel,
  normalizeMilestone,
  normalizeRepository,
  normalizeTeam,
  normalizeUser,
  notRequested,
  sectionLength,
} from "./normalization";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  ForgeTeam,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestComment,
  PullRequestDetailCore,
  PullRequestDetails,
  PullRequestDetailsOptions,
  PullRequestFile,
  PullRequestLinkedIssue,
  PullRequestList,
  PullRequestListOptions,
  PullRequestPatch,
  PullRequestProject,
  PullRequestReview,
  PullRequestReviewComment,
  PullRequestReviewerRequests,
  PullRequestSummary,
} from "./types";

const executableName = "gh";
const kind = ApplicationContext.GitHub;
const userSchema = type({
  login: "string",
  id: schemaPrimitives.optionalIdentifier,
  name: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const teamSchema = type({
  name: "string",
  id: schemaPrimitives.optionalIdentifier,
  slug: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const repositorySchema = type({
  nameWithOwner: "string",
  url: schemaPrimitives.optionalNullableString,
});
const labelSchema = type({
  name: "string",
  id: schemaPrimitives.optionalIdentifier,
  color: schemaPrimitives.optionalNullableString,
  description: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const milestoneSchema = type({
  title: "string",
  id: schemaPrimitives.optionalIdentifier,
  description: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
  dueOn: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const mergeCommitSchema = type({ oid: "string" });

const coreSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: "string",
  body: schemaPrimitives.optionalNullableString,
  state: "string",
  isDraft: type("boolean | null").optional(),
  author: userSchema.or("null").optional(),
  url: schemaPrimitives.optionalNullableString,
  createdAt: schemaPrimitives.optionalDate,
  updatedAt: schemaPrimitives.optionalDate,
  closedAt: schemaPrimitives.optionalDate,
  mergedAt: schemaPrimitives.optionalDate,
  mergedBy: userSchema.or("null").optional(),
  baseRefName: schemaPrimitives.optionalNullableString,
  baseRefOid: schemaPrimitives.optionalNullableString,
  headRefName: schemaPrimitives.optionalNullableString,
  headRefOid: schemaPrimitives.optionalNullableString,
  headRepository: repositorySchema.or("null").optional(),
  isCrossRepository: type("boolean | null").optional(),
  additions: schemaPrimitives.optionalNumber,
  deletions: schemaPrimitives.optionalNumber,
  changedFiles: schemaPrimitives.optionalNumber,
  labels: labelSchema.array(),
  assignees: userSchema.array(),
  milestone: milestoneSchema.or("null"),
  maintainerCanModify: type("boolean | null").optional(),
  mergeable: schemaPrimitives.optionalNullableString,
  mergeStateStatus: schemaPrimitives.optionalNullableString,
  reviewDecision: schemaPrimitives.optionalNullableString,
  mergeCommit: mergeCommitSchema.or("null").optional(),
});

const listItemSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: "string",
  state: "string",
  isDraft: type("boolean | null").optional(),
  author: userSchema.or("null").optional(),
  url: schemaPrimitives.optionalNullableString,
  updatedAt: schemaPrimitives.optionalDate,
});

const gitIdentitySchema = type({
  name: schemaPrimitives.optionalNullableString,
  email: schemaPrimitives.optionalNullableString,
  date: schemaPrimitives.optionalDate,
});
const commitSchema = type({
  sha: "string",
  commit: type({
    message: "string",
    author: gitIdentitySchema.or("null").optional(),
    committer: gitIdentitySchema.or("null").optional(),
  }),
  author: userSchema.or("null").optional(),
  committer: userSchema.or("null").optional(),
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const commentSchema = type({
  id: type("number | string"),
  user: userSchema.or("null").optional(),
  body: schemaPrimitives.optionalNullableString,
  created_at: schemaPrimitives.optionalDate,
  updated_at: schemaPrimitives.optionalDate,
  html_url: schemaPrimitives.optionalNullableString,
  path: schemaPrimitives.optionalNullableString,
  line: schemaPrimitives.optionalNumber,
  start_line: schemaPrimitives.optionalNumber,
  side: schemaPrimitives.optionalNullableString,
  commit_id: schemaPrimitives.optionalNullableString,
  in_reply_to_id: schemaPrimitives.optionalIdentifier,
  pull_request_review_id: schemaPrimitives.optionalIdentifier,
});
const reviewSchema = type({
  id: type("number | string"),
  user: userSchema.or("null").optional(),
  body: schemaPrimitives.optionalNullableString,
  state: "string",
  submitted_at: schemaPrimitives.optionalDate,
  commit_id: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
});
const fileSchema = type({
  filename: "string",
  previous_filename: schemaPrimitives.optionalNullableString,
  status: "string",
  additions: schemaPrimitives.optionalNumber,
  deletions: schemaPrimitives.optionalNumber,
  changes: schemaPrimitives.optionalNumber,
  sha: schemaPrimitives.optionalNullableString,
  patch: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
});
const requestedReviewersSchema = type({
  users: userSchema.array(),
  teams: teamSchema.array(),
});
const checkSchema = type({
  __typename: schemaPrimitives.optionalNullableString,
  name: schemaPrimitives.optionalNullableString,
  context: schemaPrimitives.optionalNullableString,
  status: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
  conclusion: schemaPrimitives.optionalNullableString,
  description: schemaPrimitives.optionalNullableString,
  detailsUrl: schemaPrimitives.optionalNullableString,
  targetUrl: schemaPrimitives.optionalNullableString,
  link: schemaPrimitives.optionalNullableString,
  startedAt: schemaPrimitives.optionalDate,
  completedAt: schemaPrimitives.optionalDate,
  workflowName: schemaPrimitives.optionalNullableString,
  workflow: schemaPrimitives.optionalNullableString,
});
const projectItemSchema = type({
  id: "string",
  title: "string",
  number: schemaPrimitives.optionalNumber,
  url: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
});
const projectCardSchema = type({
  id: type("number | string"),
  project: type({
    id: type("number | string"),
    name: "string",
    number: schemaPrimitives.optionalNumber,
    html_url: schemaPrimitives.optionalNullableString,
    state: schemaPrimitives.optionalNullableString,
  }),
});
const linkedIssueSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: schemaPrimitives.optionalNullableString,
  state: "string",
  url: schemaPrimitives.optionalNullableString,
  repository: repositorySchema.or("null").optional(),
});

const commitPagesSchema = commitSchema.array().array();
const commentPagesSchema = commentSchema.array().array();
const reviewPagesSchema = reviewSchema.array().array();
const filePagesSchema = fileSchema.array().array();
const checksResponseSchema = type({
  statusCheckRollup: checkSchema.array(),
});
const projectsResponseSchema = type({
  projectItems: projectItemSchema.array().or("null").optional(),
  projectCards: projectCardSchema.array().or("null").optional(),
});
const linkedIssuesResponseSchema = type({
  closingIssuesReferences: linkedIssueSchema.array(),
});

export class GithubService implements ForgeAdapter {
  public readonly kind = kind;

  private constructor(private readonly cwd: string) {}

  public static initialize(cwd: string) {
    return adapterHelpers.initializeForgeAdapter(
      kind,
      executableName,
      cwd,
      () => new GithubService(cwd),
    );
  }

  public async getPullRequests(
    options: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return adapterHelpers.loadForgePullRequestList(
      (repository, limit) => [
        "pr",
        "list",
        "--repo",
        repository.fullName,
        "--state",
        "all",
        "--limit",
        String(limit + 1),
        "--json",
        "number,title,state,isDraft,author,url,updatedAt",
      ],
      normalizeList,
      (signal) => this.getRepository(signal),
      kind,
      executableName,
      this.cwd,
      options,
    );
  }

  public async getPullRequestDetails(
    number: number,
    options: PullRequestDetailsOptions = {},
  ): Promise<ResultType<PullRequestDetails, ForgeOperationError>> {
    const repository = await this.getRepository(options.signal);
    if (repository.isErr()) {
      return repository;
    }

    const core = await this.getCore(repository.value, number, options.signal);
    if (core.isErr()) {
      return core;
    }

    const [
      commits,
      conversationComments,
      reviewComments,
      reviews,
      requestedReviewers,
      files,
      checks,
      projects,
      linkedIssues,
      patch,
    ] = await Promise.all([
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository.value, ["pulls", String(number), "commits"]),
        ],
        commitPagesSchema,
        normalizeCommits,
        "GitHub paginated response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository.value, ["issues", String(number), "comments"]),
        ],
        commentPagesSchema,
        normalizeConversationComments,
        "GitHub paginated response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository.value, ["pulls", String(number), "comments"]),
        ],
        commentPagesSchema,
        normalizeReviewComments,
        "GitHub paginated response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository.value, ["pulls", String(number), "reviews"]),
        ],
        reviewPagesSchema,
        normalizeReviews,
        "GitHub paginated response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "api",
          pathForApi(repository.value, [
            "pulls",
            String(number),
            "requested_reviewers",
          ]),
        ],
        requestedReviewersSchema,
        normalizeRequestedReviewers,
        "GitHub response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository.value, ["pulls", String(number), "files"]),
        ],
        filePagesSchema,
        normalizeFiles,
        "GitHub paginated response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "pr",
          "view",
          String(number),
          "--repo",
          repository.value.fullName,
          "--json",
          "statusCheckRollup",
        ],
        checksResponseSchema,
        normalizeChecks,
        "GitHub optional PR response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "pr",
          "view",
          String(number),
          "--repo",
          repository.value.fullName,
          "--json",
          "projectItems,projectCards",
        ],
        projectsResponseSchema,
        normalizeProjects,
        "GitHub optional PR response did not match the schema",
        options.signal,
      ),
      this.readSection(
        [
          "pr",
          "view",
          String(number),
          "--repo",
          repository.value.fullName,
          "--json",
          "closingIssuesReferences",
        ],
        linkedIssuesResponseSchema,
        (cause) => normalizeLinkedIssues(cause, repository.value),
        "GitHub optional PR response did not match the schema",
        options.signal,
      ),
      options.includeDiff === false
        ? Promise.resolve(notRequested<PullRequestPatch>())
        : this.readPatch(number, repository.value, options.signal),
    ]);

    return Result.ok(
      buildDetails(
        repository.value,
        core.value,
        commits,
        conversationComments,
        reviewComments,
        reviews,
        requestedReviewers,
        files,
        checks,
        projects,
        linkedIssues,
        patch,
      ),
    );
  }

  private async getRepository(
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ForgeRepository, ForgeOperationError>> {
    return adapterHelpers.readForgeRepository(
      ["repo", "view", "--json", "nameWithOwner,url"],
      normalizeGithubRepository,
      kind,
      executableName,
      this.cwd,
      signal,
    );
  }

  private async getCore(
    repository: ForgeRepository,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestDetailCore, ForgeOperationError>> {
    return adapterHelpers.executeForgeJson(
      kind,
      executableName,
      this.cwd,
      [
        "pr",
        "view",
        String(number),
        "--repo",
        repository.fullName,
        "--json",
        "number,title,body,state,isDraft,author,url,createdAt,updatedAt,closedAt,mergedAt,mergedBy,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,isCrossRepository,additions,deletions,changedFiles,labels,assignees,milestone,maintainerCanModify,mergeable,mergeStateStatus,reviewDecision,mergeCommit",
      ],
      (cause) => normalizeCore(cause, repository),
      signal,
    );
  }

  private async readSection<Raw, T>(
    args: readonly string[],
    schema: (cause: unknown) => Raw | type.errors,
    normalize: (cause: Raw) => ResultType<T, ForgeOperationError>,
    diagnostic: string,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<T>> {
    const result = await adapterHelpers.executeForgeJson<T>(
      kind,
      executableName,
      this.cwd,
      args,
      (cause) => {
        const payload = schema(cause);
        if (payload instanceof type.errors) {
          return incompatible(kind, `${diagnostic}: ${payload.summary}`);
        }
        return normalize(payload);
      },
      signal,
    );
    return adapterHelpers.sectionFromResult(result);
  }

  private readPatch(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<PullRequestPatch>> {
    return adapterHelpers.readForgePatch(
      kind,
      executableName,
      this.cwd,
      [
        "pr",
        "diff",
        String(number),
        "--repo",
        repository.fullName,
        "--patch",
        "--color",
        "never",
      ],
      signal,
    );
  }
}

function pathForApi(
  repository: ForgeRepository,
  path: readonly string[],
): string {
  return `repos/${repository.fullName}/${path.join("/")}`;
}

function normalizeGithubRepository(
  cause: unknown,
): ResultType<ForgeRepository, ForgeOperationError> {
  const payload = adapterHelpers.parseForgeSchema(
    kind,
    repositorySchema,
    cause,
    "GitHub repository response did not match the schema",
  );
  if (payload.isErr()) {
    return payload;
  }
  return normalizeRepository(
    kind,
    payload.value.nameWithOwner,
    payload.value.url,
  );
}

function normalizeList(
  cause: unknown,
): ResultType<readonly PullRequestSummary[], ForgeOperationError> {
  const payload = listItemSchema.array()(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `GitHub pull request list did not match the schema: ${payload.summary}`,
    );
  }

  return Result.ok(payload.map(normalizeSummary));
}

function normalizeCore(
  cause: unknown,
  repository: ForgeRepository,
): ResultType<PullRequestDetailCore, ForgeOperationError> {
  const payload = coreSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `GitHub pull request response did not match the schema: ${payload.summary}`,
    );
  }

  const headRepository = payload.headRepository;
  const normalizedHeadRepository =
    headRepository === null || headRepository === undefined
      ? Result.ok<ForgeRepository | null, ForgeOperationError>(null)
      : normalizeRepository(
          kind,
          headRepository.nameWithOwner,
          headRepository.url,
        );
  if (normalizedHeadRepository.isErr()) {
    return Result.err(normalizedHeadRepository.error);
  }

  return Result.ok({
    summary: createPullRequestSummary(
      payload.number,
      payload.title,
      normalizeGithubState(payload.state, payload.mergedAt),
      payload.isDraft ?? null,
      normalizeUser(payload.author),
      normalizeDate(payload.updatedAt),
      payload.url ?? null,
    ),
    body: payload.body ?? null,
    createdAt: normalizeDate(payload.createdAt),
    updatedAt: normalizeDate(payload.updatedAt),
    closedAt: normalizeDate(payload.closedAt),
    mergedAt: normalizeDate(payload.mergedAt),
    mergedBy: normalizeUser(payload.mergedBy),
    base: {
      ref: payload.baseRefName ?? null,
      sha: payload.baseRefOid ?? null,
      repository,
    },
    head: {
      ref: payload.headRefName ?? null,
      sha: payload.headRefOid ?? null,
      repository: normalizedHeadRepository.value,
    },
    additions: payload.additions ?? null,
    deletions: payload.deletions ?? null,
    changedFiles: payload.changedFiles ?? null,
    labels: (payload.labels ?? []).map(normalizeLabel),
    assignees: (payload.assignees ?? []).flatMap((user) => {
      const normalized = normalizeUser(user);
      return normalized === null ? [] : [normalized];
    }),
    milestone:
      payload.milestone === null
        ? null
        : normalizeMilestone({
            ...payload.milestone,
            dueAt: payload.milestone.dueOn,
          }),
    maintainerCanModify: payload.maintainerCanModify ?? null,
    mergeability: {
      mergeable: normalizeMergeable(payload.mergeable),
      mergeState: payload.mergeStateStatus ?? null,
      reviewDecision: available(payload.reviewDecision ?? null),
      mergeCommitSha: payload.mergeCommit?.oid ?? null,
    },
  });
}

function normalizeSummary(
  payload: typeof listItemSchema.infer,
): PullRequestSummary {
  return createPullRequestSummary(
    payload.number,
    payload.title,
    normalizeGithubState(payload.state, undefined),
    payload.isDraft ?? null,
    normalizeUser(payload.author),
    normalizeDate(payload.updatedAt),
    payload.url ?? null,
  );
}

function normalizeMergeable(value: string | null | undefined): boolean | null {
  if (value === "MERGEABLE") {
    return true;
  }
  if (value === "CONFLICTING") {
    return false;
  }
  return null;
}

function normalizeCommits(
  payload: typeof commitPagesSchema.infer,
): ResultType<readonly PullRequestCommit[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: normalizeUser(commit.author),
      committer: normalizeUser(commit.committer),
      authoredAt: normalizeDate(commit.commit.author?.date),
      committedAt: normalizeDate(commit.commit.committer?.date),
      url: commit.html_url ?? commit.url ?? null,
    })),
  );
}

function normalizeConversationComments(
  payload: typeof commentPagesSchema.infer,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  return Result.ok(payload.flat().map(normalizeCommentBase));
}

function normalizeCommentBase(
  comment: typeof commentSchema.infer,
): PullRequestComment {
  return {
    id: String(comment.id),
    author: normalizeUser(comment.user),
    body: comment.body ?? null,
    createdAt: normalizeDate(comment.created_at),
    updatedAt: normalizeDate(comment.updated_at),
    url: comment.html_url ?? null,
  };
}

function normalizeReviewComments(
  payload: typeof commentPagesSchema.infer,
): ResultType<readonly PullRequestReviewComment[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((comment) => ({
      ...normalizeCommentBase(comment),
      location:
        comment.path === null || comment.path === undefined
          ? null
          : {
              path: comment.path,
              line: comment.line ?? null,
              startLine: comment.start_line ?? null,
              side: normalizeCommentSide(comment.side),
              commitSha: comment.commit_id ?? null,
            },
      replyToId: normalizeIdentifier(comment.in_reply_to_id),
      reviewId: normalizeIdentifier(comment.pull_request_review_id),
    })),
  );
}

function normalizeReviews(
  payload: typeof reviewPagesSchema.infer,
): ResultType<readonly PullRequestReview[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((review) => ({
      id: String(review.id),
      author: normalizeUser(review.user),
      body: review.body ?? null,
      state: review.state,
      submittedAt: normalizeDate(review.submitted_at),
      commitSha: review.commit_id ?? null,
      url: review.html_url ?? null,
    })),
  );
}

function normalizeRequestedReviewers(
  cause: unknown,
): ResultType<PullRequestReviewerRequests, ForgeOperationError> {
  const payload = requestedReviewersSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `GitHub requested reviewers response did not match the schema: ${payload.summary}`,
    );
  }

  return Result.ok({
    users: payload.users.flatMap((user) => {
      const normalized = normalizeUser(user);
      return normalized === null ? [] : [normalized];
    }),
    teams: payload.teams
      .map((team) => normalizeTeam(team))
      .filter((team): team is ForgeTeam => team !== null),
  });
}

function normalizeFiles(
  payload: typeof filePagesSchema.infer,
): ResultType<readonly PullRequestFile[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename ?? null,
      status: normalizeFileStatus(file.status),
      additions: file.additions ?? null,
      deletions: file.deletions ?? null,
      changes: file.changes ?? null,
      sha: file.sha ?? null,
      patch: file.patch ?? null,
      url: file.html_url ?? null,
    })),
  );
}

function normalizeChecks(
  cause: unknown,
): ResultType<readonly PullRequestCheck[], ForgeOperationError> {
  const payload = checksResponseSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `GitHub checks response did not match the schema: ${payload.summary}`,
    );
  }

  const checks: PullRequestCheck[] = [];
  for (const check of payload.statusCheckRollup) {
    const name = check.name ?? check.context;
    if (name === null || name === undefined || name.length === 0) {
      return incompatible(kind, "GitHub check response did not include a name");
    }
    checks.push({
      name,
      status: check.status ?? check.state ?? "unknown",
      conclusion: check.conclusion ?? null,
      description: check.description ?? null,
      link: check.detailsUrl ?? check.targetUrl ?? check.link ?? null,
      startedAt: normalizeDate(check.startedAt),
      completedAt: normalizeDate(check.completedAt),
      workflow: check.workflowName ?? check.workflow ?? null,
    });
  }
  return Result.ok(checks);
}

function normalizeProjects(
  cause: unknown,
): ResultType<readonly PullRequestProject[], ForgeOperationError> {
  const payload = projectsResponseSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `GitHub projects response did not match the schema: ${payload.summary}`,
    );
  }

  const projects: PullRequestProject[] = [];
  for (const project of payload.projectItems ?? []) {
    projects.push({
      id: project.id,
      title: project.title,
      number: project.number ?? null,
      url: project.url ?? null,
      state: project.state ?? null,
      kind: "v2",
    });
  }
  for (const card of payload.projectCards ?? []) {
    projects.push({
      id: String(card.project.id),
      title: card.project.name,
      number: card.project.number ?? null,
      url: card.project.html_url ?? null,
      state: card.project.state ?? null,
      kind: "classic",
    });
  }
  return Result.ok(projects);
}

function normalizeLinkedIssues(
  cause: unknown,
  repository: ForgeRepository,
): ResultType<readonly PullRequestLinkedIssue[], ForgeOperationError> {
  const payload = linkedIssuesResponseSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      kind,
      `GitHub linked issues response did not match the schema: ${payload.summary}`,
    );
  }

  const issues: PullRequestLinkedIssue[] = [];
  for (const issue of payload.closingIssuesReferences) {
    let issueRepository = repository;
    if (issue.repository !== null && issue.repository !== undefined) {
      const normalizedRepository = normalizeRepository(
        kind,
        issue.repository.nameWithOwner,
        issue.repository.url,
      );
      if (normalizedRepository.isErr()) {
        return Result.err(normalizedRepository.error);
      }
      issueRepository = normalizedRepository.value;
    }
    issues.push({
      repository: issueRepository,
      number: issue.number,
      title: issue.title ?? null,
      state: normalizeGithubState(issue.state, undefined),
      url: issue.url ?? null,
      relation: "closing-reference",
    });
  }
  return Result.ok(issues);
}

function buildDetails(
  repository: ForgeRepository,
  core: PullRequestDetailCore,
  commits: ForgeSection<readonly PullRequestCommit[]>,
  conversationComments: ForgeSection<readonly PullRequestComment[]>,
  reviewComments: ForgeSection<readonly PullRequestReviewComment[]>,
  reviews: ForgeSection<readonly PullRequestReview[]>,
  requestedReviewers: ForgeSection<PullRequestReviewerRequests>,
  files: ForgeSection<readonly PullRequestFile[]>,
  checks: ForgeSection<readonly PullRequestCheck[]>,
  projects: ForgeSection<readonly PullRequestProject[]>,
  linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>,
  patch: ForgeSection<PullRequestPatch>,
): PullRequestDetails {
  return assemblePullRequestDetails({
    repository,
    core,
    counts: {
      additions: core.additions,
      deletions: core.deletions,
      changedFiles: core.changedFiles,
      commits: sectionLength(commits),
      conversationComments: sectionLength(conversationComments),
      reviewComments: sectionLength(reviewComments),
    },
    collections: {
      commits,
      conversationComments,
      reviewComments,
      reviews,
      requestedReviewers,
      files,
      checks,
      projects,
      linkedIssues,
      patch,
    },
  });
}

function normalizeCommentSide(
  side: string | null | undefined,
): "additions" | "deletions" | "unknown" {
  if (side === "RIGHT") {
    return "additions";
  }
  if (side === "LEFT") {
    return "deletions";
  }
  return "unknown";
}

function normalizeFileStatus(status: string): PullRequestFile["status"] {
  switch (status.toLowerCase()) {
    case "added":
      return "added";
    case "modified":
      return "modified";
    case "removed":
      return "removed";
    case "renamed":
      return "renamed";
    case "copied":
      return "copied";
    case "changed":
      return "changed";
    default:
      return "unknown";
  }
}
