import { Result } from "better-result";
import { ForgeCli } from "./forge-cli";
import {
  normalizeChecks,
  normalizeCommits,
  normalizeConversationComments,
  normalizeDetails,
  normalizeLinkedIssues,
  normalizeProjects,
  normalizeRepositoryPayload,
  normalizeRequestedReviewers,
  normalizeReviewComments,
  normalizeReviews,
  normalizeSummary,
} from "./github-normalize";
import * as githubSchemas from "./github-schemas";
import { matchPullRequestNumber } from "./normalization";
import {
  requestPullRequest,
  requestPullRequestList,
  validateCommitSha,
  withRepository,
} from "./requests";
import { available, failed, sectionFromResult } from "./section";
import { ForgeKind } from "./types";

import type { type } from "arktype";
import type { Result as ResultType } from "better-result";
import type { CliRunner } from "./forge-cli";
import type { GithubPullRequestView } from "./github-schemas";
import type { RepositoryLookup } from "./requests";
import type {
  Forge,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestCheck,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestDocument,
  PullRequestList,
  PullRequestListOptions,
  PullRequestPatch,
  PullRequestResourceOptions,
  PullRequestReviewsResource,
} from "./types";

const executable = "gh";
const kind = ForgeKind.GitHub;
const optionalSectionDiagnostic =
  "GitHub optional PR response did not match the schema";

export class GithubService implements Forge {
  public readonly kind = kind;
  private readonly repository: RepositoryLookup;

  constructor(private readonly cli: ForgeCli) {
    this.repository = cli.cachedJson(
      ["repo", "view", "--json", "nameWithOwner,url"],
      (cause) =>
        cli
          .parse(
            githubSchemas.repositorySchema,
            cause,
            "GitHub repository response did not match the schema",
          )
          .andThen(normalizeRepositoryPayload),
    );
  }

  public static async initialize(cwd: string, run?: CliRunner) {
    const initialized = await ForgeCli.initialize(kind, executable, cwd, run);
    return initialized.map((cli) => new GithubService(cli));
  }

  public async getPullRequests(
    options: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return requestPullRequestList(
      kind,
      this.repository,
      options,
      (repository, { limit, state }) =>
        this.cli.json(
          [
            "pr",
            "list",
            "--repo",
            repository.fullName,
            "--state",
            state,
            "--limit",
            String(limit + 1),
            "--json",
            "number,title,state,isDraft,author",
          ],
          (cause) =>
            this.cli
              .parse(
                githubSchemas.listItemSchema.array(),
                cause,
                "GitHub pull request list did not match the schema",
              )
              .map((payload) => payload.map(normalizeSummary)),
          options.signal,
        ),
    );
  }

  public async loadPullRequest(
    number: number,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<PullRequestDocument, ForgeOperationError>> {
    return requestPullRequest(kind, this.repository, number, (repository) =>
      this.loadDocument(number, repository, options.signal),
    );
  }

  public async getCommitPatch(
    sha: string,
    options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    const valid = validateCommitSha(kind, sha);
    if (valid.isErr()) {
      return valid;
    }
    return withRepository(kind, this.repository, async (repository) =>
      Result.ok(
        await this.cli.patch(
          [
            "api",
            pathForApi(repository, ["commits", sha]),
            "-H",
            "Accept: application/vnd.github.diff",
          ],
          options.signal,
        ),
      ),
    );
  }

  private async loadDocument(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestDocument> {
    const [view, comments, commits, reviews, diff] = await Promise.all([
      this.cli.json(
        [
          "pr",
          "view",
          String(number),
          "--repo",
          repository.fullName,
          "--json",
          githubSchemas.pullRequestViewFields,
        ],
        (cause) =>
          this.cli
            .parse(
              githubSchemas.pullRequestViewSchema,
              cause,
              "GitHub pull request view response did not match the schema",
            )
            .andThen((payload) =>
              matchPullRequestNumber(kind, payload, number),
            ),
        signal,
      ),
      this.paginated(
        repository,
        ["issues", String(number), "comments"],
        githubSchemas.commentPagesSchema,
        normalizeConversationComments,
        signal,
      ),
      this.paginated(
        repository,
        ["pulls", String(number), "commits"],
        githubSchemas.commitPagesSchema,
        normalizeCommits,
        signal,
      ),
      this.readReviews(repository, number, signal),
      this.cli.patch(
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
      ),
    ]);
    const projected = view.isOk()
      ? this.projectView(view.value, repository)
      : failedView(view.error);
    return {
      details: projected.details,
      comments,
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
    normalize: (payload: Raw) => T,
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
        "GitHub requested reviewers response did not match the schema",
        signal,
      ),
    ]);
    return { reviews, reviewComments, requestedReviewers };
  }

  private projectView(
    payload: GithubPullRequestView,
    repository: ForgeRepository,
  ): ViewProjection {
    return {
      details: available(normalizeDetails(payload, repository)),
      checks: this.optionalSection(
        payload.statusCheckRollup,
        githubSchemas.checkSchema.array(),
        normalizeChecks,
      ),
      development: {
        projects: this.optionalSection(
          payload.projectItems,
          githubSchemas.projectItemSchema.array(),
          normalizeProjects,
        ),
        linkedIssues: this.optionalSection(
          payload.closingIssuesReferences,
          githubSchemas.linkedIssueSchema.array(),
          normalizeLinkedIssues,
        ),
      },
    };
  }

  /** A list field of the view that `gh` reports as `null` when empty. */
  private optionalSection<Raw, T>(
    cause: unknown,
    schema: (cause: unknown) => readonly Raw[] | type.errors,
    normalize: (payload: readonly Raw[]) => readonly T[],
  ): ForgeSection<readonly T[]> {
    return sectionFromResult(
      this.cli
        .parse(schema, cause ?? [], optionalSectionDiagnostic)
        .map(normalize),
    );
  }
}

interface ViewProjection {
  readonly details: ForgeSection<PullRequestDetails>;
  readonly checks: ForgeSection<readonly PullRequestCheck[]>;
  readonly development: PullRequestDevelopment;
}

function failedView(error: ForgeOperationError): ViewProjection {
  return {
    details: failed(error),
    checks: failed(error),
    development: {
      projects: failed(error),
      linkedIssues: failed(error),
    },
  };
}

function pathForApi(
  repository: ForgeRepository,
  path: readonly string[],
): string {
  return `repos/${repository.fullName}/${path.join("/")}`;
}
