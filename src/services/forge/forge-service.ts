import { Result } from "better-result";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import {
  invalidRequest,
  validateCommitSha,
  validatePullRequestNumber,
} from "./normalization";
import { ApplicationContext, ForgeInitializationErrorCode } from "./types";
import type {
  CliCheckError,
  ForgeAdapter,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  ForgeSection,
  PullRequestList,
  PullRequestListOptions,
  PullRequestListState,
  PullRequestOverview,
  PullRequestOverviewOptions,
  PullRequestPatch,
  PullRequestResource,
  PullRequestResourceKind,
  PullRequestResourceOptions,
} from "./types";

const resourceKinds: readonly PullRequestResourceKind[] = [
  "details",
  "diff",
  "commits",
  "reviews",
  "checks",
  "development",
];

export class ForgeService {
  private constructor(private readonly adapter: ForgeAdapter) {}

  public get kind(): ForgeKind {
    return this.adapter.kind;
  }

  public static async initialize(
    kind: ForgeKind,
    cwd = process.cwd(),
  ): Promise<Result<ForgeService, ForgeInitializationError>> {
    if (kind === ApplicationContext.GitHub) {
      return (await GithubService.initialize(cwd))
        .map((adapter) => new ForgeService(adapter))
        .mapError((error) => normalizeInitializationError(kind, error));
    }

    return (await ForgejoService.initialize(cwd))
      .map((adapter) => new ForgeService(adapter))
      .mapError((error) => normalizeInitializationError(kind, error));
  }

  public getPullRequests(
    options?: PullRequestListOptions,
  ): Promise<Result<PullRequestList, ForgeOperationError>> {
    const { kind, adapter } = this;

    return Result.gen(async function* () {
      const limit = options?.limit;
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) {
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
    });
  }

  public getPullRequestOverview(
    number: number,
    options?: PullRequestOverviewOptions,
  ): Promise<Result<PullRequestOverview, ForgeOperationError>> {
    return Result.andThenAsync(
      validatePullRequestNumber(this.kind, number),
      (value) => this.adapter.getPullRequestOverview(value, options),
    );
  }

  public getPullRequestResource(
    number: number,
    resourceKind: PullRequestResourceKind,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestResource, ForgeOperationError>> {
    const { kind, adapter } = this;

    return Result.gen(async function* () {
      const value = yield* validatePullRequestNumber(kind, number);
      if (!resourceKinds.includes(resourceKind)) {
        yield* invalidRequest<PullRequestResource>(
          kind,
          `Unknown pull request resource: ${resourceKind}`,
        );
      }

      const resource = yield* Result.await(
        adapter.getPullRequestResource(value, resourceKind, options),
      );
      return Result.ok(resource);
    });
  }

  public getCommitPatch(
    sha: string,
    options?: PullRequestResourceOptions,
  ): Promise<Result<ForgeSection<PullRequestPatch>, ForgeOperationError>> {
    const { kind, adapter } = this;

    return Result.gen(async function* () {
      const value = yield* validateCommitSha(kind, sha);
      const patch = yield* Result.await(adapter.getCommitPatch(value, options));
      return Result.ok(patch);
    });
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

function normalizeInitializationError(
  kind: ForgeKind,
  error: CliCheckError,
): ForgeInitializationError {
  switch (error.code) {
    case ForgeInitializationErrorCode.ExecutableUnavailable:
      return { kind, code: ForgeInitializationErrorCode.ExecutableUnavailable };
    case ForgeInitializationErrorCode.VersionCheckFailed:
      return {
        kind,
        code: ForgeInitializationErrorCode.VersionCheckFailed,
        exitCode: error.exitCode,
      };
  }
}
