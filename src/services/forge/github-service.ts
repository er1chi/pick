import { type } from "arktype";
import { Result } from "better-result";
import * as adapterHelpers from "./adapter-helpers";
import {
  type GithubOverviewFields,
  normalizeChecks,
  normalizeCommits,
  normalizeConversationComments,
  normalizeDetails,
  normalizeLinkedIssues,
  normalizeListPayload,
  normalizeOverview,
  normalizeProjects,
  normalizeRepositoryPayload,
  normalizeRequestedReviewers,
  normalizeReviewComments,
  normalizeReviews,
} from "./github-normalize";
import * as githubSchemas from "./github-schemas";
import {
  assemblePullRequestOverview,
  available,
  failed,
} from "./normalization";
import { ApplicationContext, ForgeCancelledError } from "./types";

import type { Result as ResultType } from "better-result";
import type { SharedCliFlight } from "./adapter-helpers";
import type { GithubPullRequestView } from "./github-schemas";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestCheck,
  PullRequestComment,
  PullRequestCommit,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestDocument,
  PullRequestLinkedIssue,
  PullRequestList,
  PullRequestListOptions,
  PullRequestOverview,
  PullRequestOverviewOptions,
  PullRequestPatch,
  PullRequestProject,
  PullRequestResourceOptions,
  PullRequestReviewsResource,
  PullRequestSummary,
} from "./types";

const executableName = "gh";
const kind = ApplicationContext.GitHub;
const pullRequestViewFields =
  "number,body,createdAt,updatedAt,closedAt,mergedAt,mergedBy,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,additions,deletions,changedFiles,labels,assignees,milestone,maintainerCanModify,mergeable,mergeStateStatus,reviewDecision,mergeCommit,statusCheckRollup,projectItems,projectCards,closingIssuesReferences";

export class GithubService implements ForgeAdapter {
  public readonly kind = kind;

