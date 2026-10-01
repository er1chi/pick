import { type } from "arktype";
import { Result } from "better-result";
import { homedir } from "node:os";
import { join } from "node:path";
import { decoder, ForgeApi } from "./forge-api";
import { verifyCli } from "./forge-cli";
import {
  normalizeCommit,
  normalizeSummary,
  normalizeTeams,
  normalizeUser,
  normalizeUsers,
  withExpectedCommentCount,
} from "./normalization";
import { repositoryForRemotes } from "./remote";
import {
  requestPullRequest,
  requestPullRequestList,
  validateCommitSha,
  withRepository,
} from "./requests";
import {
  commitSchema,
  optionalBoolean,
  optionalNullableString,
  optionalNumber,
  optionalUser,
  pullSummarySchema,
  safeIntegerSchema,
  teamSchema,
  userSchema,
} from "./schema-primitives";
import { available, failed, sectionFrom, unsupported } from "./section";
import { ForgeInvalidRequestError, ForgeKind } from "./types";

import type { Result as ResultType } from "better-result";
import type { RepositoryLookup } from "./requests";
import type {
  Forge,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestComment,
  PullRequestDetails,
  PullRequestDocument,
  PullRequestList,
  PullRequestListOptions,
  PullRequestPatch,
  PullRequestRef,
  PullRequestResourceOptions,
  PullRequestReviewerRequests,
} from "./types";

const executable = "fj";
const kind = ForgeKind.Forgejo;

const keysSchema = type({
  hosts: type({ "[string]": type({ token: "string" }) }),
});

const branchSchema = type({
  label: optionalNullableString,
  ref: optionalNullableString,
  sha: optionalNullableString,
});
const viewSchema = type({
  number: safeIntegerSchema,
  body: optionalNullableString,
  created_at: optionalNullableString,
  updated_at: optionalNullableString,
  merged_at: optionalNullableString,
  base: branchSchema.or("null").optional(),
  head: branchSchema.or("null").optional(),
  additions: optionalNumber,
  deletions: optionalNumber,
  comments: optionalNumber,
  mergeable: optionalBoolean,
  requested_reviewers: userSchema.array().or("null").optional(),
  requested_reviewers_teams: teamSchema.array().or("null").optional(),
});
const commentSchema = type({
  user: optionalUser,
  body: optionalNullableString,
  created_at: optionalNullableString,
});

type ForgejoView = typeof viewSchema.infer;
type ForgejoComment = typeof commentSchema.infer;
type ForgejoBranch = typeof branchSchema.infer;

/** The token `fj auth` saved for the instance, which the CLI keeps in its data
 * directory. */
async function readFjToken(host: string): Promise<string | undefined> {
  const dataDir =
    process.env.FJ_DATA_DIR ??
    join(
      process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
      "forgejo-cli",
    );
  const text = await Result.tryPromise(() =>
    Bun.file(join(dataDir, "keys.json")).text(),
  );
  if (text.isErr()) {
    return undefined;
  }
  const keys = keysSchema(Result.try(() => JSON.parse(text.value)).unwrapOr(0));
  return keys instanceof type.errors ? undefined : keys.hosts[host]?.token;
}

function apiUrl(
  repository: ForgeRepository,
): Result<string, ForgeOperationError> {
  const suffix = `/${repository.fullName}`;
  if (repository.url === null || !repository.url.endsWith(suffix)) {
    return Result.err(
      new ForgeInvalidRequestError({
        kind,
        message: "Forgejo did not report a web URL for this repository",
      }),
    );
  }
  return Result.ok(`${repository.url.slice(0, -suffix.length)}/api/v1`);
}

export class ForgejoService implements Forge {
  public readonly kind = kind;

  constructor(
    private readonly repository: RepositoryLookup,
    private readonly api: ForgeApi,
  ) {}

