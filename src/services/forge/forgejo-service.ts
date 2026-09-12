import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { checkCli } from "./cli-check";
import { executeCli } from "./cli-execution";
import * as Json from "./json-validation";
import type {
  ForgeAdapter,
  ForgeAuthor,
  ForgeOperationError,
  PullRequest,
  PullRequestComment,
  PullRequestState,
} from "./types";

const executableName = "fj";
const kind = "forgejo" as const;

interface ForgejoPullRequestPayload {
  readonly number?: unknown;
  readonly title?: unknown;
  readonly body?: unknown;
  readonly state?: unknown;
  readonly merged?: unknown;
  readonly user?: unknown;
}

interface ForgejoCommentPayload {
  readonly id?: unknown;
  readonly user?: unknown;
  readonly body?: unknown;
  readonly created_at?: unknown;
}

interface ForgejoUserPayload {
  readonly login?: unknown;
}

export class ForgejoService implements ForgeAdapter {
  public readonly kind = kind;

  public static async initialize(cwd = process.cwd()) {
    const availability = await checkCli(
      kind,
      executableName,
      ["--version"],
      cwd,
    );
    return availability.map(() => new ForgejoService(cwd));
  }

  public async getPullRequest(
    number: number,
  ): Promise<ResultType<PullRequest, ForgeOperationError>> {
    return (
      await executeCli(
        kind,
        executableName,
        ["--json", "pr", "view", String(number)],
        this.cwd,
      )
    ).andThen((output) => decodeJson(output, toPullRequest));
  }

  public async getPullRequestComments(
    number: number,
  ): Promise<ResultType<readonly PullRequestComment[], ForgeOperationError>> {
    return (
      await executeCli(
        kind,
        executableName,
        ["--json", "pr", "view", String(number), "comments"],
        this.cwd,
      )
    ).andThen((output) => decodeJson(output, toComments));
  }

  private constructor(private readonly cwd: string) {}
}

function decodeJson<T>(
  output: string,
  decoder: (cause: unknown) => ResultType<T, ForgeOperationError>,
): ResultType<T, ForgeOperationError> {
  const providerJson = Result.try({
    try: () => {
      const untrustedProviderValue: unknown = JSON.parse(output);
      return untrustedProviderValue;
    },
    catch: (cause) => {
      const diagnostic =
        cause instanceof Error ? cause.message : "CLI returned malformed JSON";
      return { kind, code: "invalid-json" as const, diagnostic };
    },
  });

  return providerJson.andThen(decoder);
}

function toPullRequest(
  cause: unknown,
): ResultType<PullRequest, ForgeOperationError> {
  if (!isPullRequestPayload(cause)) {
    return schemaError("Expected a pull request object");
  }

  const author = toAuthor(cause.user);
  const state = toState(cause);
  if (
    !Json.isInteger(cause.number) ||
    !Json.isString(cause.title) ||
    !Json.isNullableString(cause.body) ||
    author === undefined ||
    state === undefined
  ) {
    return schemaError("Pull request fields did not match the Forgejo schema");
  }

  const pullRequest: PullRequest = {
    number: cause.number,
    title: cause.title,
    body: cause.body,
    state,
    author,
  };
  return Result.ok(pullRequest);
}

function toComments(
  cause: unknown,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  if (!Array.isArray(cause)) {
    return schemaError("Expected a comments array");
  }

  const comments: PullRequestComment[] = [];
  for (const item of cause) {
    const normalized = toComment(item);
    if (normalized.isErr()) {
      return normalized;
    }
    comments.push(normalized.value);
  }

  return Result.ok(comments);
}

function toComment(
  cause: unknown,
): ResultType<PullRequestComment, ForgeOperationError> {
  if (!isCommentPayload(cause)) {
    return schemaError("Expected each comment to be an object");
  }

  const author = toAuthor(cause.user);
  const createdAt = Json.toIsoTimestamp(cause.created_at);
  if (
    !Json.isStableProviderId(cause.id) ||
    author === undefined ||
    !Json.isNullableString(cause.body) ||
    createdAt === undefined
  ) {
    return schemaError("Comment fields did not match the Forgejo schema");
  }

  return Result.ok({
    id: String(cause.id),
    author,
    body: cause.body,
    createdAt,
  });
}

function toState(
  payload: ForgejoPullRequestPayload,
): PullRequestState | undefined {
  if (payload.merged === true) {
    return "merged";
  }
  if (payload.merged !== false) {
    return undefined;
  }
  if (payload.state === "open") {
    return "open";
  }
  return payload.state === "closed" ? "closed" : undefined;
}

function toAuthor(cause: unknown): ForgeAuthor | null | undefined {
  if (cause === null || cause === undefined) {
    return null;
  }
  if (!isUserPayload(cause) || !Json.isString(cause.login)) {
    return undefined;
  }
  return { login: cause.login };
}

function isPullRequestPayload(
  cause: unknown,
): cause is ForgejoPullRequestPayload {
  return Json.isJsonObject(cause);
}

function isCommentPayload(cause: unknown): cause is ForgejoCommentPayload {
  return Json.isJsonObject(cause);
}

function isUserPayload(cause: unknown): cause is ForgejoUserPayload {
  return Json.isJsonObject(cause);
}

function schemaError<T>(
  diagnostic: string,
): ResultType<T, ForgeOperationError> {
  return Result.err({ kind, code: "incompatible-response", diagnostic });
}
