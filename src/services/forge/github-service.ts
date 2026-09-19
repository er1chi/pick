import { type } from "arktype";
import { Result } from "better-result";
import * as adapterHelpers from "./adapter-helpers";
import {
  type GithubDetailsFields,
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
import { assemblePullRequestOverview } from "./normalization";
import { ApplicationContext } from "./types";

import type { Result as ResultType } from "better-result";
import type {
  ForgeAdapter,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestList,
  PullRequestListOptions,
  PullRequestOverview,
  PullRequestOverviewOptions,
  PullRequestPatch,
  PullRequestResourceOptions,
  PullRequestReviewsResource,
  PullRequestSummary,
} from "./types";

const executableName = "gh";
const kind = ApplicationContext.GitHub;

export class GithubService implements ForgeAdapter {
  public readonly kind = kind;

  private readonly repositoryReader: (
    signal: AbortSignal | undefined,
  ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>;

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

  public getPullRequestOverview(
    number: number,
    options: PullRequestOverviewOptions = {},
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    return this.readGithubOverviewForSelection(number, options.signal);
  }

  public getCommitPatch(
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

  private readGithubOverviewForSelection(
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      signal,
      (repository) => this.readGithubOverview(number, repository, signal),
    );
  }

  private async readGithubOverview(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<PullRequestOverview, ForgeOperationError>> {
    const [fields, conversationComments] = await Promise.all([
      this.getOverviewFields(repository, number, signal),
      this.readSection(
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
      ),
    ]);
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

  private async getOverviewFields(
    repository: ForgeRepository,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<GithubOverviewFields, ForgeOperationError>> {
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
        "number,body",
      ],
      (cause) => decodeOverviewFields(cause, number),
      signal,
    );
  }

  public async getPullRequestDetails(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDetails, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) => {
        const details = await adapterHelpers.executeForgeJson(
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
            "number,createdAt,updatedAt,closedAt,mergedAt,mergedBy,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,additions,deletions,changedFiles,labels,assignees,milestone,maintainerCanModify,mergeable,mergeStateStatus,reviewDecision,mergeCommit",
          ],
          (cause) => decodeDetailsFields(cause, repository, number),
          options.signal,
        );
        return details;
      },
    );
  }

  public getPullRequestDiff(
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
      async (repository) => {
        const commits = await this.readSection(
          [
            "api",
            "--paginate",
            "--slurp",
            pathForApi(repository, ["pulls", String(number), "commits"]),
          ],
          githubSchemas.commitPagesSchema,
          normalizeCommits,
          "GitHub paginated response did not match the schema",
          options.signal,
        );
        return Result.ok(commits);
      },
    );
  }

  public async getPullRequestReviews(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestReviewsResource, ForgeOperationError>> {
    return adapterHelpers.withForgeRepository(
      this.repositoryReader,
      options.signal,
      async (repository) => {
        const [reviews, reviewComments, requestedReviewers] = await Promise.all(
          [
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
              options.signal,
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
              options.signal,
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
              options.signal,
            ),
          ],
        );
        const value: PullRequestReviewsResource = {
          reviews,
          reviewComments,
          requestedReviewers,
        };
        return Result.ok(value);
      },
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
        const checks = await this.readSection(
          [
            "pr",
            "view",
            String(number),
            "--repo",
            repository.fullName,
            "--json",
            "statusCheckRollup",
          ],
          githubSchemas.checksResponseSchema,
          normalizeChecks,
          "GitHub optional PR response did not match the schema",
          options.signal,
        );
        return Result.ok(checks);
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
        const [projects, linkedIssues] = await Promise.all([
          this.readSection(
            [
              "pr",
              "view",
              String(number),
              "--repo",
              repository.fullName,
              "--json",
              "projectItems,projectCards",
            ],
            githubSchemas.projectsResponseSchema,
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
              repository.fullName,
              "--json",
              "closingIssuesReferences",
            ],
            githubSchemas.linkedIssuesResponseSchema,
            (payload) => normalizeLinkedIssues(payload, repository),
            "GitHub optional PR response did not match the schema",
            options.signal,
          ),
        ]);
        return Result.ok({ projects, linkedIssues });
      },
    );
  }

  private getRepository(signal: AbortSignal | undefined) {
    return this.repositoryReader(signal);
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
  private readPatchSection(
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

function decodeOverviewFields(
  cause: unknown,
  expectedNumber: number,
): ResultType<GithubOverviewFields, ForgeOperationError> {
  return adapterHelpers
    .parseForgeSchema(
      kind,
      githubSchemas.overviewSchema,
      cause,
      "GitHub pull request overview response did not match the schema",
    )
    .andThen((payload) => normalizeOverview(payload, expectedNumber));
}

function decodeDetailsFields(
  cause: unknown,
  repository: ForgeRepository,
  expectedNumber: number,
): ResultType<GithubDetailsFields, ForgeOperationError> {
  return adapterHelpers
    .parseForgeSchema(
      kind,
      githubSchemas.detailsSchema,
      cause,
      "GitHub pull request details response did not match the schema",
    )
    .andThen((payload) =>
      normalizeDetails(payload, repository, expectedNumber),
    );
}

function pathForApi(
  repository: ForgeRepository,
  path: readonly string[],
): string {
  return `repos/${repository.fullName}/${path.join("/")}`;
}