  public static async initialize(cwd: string, remoteOutput: string) {
    const verified = await verifyCli(kind, executable, cwd);
    const repository = repositoryForRemotes(kind, remoteOutput);
    const api = new ForgeApi(kind, {
      baseUrl: apiUrl,
      token: readFjToken,
      pageQuery: "limit=50",
    });
    return verified.map(() => new ForgejoService(async () => repository, api));
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
            "Forgejo pull request list did not match the schema",
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
          this.api.text(repository, `git/commits/${sha}.diff`, options.signal),
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
    const path = `pulls/${number}`;
    const [view, comments, diff, commits] = await Promise.all([
      this.api.json(
        repository,
        path,
        decoder(
          kind,
          viewSchema,
          "Forgejo pull request response did not match the schema",
        ),
        signal,
      ),
      sectionFrom(
        this.api.pagedJson(
          repository,
          `issues/${number}/comments`,
          decoder(
            kind,
            commentSchema.array(),
            "Forgejo comments response did not match the schema",
          ),
          signal,
        ),
        (payload) => payload.map(normalizeComment),
      ),
      sectionFrom(
        this.api.text(repository, `${path}.diff`, signal),
        (text) => ({ text }),
      ),
      sectionFrom(
        this.api.pagedJson(
          repository,
          `${path}/commits?stat=false&verification=false&files=false`,
          decoder(
            kind,
            commitSchema.array(),
            "Forgejo commits response did not match the schema",
          ),
          signal,
        ),
        (payload) => payload.map(normalizeCommit),
      ),
    ]);

    return {
      details: view.isOk()
        ? available(normalizeDetails(view.value, repository))
        : failed(view.error),
      comments: view.isOk()
        ? withExpectedCommentCount(comments, view.value.comments ?? null)
        : comments,
      diff,
      commits,
      reviews: {
        reviews: unsupported("Forgejo pull request reviews are not loaded"),
        reviewComments: unsupported(
          "Forgejo inline review comments are not loaded",
        ),
        requestedReviewers: view.isOk()
          ? normalizeRequestedReviewers(view.value)
          : failed(view.error),
      },
      checks: unsupported("Forgejo pull request checks are not loaded"),
      development: {
        projects: unsupported(
          "Forgejo pull request projects are not exposed by the API",
        ),
        linkedIssues: unsupported(
          "Forgejo linked issue data is not exposed by the API",
        ),
      },
    };
  }
}

function normalizeDetails(
  payload: ForgejoView,
  repository: ForgeRepository,
): PullRequestDetails {
  return {
    repository,
    number: payload.number,
    body: payload.body ?? null,
    createdAt: payload.created_at ?? null,
    updatedAt: payload.updated_at ?? null,
    mergedAt: payload.merged_at ?? null,
    base: normalizeBranch(payload.base),
    head: normalizeBranch(payload.head),
    additions: payload.additions ?? null,
    deletions: payload.deletions ?? null,
    mergeability: {
      mergeable: payload.mergeable ?? null,
      mergeState: null,
      reviewDecision: null,
    },
  };
}

function normalizeBranch(
  payload: ForgejoBranch | null | undefined,
): PullRequestRef {
  return {
    ref: payload?.ref ?? payload?.label ?? null,
    sha: payload?.sha ?? null,
  };
}

function normalizeRequestedReviewers(
  payload: ForgejoView,
): ForgeSection<PullRequestReviewerRequests> {
  if (
    payload.requested_reviewers === undefined ||
    payload.requested_reviewers_teams === undefined
  ) {
    return unsupported(
      "Forgejo did not include requested reviewer fields in the PR response",
    );
  }
  return available({
    users: normalizeUsers(payload.requested_reviewers),
    teams: normalizeTeams(payload.requested_reviewers_teams),
  });
}

function normalizeComment(payload: ForgejoComment): PullRequestComment {
  return {
    author: normalizeUser(payload.user),
    body: payload.body ?? null,
    createdAt: payload.created_at ?? null,
  };
}
