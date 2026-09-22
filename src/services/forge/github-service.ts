import { type } from "arktype";
import { Result } from "better-result";
import { ForgeAdapterBase, ForgeCli } from "./forge-cli";
import {
  normalizeChecks,
  normalizeCommits,
  normalizeConversationComments,
  normalizeDetails,
  normalizeLinkedIssues,
  normalizeListPayload,
  normalizeProjects,
  normalizeRepositoryPayload,
  normalizeRequestedReviewers,
  normalizeReviewComments,
  normalizeReviews,
  type GithubOverviewFields,
} from "./github-normalize";
import * as githubSchemas from "./github-schemas";
import { normalizeOverviewFields } from "./normalization";
import { available, failed, sectionFromResult } from "./section";
import { ApplicationContext } from "./types";

import type { Result as ResultType } from "better-result";
import type { CliRunner } from "./forge-cli";
import type { GithubPullRequestView } from "./github-schemas";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestCheck,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestDocument,
  PullRequestLinkedIssue,
  PullRequestList,
  PullRequestListOptions,
  PullRequestPatch,
  PullRequestProject,
  PullRequestResourceOptions,
  PullRequestReviewsResource,
  PullRequestSummary,
} from "./types";

const executable = "gh";
const kind = ApplicationContext.GitHub;
const optionalSectionDiagnostic =
  "GitHub optional PR response did not match the schema";
const pullRequestViewFields =
  "number,body,createdAt,updatedAt,closedAt,mergedAt,mergedBy,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,additions,deletions,changedFiles,labels,assignees,milestone,maintainerCanModify,mergeable,mergeStateStatus,reviewDecision,mergeCommit,statusCheckRollup,projectItems,projectCards,closingIssuesReferences";

export class GithubService extends ForgeAdapterBase implements ForgeAdapter {
  constructor(cli: ForgeCli) {
    super(
      cli,
      cli.cachedJson(
        ["repo", "view", "--json", "nameWithOwner,url"],
        decodeGithubRepository(cli),
      ),
    );
  }

  public static async initialize(cwd: string, run?: CliRunner) {
    const initialized = await ForgeCli.initialize(kind, executable, cwd, run);
    return initialized.map((cli) => new GithubService(cli));
  }

  public async getPullRequests(
    options: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return this.cli.pullRequestList(
      this.repository,
      (repository, limit, state) => [
        "pr",
        "list",
        "--repo",
        repository.fullName,
        "--state",
        state,
        "--limit",
        String(limit + 1),
        "--json",
        "number,title,state,isDraft,author,url,updatedAt",
      ],
      decodeGithubList(this.cli),
      options,
    );
  }

  public async loadPullRequest(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    return this.withRepository(options.signal, (repository) =>
      this.loadRepositoryPullRequest(number, repository, options),
    );
  }

  public async getCommitPatch(
    sha: string,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return this.withRepository(options.signal, (repository) =>
      this.cli.patch(
        [
          "api",
          pathForApi(repository, ["commits", sha]),
          "-H",
          "Accept: application/vnd.github.diff",
        ],
        options.signal,
      ),
    );
  }

  private async loadRepositoryPullRequest(
    number: number,
    repository: ForgeRepository,
    options: PullRequestResourceOptions,
  ): Promise<PullRequestDocument> {
    const signal = options.signal;
    const commitsTask = this.paginated(
      repository,
      ["pulls", String(number), "commits"],
      githubSchemas.commitPagesSchema,
      normalizeCommits,
      signal,
    );
    const reviewsTask = this.readReviews(repository, number, signal);
    const diffTask = this.cli.patch(
      [
        "pr",
        "diff",
        String(number),
        "--repo",
        repository.fullName,
        "--color",
        "never",
      ],
      signal,
    );
    const commentsTask = this.paginated(
      repository,
      ["issues", String(number), "comments"],
      githubSchemas.commentPagesSchema,
      normalizeConversationComments,
      signal,
    );
    const view = await this.readPullRequestView(
      number,
      repository.fullName,
      signal,
    );
    const projected = view.isOk()
      ? this.projectView(view.value, repository, number)
      : failedView(view.error);

    const comments = await commentsTask;
    const overview = projected.overview.isErr()
      ? projected.overview
      : Result.ok({
          repository,
          ...projected.overview.value,
          conversationComments: comments,
        });

    const [commits, reviews, diff] = await Promise.all([
      commitsTask,
      reviewsTask,
      diffTask,
    ]);
    return {
      overview,
      details: projected.details,
      diff,
      commits,
      reviews,
      checks: projected.checks,
      development: projected.development,
    };
  }

