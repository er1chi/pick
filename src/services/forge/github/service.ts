import { Result } from "better-result";
import { executeCli } from "../cli-execution";
import { decoder, ForgeApi } from "../forge-api";
import { verifyCli } from "../forge-cli";
import { normalizeCommit, normalizeSummary } from "../normalization";
import { repositoryForRemotes } from "../remote";
import {
  requestPullRequest,
  requestPullRequestList,
  validateCommitSha,
  withRepository,
} from "../requests";
import { pullSummarySchema } from "../schema-primitives";
import { available, failed, sectionFrom, sectionFromResult } from "../section";
import { ForgeKind } from "../types";
import {
  normalizeChecks,
  normalizeConversationComments,
  normalizeDetails,
  normalizeLinkedIssues,
  normalizeProjects,
  normalizeRequestedReviewers,
  normalizeReviewComments,
  normalizeReviews,
} from "./normalize";
import { pullRequestProjectsQuery, pullRequestViewQuery } from "./queries";
import * as githubSchemas from "./schemas";

import type { type } from "arktype";
import type { Result as ResultType } from "better-result";
import type { Decoder } from "../forge-api";
import type { RepositoryLookup } from "../requests";
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
  PullRequestProject,
  PullRequestResourceOptions,
  PullRequestReviewsResource,
} from "../types";
import type { GithubPullRequestView } from "./schemas";

const executable = "gh";
const kind = ForgeKind.GitHub;
const host = "github.com";
const apiUrl = "https://api.github.com";
const diffAccept = "application/vnd.github.diff";
const optionalSectionDiagnostic =
  "GitHub optional PR response did not match the schema";

/** `GH_TOKEN` and `GITHUB_TOKEN` win, as they do for `gh`. Otherwise the token
 * is whatever `gh` is logged in with, looked up once. */
function githubToken(cwd: string): () => Promise<string | undefined> {
  let pending: Promise<string | undefined> | undefined;
  return () => {
    pending ??= lookupToken(cwd).then((token) => {
      if (token === undefined) {
        pending = undefined;
      }
      return token;
    });
    return pending;
  };
}

async function lookupToken(cwd: string): Promise<string | undefined> {
  const fromEnvironment = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (fromEnvironment !== undefined && fromEnvironment !== "") {
    return fromEnvironment;
  }
  const execution = await executeCli(
    kind,
    executable,
    ["auth", "token", "--hostname", host],
    cwd,
  );
  const token = execution.map((output) => output.trim()).unwrapOr("");
  return token === "" ? undefined : token;
}

function decode<T>(
  schema: (cause: unknown) => T | type.errors,
  diagnostic: string,
): Decoder<T> {
  return decoder(kind, schema, diagnostic);
}

export class GithubService implements Forge {
  public readonly kind = kind;

  constructor(
    private readonly repository: RepositoryLookup,
    private readonly api: ForgeApi,
  ) {}

  public static async initialize(cwd: string, remoteOutput: string) {
    const verified = await verifyCli(kind, executable, cwd);
    const repository = repositoryForRemotes(kind, remoteOutput);
    const api = new ForgeApi(kind, {
      baseUrl: () => Result.ok(apiUrl),
      token: githubToken(cwd),
      pageQuery: "per_page=100",
    });
    return verified.map(() => new GithubService(async () => repository, api));
  }