  private readonly repositoryReader: (
    signal: AbortSignal | undefined,
  ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>;

  private readonly viewFlights = new Map<
    string,
    SharedCliFlight<GithubPullRequestView>
  >();

  private constructor(private readonly cwd: string) {
    this.repositoryReader = adapterHelpers.createCachedForgeRepositoryReader(
      ["repo", "view", "--json", "nameWithOwner,url"],
      decodeGithubRepository,
      kind,
      executableName,
      cwd,
    );
  }

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
      decodeGithubList,
      (signal) => this.getRepository(signal),
      kind,
      executableName,
      this.cwd,
      options,
    );
  }

  public async loadPullRequest(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      (repository) =>
        this.loadRepositoryPullRequest(number, repository, options),
    );
  }

  public async getPullRequestOverview(
    number: number,
    options: PullRequestOverviewOptions = {},
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      (repository) => this.readOverview(number, repository, options.signal),
    );
  }

  public async getCommitPatch(
    sha: string,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return this.readPatchSection(options.signal, (repository) => [
      "api",
      pathForApi(repository, ["commits", sha]),
      "-H",
      "Accept: application/vnd.github.diff",
    ]);
  }

  public async getPullRequestDetails(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDetails, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) => {
        const view = await this.getView(
          number,
          repository.fullName,
          options.signal,
        );
        return view.andThen((payload) =>
          normalizeDetails(payload, repository, number),
        );
      },
    );
  }

  public async getPullRequestDiff(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return this.readPatchSection(options.signal, (repository) => [
      "pr",
      "diff",
      String(number),
      "--repo",
      repository.fullName,
      "--color",
      "never",
    ]);
  }

  public async getPullRequestCommits(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<
    ResultType<ForgeSection<readonly PullRequestCommit[]>, ForgeOperationError>
  > {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) =>
        Result.ok(await this.readCommits(repository, number, options.signal)),
    );
  }

  public async getPullRequestReviews(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestReviewsResource, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) =>
        Result.ok(await this.readReviews(repository, number, options.signal)),
    );
  }

  public async getPullRequestChecks(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<
    ResultType<ForgeSection<readonly PullRequestCheck[]>, ForgeOperationError>
  > {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) => {
        const view = await this.getView(
          number,
          repository.fullName,
          options.signal,
        );
        return Result.ok(
          view.isOk() ? this.checksSection(view.value) : failed(view.error),
        );
      },
    );
  }

  public async getPullRequestDevelopment(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDevelopment, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) => {
        const view = await this.getView(
          number,
          repository.fullName,
          options.signal,
        );
        if (view.isErr()) {
          return Result.ok({
            projects: failed(view.error),
            linkedIssues: failed(view.error),
          });
        }
        return Result.ok(this.developmentSection(view.value, repository));
      },
    );
  }

  private getRepository(signal: AbortSignal | undefined) {
    return this.repositoryReader(signal);
  }

  private async loadRepositoryPullRequest(
    number: number,
    repository: ForgeRepository,
    options: PullRequestResourceOptions,
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    const signal = options.signal;
    const commitsTask = this.readCommits(repository, number, signal);
    const reviewsTask = this.readReviews(repository, number, signal);
    const diffTask = this.readPullRequestDiff(repository, number, signal);
    const commentsTask = this.readConversationComments(
      repository,
      number,
      signal,
    );
    const view = await this.getView(number, repository.fullName, signal);
    const projected = view.isOk()
      ? this.projectView(view.value, repository, number)
      : failedView(view.error);

    const comments = await commentsTask;
    const overview = projected.overview.isErr()
      ? projected.overview
      : Result.ok(
          assemblePullRequestOverview(
            repository,
            projected.overview.value,
            comments,
          ),
        );

    const [commits, reviews, diff] = await Promise.all([
      commitsTask,
      reviewsTask,
      diffTask,
    ]);
    return Result.ok({
      overview,
      details: projected.details,
      diff,
      commits,
      reviews,
      checks: projected.checks,
      development: projected.development,
    });
  }

  private async readOverview(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    const [view, conversationComments] = await Promise.all([
      this.getView(number, repository.fullName, signal),
      this.readConversationComments(repository, number, signal),
    ]);
    if (view.isErr()) {
      return view;
    }
    const fields = normalizeOverview(view.value, number);
    if (fields.isErr()) {
      return fields;
    }
    return Result.ok(
      assemblePullRequestOverview(
        repository,
        fields.value,
        conversationComments,
      ),
    );
  }

  private async readConversationComments(
    repository: ForgeRepository,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<readonly PullRequestComment[]>> {
    return this.readSection(
      [
        "api",
        "--paginate",
        "--slurp",
        pathForApi(repository, ["issues", String(number), "comments"]),
      ],
      githubSchemas.commentPagesSchema,
      normalizeConversationComments,
      "GitHub paginated response did not match the schema",
      signal,
    );
  }

  private async readCommits(
    repository: ForgeRepository,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<readonly PullRequestCommit[]>> {
    return this.readSection(
      [
        "api",
        "--paginate",
        "--slurp",
        pathForApi(repository, ["pulls", String(number), "commits"]),
      ],
      githubSchemas.commitPagesSchema,
      normalizeCommits,
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
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository, ["pulls", String(number), "reviews"]),
        ],
        githubSchemas.reviewPagesSchema,
        normalizeReviews,
        "GitHub paginated response did not match the schema",
        signal,
      ),
      this.readSection(
        [
          "api",
          "--paginate",
          "--slurp",
          pathForApi(repository, ["pulls", String(number), "comments"]),
        ],
        githubSchemas.commentPagesSchema,
        normalizeReviewComments,
        "GitHub paginated response did not match the schema",
        signal,
      ),
      this.readSection(
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

  private async readPullRequestDiff(
    repository: ForgeRepository,
    number: number,
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
        "--color",
        "never",
      ],
      signal,
    );
  }

  private async getView(
    number: number,
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<GithubPullRequestView, ForgeOperationError>> {
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
  ): SharedCliFlight<GithubPullRequestView> {
    const controller = new AbortController();
    const promise = this.runViewFlight(key, controller, number, repository);
    return { key, controller, promise, waiters: 0 };
  }

  private async runViewFlight(
    key: string,
    controller: AbortController,
    number: number,
    repository: string,
  ): Promise<ResultType<GithubPullRequestView, ForgeOperationError>> {
    const result = await adapterHelpers.executeForgeJson(
      kind,
      executableName,
      this.cwd,
      [
        "pr",
        "view",
        String(number),
        "--repo",
        repository,
        "--json",
        pullRequestViewFields,
      ],
      decodePullRequestView,
      controller.signal,
    );
    if (this.viewFlights.get(key)?.controller === controller) {
      this.viewFlights.delete(key);
    }
    return result;
  }

  private finishViewFlight(
    flight: SharedCliFlight<GithubPullRequestView>,
  ): void {
    if (this.viewFlights.get(flight.key) !== flight) {
      return;
    }
    this.viewFlights.delete(flight.key);
    flight.controller.abort();
  }

  private projectView(
    payload: GithubPullRequestView,
    repository: ForgeRepository,
    number: number,
  ): ViewProjection {
    return {
      overview: normalizeOverview(payload, number),
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
    return adapterHelpers.sectionFromResult(
      adapterHelpers
        .parseForgeSchema(
          kind,
          githubSchemas.checksResponseSchema,
          { statusCheckRollup },
          "GitHub optional PR response did not match the schema",
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
    return adapterHelpers.sectionFromResult(
      adapterHelpers
        .parseForgeSchema(
          kind,
          githubSchemas.projectsResponseSchema,
          {
            projectItems: payload.projectItems ?? null,
            projectCards: payload.projectCards ?? null,
          },
          "GitHub optional PR response did not match the schema",
        )
        .andThen(normalizeProjects),
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
    return adapterHelpers.sectionFromResult(
      adapterHelpers
        .parseForgeSchema(
          kind,
          githubSchemas.linkedIssuesResponseSchema,
          { closingIssuesReferences },
          "GitHub optional PR response did not match the schema",
        )
        .andThen((linked) => normalizeLinkedIssues(linked, repository)),
    );
  }

  private async readSection<Raw, T>(
    args: readonly string[],
    schema: (cause: unknown) => Raw | type.errors,
    normalize: (payload: Raw) => ResultType<T, ForgeOperationError>,
    diagnostic: string,
    signal: AbortSignal | undefined,
  ): Promise<ForgeSection<T>> {
    const result = await adapterHelpers.executeForgeJson<T>(
      kind,
      executableName,
      this.cwd,
      args,
      (cause) =>
        adapterHelpers
          .parseForgeSchema(kind, schema, cause, diagnostic)
          .andThen(normalize),
      signal,
    );
    return adapterHelpers.sectionFromResult(result);
  }

  /**
   * Resolves the repository and reads one complete patch through the git diff
   * media type. Shared by the commit patch and the pull request diff, which
   * differ only in the CLI arguments they pass.
   */
  private async readPatchSection(
    signal: AbortSignal | undefined,
    patchArgs: (repository: ForgeRepository) => readonly string[],
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      signal,
      async (repository) => {
        const patch = await adapterHelpers.readForgePatch(
          kind,
          executableName,
          this.cwd,
          patchArgs(repository),
          signal,
        );
        return Result.ok(patch);
      },
    );
  }
}

function decodeGithubRepository(
  cause: unknown,
): ResultType<ForgeRepository, ForgeOperationError> {
  return adapterHelpers
    .parseForgeSchema(
      kind,
      githubSchemas.repositorySchema,
      cause,
      "GitHub repository response did not match the schema",
    )
    .andThen(normalizeRepositoryPayload);
}

function decodeGithubList(
  cause: unknown,
): ResultType<readonly PullRequestSummary[], ForgeOperationError> {
  return adapterHelpers
    .parseForgeSchema(
      kind,
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

function cancelledView(): ResultType<
  GithubPullRequestView,
  ForgeOperationError
> {
  return Result.err(
    new ForgeCancelledError({
      kind,
      message: "The GitHub pull request view request was cancelled",
    }),
  );
}

function decodePullRequestView(
  cause: unknown,
): ResultType<GithubPullRequestView, ForgeOperationError> {
  return adapterHelpers.parseForgeSchema(
    kind,
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