  private paginated<Raw, T>(
    repository: ForgeRepository,
    path: readonly string[],
    schema: (cause: unknown) => Raw | type.errors,
    normalize: (payload: Raw) => ResultType<T, ForgeOperationError>,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<T>> {
    return this.cli.section(
      ["api", "--paginate", "--slurp", pathForApi(repository, path)],
      schema,
      normalize,
      "GitHub paginated response did not match the schema",
      signal,
    );
  }

  private async readReviews(
    repository: ForgeRepository,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestReviewsResource> {
    const [reviews, reviewComments, requestedReviewers] = await Promise.all([
      this.paginated(
        repository,
        ["pulls", String(number), "reviews"],
        githubSchemas.reviewPagesSchema,
        normalizeReviews,
        signal,
      ),
      this.paginated(
        repository,
        ["pulls", String(number), "comments"],
        githubSchemas.commentPagesSchema,
        normalizeReviewComments,
        signal,
      ),
      this.cli.section(
        [
          "api",
          pathForApi(repository, [
            "pulls",
            String(number),
            "requested_reviewers",
          ]),
        ],
        githubSchemas.requestedReviewersSchema,
        normalizeRequestedReviewers,
        "GitHub response did not match the schema",
        signal,
      ),
    ]);
    return { reviews, reviewComments, requestedReviewers };
  }

  private readPullRequestView(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<GithubPullRequestView, ForgeOperationError>> {
    return this.cli.json(
      [
        "pr",
        "view",
        String(number),
        "--repo",
        repository,
        "--json",
        pullRequestViewFields,
      ],
      decodePullRequestView(this.cli),
      signal,
    );
  }

  private projectView(
    payload: GithubPullRequestView,
    repository: ForgeRepository,
    number: number,
  ): ViewProjection {
    return {
      overview: normalizeOverviewFields(kind, payload, number),
      details: normalizeDetails(payload, repository, number),
      checks: this.checksSection(payload),
      development: this.developmentSection(payload, repository),
    };
  }

  private checksSection(
    payload: GithubPullRequestView,
  ): ForgeSection<readonly PullRequestCheck[]> {
    const statusCheckRollup = payload.statusCheckRollup;
    if (statusCheckRollup === undefined || statusCheckRollup === null) {
      return available([]);
    }
    return sectionFromResult(
      this.cli
        .parse(
          githubSchemas.checkSchema.array(),
          statusCheckRollup,
          optionalSectionDiagnostic,
        )
        .andThen(normalizeChecks),
    );
  }

  private developmentSection(
    payload: GithubPullRequestView,
    repository: ForgeRepository,
  ): PullRequestDevelopment {
    return {
      projects: this.projectsSection(payload),
      linkedIssues: this.linkedIssuesSection(payload, repository),
    };
  }

  private projectsSection(
    payload: GithubPullRequestView,
  ): ForgeSection<readonly PullRequestProject[]> {
    return sectionFromResult(
      this.cli
        .parse(
          githubSchemas.projectItemSchema.array(),
          payload.projectItems ?? [],
          optionalSectionDiagnostic,
        )
        .andThen((projectItems) =>
          this.cli
            .parse(
              githubSchemas.projectCardSchema.array(),
              payload.projectCards ?? [],
              optionalSectionDiagnostic,
            )
            .andThen((projectCards) =>
              normalizeProjects(projectItems, projectCards),
            ),
        ),
    );
  }

  private linkedIssuesSection(
    payload: GithubPullRequestView,
    repository: ForgeRepository,
  ): ForgeSection<readonly PullRequestLinkedIssue[]> {
    const closingIssuesReferences = payload.closingIssuesReferences;
    if (
      closingIssuesReferences === undefined ||
      closingIssuesReferences === null
    ) {
      return available([]);
    }
    return sectionFromResult(
      this.cli
        .parse(
          githubSchemas.linkedIssueSchema.array(),
          closingIssuesReferences,
          optionalSectionDiagnostic,
        )
        .andThen((issues) => normalizeLinkedIssues(issues, repository)),
    );
  }
}

function decodeGithubRepository(cli: ForgeCli) {
  return (cause: unknown): ResultType<ForgeRepository, ForgeOperationError> =>
    cli
      .parse(
        githubSchemas.repositorySchema,
        cause,
        "GitHub repository response did not match the schema",
      )
      .andThen(normalizeRepositoryPayload);
}

function decodeGithubList(cli: ForgeCli) {
  return (
    cause: unknown,
  ): ResultType<readonly PullRequestSummary[], ForgeOperationError> =>
    cli
      .parse(
        githubSchemas.listItemSchema.array(),
        cause,
        "GitHub pull request list did not match the schema",
      )
      .andThen(normalizeListPayload);
}

interface ViewProjection {
  readonly overview: ResultType<GithubOverviewFields, ForgeOperationError>;
  readonly details: ResultType<PullRequestDetails, ForgeOperationError>;
  readonly checks: ForgeSection<readonly PullRequestCheck[]>;
  readonly development: PullRequestDevelopment;
}

function failedView(error: ForgeOperationError): ViewProjection {
  return {
    overview: Result.err(error),
    details: Result.err(error),
    checks: failed(error),
    development: {
      projects: failed(error),
      linkedIssues: failed(error),
    },
  };
}

function decodePullRequestView(cli: ForgeCli) {
  return (
    cause: unknown,
  ): ResultType<GithubPullRequestView, ForgeOperationError> =>
    cli.parse(
      githubSchemas.pullRequestViewSchema,
      cause,
      "GitHub pull request view response did not match the schema",
    );
}

function pathForApi(
  repository: ForgeRepository,
  path: readonly string[],
): string {
  return `repos/${repository.fullName}/${path.join("/")}`;
}
