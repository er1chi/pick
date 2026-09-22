import { Result } from "better-result";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import {
  ApplicationContext,
  ForgeInvalidRequestError,
  ForgeUnexpectedError,
} from "./types";

import type { Result as ResultType } from "better-result";
import type {
  ForgeAdapter,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  ForgeSection,
  PullRequestDocument,
  PullRequestList,
  PullRequestListOptions,
  PullRequestPatch,
  PullRequestResourceOptions,
} from "./types";

/** The service boundary never rejects: an operation that throws unexpectedly
 * is reported as a failed `Result`, so callers never need a rejection handler. */
async function guard<T>(
  kind: ForgeKind,
  operation: Promise<ResultType<T, ForgeOperationError>>,
): Promise<ResultType<T, ForgeOperationError>> {
  return operation.catch(
    (cause: unknown): ResultType<T, ForgeOperationError> =>
      Result.err(
        new ForgeUnexpectedError({
          kind,
          cause,
          message:
            cause instanceof Error ? cause.message : "Unexpected failure",
        }),
      ),
  );
}

export class ForgeService {
  private constructor(private readonly adapter: ForgeAdapter) {}

  public get kind(): ForgeKind {
    return this.adapter.kind;
  }

  public static async initialize(
    kind: ForgeKind,
    cwd = process.cwd(),
  ): Promise<Result<ForgeService, ForgeInitializationError>> {
    const initialize =
      kind === ApplicationContext.GitHub
        ? GithubService.initialize(cwd)
        : ForgejoService.initialize(cwd);

    const initialized = await initialize;
    if (initialized.isErr()) {
      return initialized;
    }
    return Result.ok(new ForgeService(initialized.value));
  }

  public async getPullRequests(
    options?: PullRequestListOptions,
  ): Promise<Result<PullRequestList, ForgeOperationError>> {
    return guard(
      this.kind,
      Result.andThenAsync(validateListOptions(this.kind, options), (value) =>
        this.adapter.getPullRequests(value),
      ),
    );
  }

  public async loadPullRequest(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDocument, ForgeOperationError>> {
    return guard(
      this.kind,
      Result.andThenAsync(
        validatePullRequestNumber(this.kind, number),
        (value) => this.adapter.loadPullRequest(value, options),
      ),
    );
  }

  public async getCommitPatch(
    sha: string,
    options?: PullRequestResourceOptions,
  ): Promise<Result<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return guard(
      this.kind,
      Result.andThenAsync(validateCommitSha(this.kind, sha), (value) =>
        this.adapter.getCommitPatch(value, options),
      ),
    );
  }
}

function invalidRequest<T>(
  kind: ForgeKind,
  message: string,
): Result<T, ForgeOperationError> {
  return Result.err(new ForgeInvalidRequestError({ kind, message }));
}

function validateListOptions(
  kind: ForgeKind,
  options: PullRequestListOptions | undefined,
): Result<PullRequestListOptions | undefined, ForgeOperationError> {
  const limit = options?.limit;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) {
    return invalidRequest(
      kind,
      "Pull request list limit must be a positive safe integer",
    );
  }
  return Result.ok(options);
}

function validateCommitSha(
  kind: ForgeKind,
  sha: string,
): Result<string, ForgeOperationError> {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    return invalidRequest(
      kind,
      "Commit SHA must be 7 to 40 hexadecimal characters",
    );
  }
  return Result.ok(sha);
}

function validatePullRequestNumber(
  kind: ForgeKind,
  number: number,
): Result<number, ForgeOperationError> {
  if (!Number.isSafeInteger(number) || number <= 0) {
    return invalidRequest(
      kind,
      "Pull request number must be a positive safe integer",
    );
  }
  return Result.ok(number);
}
