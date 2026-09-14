import {
  ApplicationContext,
  ForgeOperationErrorCode,
  PullRequestState,
} from "./types";
import type {
  ForgeAdapter,
  ForgeAuthor,
  ForgeOperationError,
  PullRequest,
  PullRequestComment,
} from "./types";
import type { Result as ResultType } from "better-result";
import { type } from "arktype";
import { Result } from "better-result";
import { checkCli } from "./cli-check";
import { decodeJson, executeCli } from "./cli-execution";

const executableName = "fj";
const kind = ApplicationContext.Forgejo;

const userSchema = type({ login: "string" });
const safeIntegerSchema = type("number.integer & number.safe");
const pullRequestSchema = type({
  number: safeIntegerSchema,
  title: "string",
  body: "string | null",
  state: "'open' | 'closed'",
  merged: "boolean",
  user: userSchema.or("null").optional(),
});
const commentSchema = type({
  id: safeIntegerSchema,
  user: userSchema.or("null").optional(),
  body: "string | null",
  created_at: "string.date.parse",
});
const commentsSchema = commentSchema.array();

type ForgejoAuthor = typeof userSchema.infer;
type ForgejoPullRequest = typeof pullRequestSchema.infer;
type ForgejoComment = typeof commentSchema.infer;

export class ForgejoService implements ForgeAdapter {
  public readonly kind = kind;

  public static async initialize(cwd: string) {
    const availability = await checkCli(
      kind,
      executableName,
      ["--version"],
      cwd,
    );
    return availability.map(() => new ForgejoService(cwd));
  }

  public getPullRequest(
    number: number,
  ): Promise<ResultType<PullRequest, ForgeOperationError>> {
    return this.executeJson(
      ["--json", "pr", "view", String(number)],
      normalizePullRequest,
    );
  }

  public getPullRequestComments(
    number: number,
  ): Promise<ResultType<readonly PullRequestComment[], ForgeOperationError>> {
    return this.executeJson(
      ["--json", "pr", "view", String(number), "comments"],
      normalizeComments,
    );
  }

  private async executeJson<T>(
    args: readonly string[],
    decoder: (cause: unknown) => ResultType<T, ForgeOperationError>,
  ): Promise<ResultType<T, ForgeOperationError>> {
    const execution = await executeCli(
      this.kind,
      executableName,
      args,
      this.cwd,
    );
    return execution.andThen(decodeJson(kind, decoder));
  }

  private constructor(private readonly cwd: string) {}
}

function normalizePullRequest(
  cause: unknown,
): ResultType<PullRequest, ForgeOperationError> {
  const payload = pullRequestSchema(cause);
  if (!(payload instanceof type.errors)) {
    const { number, title, body, user } = payload;
    return Result.ok({
      number,
      title,
      body,
      state: normalizeState(payload),
      author: normalizeAuthor(user),
    });
  }

  const diagnostic = `Forgejo pull request response did not match the schema: ${payload.summary}`;
  return Result.err({
    kind,
    code: ForgeOperationErrorCode.IncompatibleResponse,
    diagnostic,
  });
}

function normalizeComments(
  cause: unknown,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  const payload = commentsSchema(cause);
  if (!(payload instanceof type.errors)) {
    return Result.ok(payload.map(normalizeComment));
  }

  const diagnostic = `Forgejo comments response did not match the schema: ${payload.summary}`;
  return Result.err({
    kind,
    code: ForgeOperationErrorCode.IncompatibleResponse,
    diagnostic,
  });
}

function normalizeComment(payload: ForgejoComment): PullRequestComment {
  const { id, user, body, created_at } = payload;
  return {
    id: String(id),
    author: normalizeAuthor(user),
    body,
    createdAt: created_at.toISOString(),
  };
}

function normalizeState(payload: ForgejoPullRequest): PullRequestState {
  if (payload.merged) {
    return PullRequestState.Merged;
  }
  return payload.state === "open"
    ? PullRequestState.Open
    : PullRequestState.Closed;
}

function normalizeAuthor(
  cause: ForgejoAuthor | null | undefined,
): ForgeAuthor | null {
  if (!cause) {
    return null;
  }
  return { login: cause.login };
}
