import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { checkCli } from "./cli-check";
import { executeCli } from "./cli-execution";
import {
  isInteger,
  isJsonObject,
  isNullableString,
  isStableProviderId,
  isString,
  toIsoTimestamp,
} from "./json-validation";
import type {
  ForgeAdapter,
  ForgeAuthor,
  ForgeOperationError,
  PullRequest,
  PullRequestComment,
  PullRequestState,
} from "./types";

const executableName = "gh";
const kind = "github" as const;

interface GithubPullRequestPayload {
  readonly number?: unknown;
  readonly title?: unknown;
  readonly body?: unknown;
  readonly state?: unknown;
  readonly author?: unknown;
  readonly mergedAt?: unknown;
}

interface GithubCommentsPayload {
  readonly comments?: unknown;
}

interface GithubCommentPayload {
  readonly id?: unknown;
  readonly author?: unknown;
  readonly body?: unknown;
  readonly createdAt?: unknown;
}

interface GithubAuthorPayload {
  readonly login?: unknown;
}

export class GithubService implements ForgeAdapter {
  public readonly kind = kind;

  private constructor(private readonly cwd: string) {}

  public static async initialize(cwd = process.cwd()) {
    return (await checkCli(kind, executableName, ["--version"], cwd)).map(
      () => new GithubService(cwd),
    );
  }

  public async getPullRequest(
    number: number,
  ): Promise<ResultType<PullRequest, ForgeOperationError>> {
    const execution = await executeCli(
      kind,
      executableName,
      [
        "pr",
        "view",
        String(number),
        "--json",
        "number,title,body,state,author,mergedAt",
      ],
      this.cwd,
    );

    return execution.andThen((output) =>
      decodeJson(output, normalizePullRequest),
    );
  }

  public async getPullRequestComments(
    number: number,
  ): Promise<ResultType<readonly PullRequestComment[], ForgeOperationError>> {
    const execution = await executeCli(
      kind,
      executableName,
      ["pr", "view", String(number), "--json", "comments"],
      this.cwd,
    );

    return execution.andThen((output) => decodeJson(output, normalizeComments));
  }
}

type GithubDecoder<T> = (cause: unknown) => ResultType<T, ForgeOperationError>;

function decodeJson<T>(
  output: string,
  decoder: GithubDecoder<T>,
): ResultType<T, ForgeOperationError> {
  const parsed = Result.try({
    try: () => {
      const value: unknown = JSON.parse(output);
      return value;
    },
    catch: (cause) => ({
      kind,
      code: "invalid-json" as const,
      diagnostic:
        cause instanceof Error ? cause.message : "CLI returned malformed JSON",
    }),
  });

  return parsed.andThen(decoder);
}

function normalizePullRequest(
  cause: unknown,
): ResultType<PullRequest, ForgeOperationError> {
  if (!isPullRequestPayload(cause)) {
    return incompatible("Expected a pull request object");
  }

  const author = normalizeAuthor(cause.author);
  const state = normalizeState(cause);
  if (
    !isInteger(cause.number) ||
    !isString(cause.title) ||
    !isNullableString(cause.body) ||
    author === undefined ||
    state === undefined
  ) {
    return incompatible("Pull request fields did not match the GitHub schema");
  }

  return Result.ok({
    number: cause.number,
    title: cause.title,
    body: cause.body,
    state,
    author,
  });
}

function normalizeComments(
  cause: unknown,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  if (!isCommentsPayload(cause) || !Array.isArray(cause.comments)) {
    return incompatible("Expected an object containing a comments array");
  }

  const comments: PullRequestComment[] = [];
  for (const candidate of cause.comments) {
    const comment = normalizeComment(candidate);
    if (comment.isErr()) {
      return comment;
    }
    comments.push(comment.value);
  }

  return Result.ok(comments);
}

function normalizeComment(
  cause: unknown,
): ResultType<PullRequestComment, ForgeOperationError> {
  if (!isCommentPayload(cause)) {
    return incompatible("Expected each comment to be an object");
  }

  const author = normalizeAuthor(cause.author);
  const createdAt = toIsoTimestamp(cause.createdAt);
  if (
    !isStableProviderId(cause.id) ||
    author === undefined ||
    !isNullableString(cause.body) ||
    createdAt === undefined
  ) {
    return incompatible("Comment fields did not match the GitHub schema");
  }

  return Result.ok({
    id: String(cause.id),
    author,
    body: cause.body,
    createdAt,
  });
}

function normalizeState(
  payload: GithubPullRequestPayload,
): PullRequestState | undefined {
  if (!isNullableString(payload.mergedAt)) {
    return undefined;
  }
  if (payload.state === "MERGED" || isString(payload.mergedAt)) {
    return "merged";
  }
  if (payload.state === "OPEN") {
    return "open";
  }
  return payload.state === "CLOSED" ? "closed" : undefined;
}

function normalizeAuthor(cause: unknown): ForgeAuthor | null | undefined {
  if (cause === null || cause === undefined) {
    return null;
  }
  if (!isAuthorPayload(cause) || !isString(cause.login)) {
    return undefined;
  }
  return { login: cause.login };
}

function isPullRequestPayload(
  cause: unknown,
): cause is GithubPullRequestPayload {
  return isJsonObject(cause);
}

function isCommentsPayload(cause: unknown): cause is GithubCommentsPayload {
  return isJsonObject(cause);
}

function isCommentPayload(cause: unknown): cause is GithubCommentPayload {
  return isJsonObject(cause);
}

function isAuthorPayload(cause: unknown): cause is GithubAuthorPayload {
  return isJsonObject(cause);
}

function incompatible<T>(
  diagnostic: string,
): ResultType<T, ForgeOperationError> {
  return Result.err({ kind, code: "incompatible-response", diagnostic });
}
