import type {
  ForgeAdapter,
  ForgeAuthor,
  ForgeOperationError,
  PullRequest,
  PullRequestComment,
  PullRequestState,
} from "./types";
import type { Result as ResultType } from "better-result";
import { type } from "arktype";
import { Result } from "better-result";
import { checkCli } from "./cli-check";
import { executeCli } from "./cli-execution";

const executableName = "fj";
const kind = "forgejo" as const;

const userSchema = type({ login: "string" });
const pullRequestSchema = type({
  number: type("number.integer"),
  title: "string",
  body: "string | null",
  state: "'open' | 'closed'",
  merged: "boolean",
  user: userSchema.or("null").optional(),
});
const commentSchema = type({
  id: type("string | (number.integer & number.safe)"),
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
    ).andThen((output) => decodeJson(output, normalizePullRequest));
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
    ).andThen((output) => decodeJson(output, normalizeComments));
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
    code: "incompatible-response",
    diagnostic,
  });
}

function normalizeComments(
  cause: unknown,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  const payload = commentsSchema(cause);
  if (!(payload instanceof type.errors)) {
    return Result.ok(payload.map((comment) => normalizeComment(comment)));
  }

  const diagnostic = `Forgejo comments response did not match the schema: ${payload.summary}`;
  return Result.err({
    kind,
    code: "incompatible-response",
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
    return "merged";
  }
  return payload.state === "open" ? "open" : "closed";
}

function normalizeAuthor(
  cause: ForgejoAuthor | null | undefined,
): ForgeAuthor | null {
  if (!cause) {
    return null;
  }
  return { login: cause.login };
}