  public async getPullRequests(
    options: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return requestPullRequestList(
      kind,
      this.repository,
      options,
      async (repository, { limit, state }) => {
        const items = await this.api.pagedJson(
          repository,
          `pulls?state=${state}`,
          decoder(
            kind,
            pullSummarySchema.array(),
            "GitHub pull request list did not match the schema",
          ),
          options.signal,
          limit + 1,
        );
        return items.map((payload) => payload.map(normalizeSummary));
      },
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
        await sectionFrom(
          this.api.text(
            repository,
            `commits/${sha}`,
            options.signal,
            diffAccept,
          ),
          (text) => ({ text }),
        ),
      ),
    );
  }

  private async loadDocument(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestDocument> {
    const [view, comments, commits, reviews, diff, projects] =
      await Promise.all([
        this.queryPullRequest(
          repository,
          pullRequestViewQuery,
          number,
          githubSchemas.pullRequestViewSchema,
          signal,
        ),
        sectionFrom(
          this.api.pagedJson(
            repository,
            `issues/${number}/comments`,
            decode(
              githubSchemas.commentsSchema,
              "GitHub paginated response did not match the schema",
            ),
            signal,
          ),
          normalizeConversationComments,
        ),
        sectionFrom(
          this.api.pagedJson(
            repository,
            `pulls/${number}/commits`,
            decode(
              githubSchemas.commitsSchema,
              "GitHub paginated response did not match the schema",
            ),
            signal,
          ),
          (payload) => payload.map(normalizeCommit),
        ),
        this.readReviews(repository, number, signal),
        sectionFrom(
          this.api.text(repository, `pulls/${number}`, signal, diffAccept),
          (text) => ({ text }),
        ),
        this.queryPullRequest(
          repository,
          pullRequestProjectsQuery,
          number,
          githubSchemas.pullRequestProjectsSchema,
          signal,
        ).then((result) =>
          // Most tokens lack `read:project`, and `gh` reports no projects then.
          available(result.map(normalizeProjects).unwrapOr([])),
        ),
      ]);
    const projected = view.isOk()
      ? this.projectView(view.value, repository, number, projects)
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

  private queryPullRequest<T>(
    repository: ForgeRepository,
    query: string,
    number: number,
    schema: (
      cause: unknown,
    ) => { readonly repository: { readonly pullRequest: T } } | type.errors,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<T, ForgeOperationError>> {
    const diagnostic = "GitHub pull request response did not match the schema";
    return this.api.graphql(
      repository,
      query,
      { owner: repository.owner, name: repository.name, number },
      (cause) =>
        decode(
          schema,
          diagnostic,
        )(cause).map(({ repository }) => repository.pullRequest),
      signal,
    );
  }

  private async readReviews(
    repository: ForgeRepository,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestReviewsResource> {
    const path = `pulls/${number}`;
    const diagnostic = "GitHub paginated response did not match the schema";
    const [reviews, reviewComments, requestedReviewers] = await Promise.all([
      sectionFrom(
        this.api.pagedJson(
          repository,
          `${path}/reviews`,
          decode(githubSchemas.reviewsSchema, diagnostic),
          signal,
        ),
        normalizeReviews,
      ),
      sectionFrom(
        this.api.pagedJson(
          repository,
          `${path}/comments`,
          decode(githubSchemas.commentsSchema, diagnostic),
          signal,
        ),
        normalizeReviewComments,
      ),
      sectionFrom(
        this.api.json(
          repository,
          `${path}/requested_reviewers`,
          decode(
            githubSchemas.requestedReviewersSchema,
            "GitHub requested reviewers response did not match the schema",
          ),
          signal,
        ),
        normalizeRequestedReviewers,
      ),
    ]);
    return { reviews, reviewComments, requestedReviewers };
  }

  private projectView(
    payload: GithubPullRequestView,
    repository: ForgeRepository,
    number: number,
    projects: ForgeSection<readonly PullRequestProject[]>,
  ): ViewProjection {
    return {
      details: available(normalizeDetails(payload, repository, number)),
      checks: this.optionalSection(
        payload.commits,
        githubSchemas.checksSchema,
        normalizeChecks,
      ),
      development: {
        projects,
        linkedIssues: this.optionalSection(
          payload.closingIssuesReferences,
          githubSchemas.linkedIssuesSchema,
          normalizeLinkedIssues,
        ),
      },
    };
  }

  private optionalSection<Raw, T>(
    cause: unknown,
    schema: (cause: unknown) => Raw | type.errors,
    normalize: (payload: Raw) => T,
  ): ForgeSection<T> {
    return sectionFromResult(
      decode(schema, optionalSectionDiagnostic)(cause).map(normalize),
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
