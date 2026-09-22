import { Result } from "better-result";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import {
  invalidRequest,
  validateCommitSha,
  validatePullRequestNumber,
} from "./normalization";
import { ApplicationContext, ForgeUnexpectedError } from "./types";

import type { Result as ResultType } from "better-result";
import type {
  ForgeAdapter,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  ForgeSection,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestDetails,
  PullRequestDevelopment,
  PullRequestDocument,
  PullRequestList,
  PullRequestListOptions,
  PullRequestListState,
  PullRequestOverview,
  PullRequestOverviewOptions,
  PullRequestPatch,
  PullRequestResourceOptions,
  PullRequestReviewsResource,
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

  /** Validates the pull request number and runs one adapter operation inside
   * the never-rejecting service guard. */
  private async fetchResource<T>(
    number: number,
    _options: PullRequestResourceOptions | undefined,
    fetch: (value: number) => Promise<ResultType<T, ForgeOperationError>>,
  ): Promise<ResultType<T, ForgeOperationError>> {
    return guard(
      this.kind,
      Result.andThenAsync(validatePullRequestNumber(this.kind, number), fetch),
    );
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
    const { kind, adapter } = this;

    return guard(
      kind,
      Result.gen(async function* () {
        const limit = options?.limit;
        if (
          limit !== undefined &&
          (!Number.isSafeInteger(limit) || limit <= 0)
        ) {
          yield* invalidRequest<PullRequestList>(
            kind,
            "Pull request list limit must be a positive safe integer",
          );
        }
        if (!isPullRequestListState(options?.state)) {
          yield* invalidRequest<PullRequestList>(
            kind,
            "Pull request list state must be open, closed, or all",
          );
        }

        const pullRequests = yield* Result.await(
          adapter.getPullRequests(options),
        );
        return Result.ok(pullRequests);
      }),
    );
  }

  public async loadPullRequest(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDocument, ForgeOperationError>> {
    return this.fetchResource(number, options, (value) =>
      this.adapter.loadPullRequest(value, options),
    );
  }

  public async getPullRequestOverview(
    number: number,
    options?: PullRequestOverviewOptions,
  ): Promise<Result<PullRequestOverview, ForgeOperationError>> {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestOverview(value, options),
    );
  }

  public async getPullRequestDetails(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDetails, ForgeOperationError>> {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestDetails(value, options),
    );
  }

  public async getPullRequestDiff(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestDiff(value, options),
    );
  }

  public async getPullRequestCommits(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<
    Result<ForgeSection<readonly PullRequestCommit[]>, ForgeOperationError>
  > {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestCommits(value, options),
    );
  }

  public async getPullRequestReviews(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestReviewsResource, ForgeOperationError>> {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestReviews(value, options),
    );
  }

  public async getPullRequestChecks(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<
    Result<ForgeSection<readonly PullRequestCheck[]>, ForgeOperationError>
  > {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestChecks(value, options),
    );
  }

  public async getPullRequestDevelopment(
    number: number,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestDevelopment, ForgeOperationError>> {
    return this.fetchResource(number, options, (value) =>
      this.adapter.getPullRequestDevelopment(value, options),
    );
  }

  public async getCommitPatch(
    sha: string,
    options?: PullRequestResourceOptions,
  ): Promise<Result<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    const { kind, adapter } = this;

    return guard(
      kind,
      Result.gen(async function* () {
        const value = yield* validateCommitSha(kind, sha);
        const patch = yield* Result.await(
          adapter.getCommitPatch(value, options),
        );
        return Result.ok(patch);
      }),
    );
  }
}

function isPullRequestListState(
  value: PullRequestListState | undefined,
): value is PullRequestListState | undefined {
  return (
    value === undefined ||
    value === "open" ||
    value === "closed" ||
    value === "all"
  );
}
