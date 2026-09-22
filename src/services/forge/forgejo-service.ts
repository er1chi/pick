import { type } from "arktype";
import { Result } from "better-result";
import { ForgeCli } from "./forge-cli";
import {
  matchPullRequestNumber,
  normalizeRepository,
  normalizeState,
  normalizeTeams,
  normalizeUser,
  normalizeUsers,
  withExpectedCommentCount,
} from "./normalization";
import { requestPullRequest, requestPullRequestList } from "./requests";
import {
  optionalBoolean,
  optionalNullableString,
  optionalNumber,
  optionalUser,
  safeIntegerSchema,
  teamSchema,
  userSchema,
} from "./schema-primitives";
import { available, failed, unsupported } from "./section";
import { ForgeKind } from "./types";

import type { Result as ResultType } from "better-result";
import type { CliRunner } from "./forge-cli";
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
  PullRequestSummary,
} from "./types";

const executable = "fj";
const kind = ForgeKind.Forgejo;

const repositorySchema = type({
  full_name: "string",
  html_url: optionalNullableString,
});
const branchSchema = type({
  label: optionalNullableString,
  ref: optionalNullableString,
  sha: optionalNullableString,
});
const issueSchema = type({
  number: safeIntegerSchema,
  title: "string",
  state: "string",
  user: optionalUser,
  pull_request: type({
    draft: optionalBoolean,
    merged: optionalBoolean,
  })
    .or("null")
    .optional(),
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
type ForgejoIssue = typeof issueSchema.infer;
type ForgejoComment = typeof commentSchema.infer;
type ForgejoBranch = typeof branchSchema.infer;

export class ForgejoService implements Forge {
  public readonly kind = kind;
  private readonly repository: RepositoryLookup;

  constructor(private readonly cli: ForgeCli) {
    this.repository = cli.cachedJson(["--json", "repo", "view"], (cause) =>
      cli
        .parse(
          repositorySchema,
          cause,
          "Forgejo repository response did not match the schema",
        )
        .andThen((payload) =>
          normalizeRepository(kind, payload.full_name, payload.html_url),
        ),
    );
  }

  public static async initialize(cwd: string, run?: CliRunner) {
    const initialized = await ForgeCli.initialize(kind, executable, cwd, run);
    return initialized.map((cli) => new ForgejoService(cli));
  }

  /** `fj pr search` has no limit flag and always fetches every page, so the
   * limit is applied to the full result. */
  public async getPullRequests(
    options: PullRequestListOptions = {},
  ): Promise<ResultType<PullRequestList, ForgeOperationError>> {
    return requestPullRequestList(
      kind,
      this.repository,
      options,
      (repository, { state }) =>
        this.cli.json(
          [
            "--json",
            "pr",
            "search",
            "--state",
            state,
            "--repo",
            repository.fullName,
          ],
          (cause) =>
            this.cli
              .parse(
                issueSchema.array(),
                cause,
                "Forgejo pull request list did not match the schema",
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
    _sha: string,
    _options: PullRequestResourceOptions = {},
  ): Promise<ResultType<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return Result.ok(
      unsupported("The Forgejo CLI does not expose a diff for a single commit"),
    );
  }

  private async loadDocument(
    number: number,
    repository: ForgeRepository,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestDocument> {
    const pullRequest = ["pr", "view", String(number), "--repo"];
    const [view, comments, diff] = await Promise.all([
      this.cli.json(
        ["--json", ...pullRequest, repository.fullName],
        (cause) =>
          this.cli
            .parse(
              viewSchema,
              cause,
              "Forgejo pull request response did not match the schema",
            )
            .andThen((payload) =>
              matchPullRequestNumber(kind, payload, number),
            ),
        signal,
      ),
      this.cli.section(
        ["--json", ...pullRequest, repository.fullName, "comments"],
        commentSchema.array(),
        (payload) => payload.map(normalizeComment),
        "Forgejo comments response did not match the schema",
        signal,
      ),
      this.cli.patch([...pullRequest, repository.fullName, "diff"], signal),
    ]);

    return {
      details: view.isOk()
        ? available(normalizeDetails(view.value, repository))
        : failed(view.error),
      comments: view.isOk()
        ? withExpectedCommentCount(comments, view.value.comments ?? null)
        : comments,
      diff,
      commits: unsupported(
        "The Forgejo CLI prints pull request commits only as human-readable output",
      ),
      reviews: {
        reviews: unsupported(
          "The Forgejo CLI does not expose submitted pull request reviews",
        ),
        reviewComments: unsupported(
          "The Forgejo CLI does not expose inline review comments",
        ),
        requestedReviewers: view.isOk()
          ? normalizeRequestedReviewers(view.value)
          : failed(view.error),
      },
      checks: unsupported(
        "The Forgejo CLI prints pull request status only as human-readable output",
      ),
      development: {
        projects: unsupported(
          "Forgejo pull request projects are not exposed by the CLI",
        ),
        linkedIssues: unsupported(
          "Forgejo linked issue data is not exposed by the CLI",
        ),
      },
    };
  }
}

function normalizeSummary(payload: ForgejoIssue): PullRequestSummary {
  const pullRequest = payload.pull_request;
  return {
    number: payload.number,
    title: payload.title,
    state: normalizeState(payload.state, pullRequest?.merged === true),
    isDraft: pullRequest?.draft ?? null,
    author: normalizeUser(payload.user),
  };
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
