import { type } from "arktype";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { checkCli } from "./cli-check";
import { executeCli } from "./cli-execution";
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

const authorSchema = type({ login: "string" });
const providerIdSchema = type("string | (number.integer & number.safe)");
const pullRequestSchema = type({
  number: "number.integer",
  title: "string",
  body: "string | null",
  state: "'OPEN' | 'CLOSED' | 'MERGED'",
  author: authorSchema.or("null").optional(),
  mergedAt: "string | null",
});
const commentSchema = type({
  id: providerIdSchema,
  author: authorSchema.or("null").optional(),
  body: "string | null",
  createdAt: "string.date.parse",
});
const commentsSchema = type({ comments: commentSchema.array() });

type GithubAuthor = typeof authorSchema.infer;
type GithubPullRequest = typeof pullRequestSchema.infer;
type GithubComment = typeof commentSchema.infer;

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

  return parsed.andThen((value) => decoder(value));
}

function normalizePullRequest(
  cause: unknown,
): ResultType<PullRequest, ForgeOperationError> {
  const payload = pullRequestSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      `GitHub pull request response did not match the schema: ${payload.summary}`,
    );
  }

  return Result.ok({
    number: payload.number,
    title: payload.title,
    body: payload.body,
    state: normalizeState(payload),
    author: normalizeAuthor(payload.author),
  });
}

function normalizeComments(
  cause: unknown,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  const payload = commentsSchema(cause);
  if (payload instanceof type.errors) {
    return incompatible(
      `GitHub comments response did not match the schema: ${payload.summary}`,
    );
  }

  return Result.ok(payload.comments.map(normalizeComment));
}

function normalizeComment(payload: GithubComment): PullRequestComment {
  return {
    id: String(payload.id),
    author: normalizeAuthor(payload.author),
    body: payload.body,
    createdAt: payload.createdAt.toISOString(),
  };
}

function normalizeState(payload: GithubPullRequest): PullRequestState {
  if (payload.state === "MERGED" || payload.mergedAt !== null) {
    return "merged";
  }
  return payload.state === "OPEN" ? "open" : "closed";
}

function normalizeAuthor(
  cause: GithubAuthor | null | undefined,
): ForgeAuthor | null {
  return cause === null || cause === undefined ? null : { login: cause.login };
}

function incompatible<T>(
  diagnostic: string,
): ResultType<T, ForgeOperationError> {
  return Result.err({ kind, code: "incompatible-response", diagnostic });
}
