import type { Result } from "better-result";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import { invalidRequest, validatePullRequestNumber } from "./normalization";
import { ApplicationContext, ForgeInitializationErrorCode } from "./types";
import type {
  CliCheckError,
  ForgeAdapter,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  PullRequestList,
  PullRequestListOptions,
  PullRequestListState,
  PullRequestOverview,
  PullRequestOverviewOptions,
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
    const limit = options?.limit;
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) {
      return Promise.resolve(
        invalidRequest(
          this.kind,
          "Pull request list limit must be a positive safe integer",
        ),
      );
    }
    if (!isPullRequestListState(options?.state)) {
      return Promise.resolve(
        invalidRequest(
          this.kind,
          "Pull request list state must be open, closed, or all",
        ),
      );
    }

    return this.adapter.getPullRequests(options);
  }

  public getPullRequestOverview(
    number: number,
    options?: PullRequestOverviewOptions,
  ): Promise<Result<PullRequestOverview, ForgeOperationError>> {
    const validation = validatePullRequestNumber(this.kind, number);
    if (validation.isErr()) {
      return Promise.resolve(validation);
    }

    return this.adapter.getPullRequestOverview(validation.value, options);
  }

  public getPullRequestResource(
    number: number,
    resourceKind: PullRequestResourceKind,
    options?: PullRequestResourceOptions,
  ): Promise<Result<PullRequestResource, ForgeOperationError>> {
    const validation = validatePullRequestNumber(this.kind, number);
    if (validation.isErr()) {
      return Promise.resolve(validation);
    }
    if (!resourceKinds.includes(resourceKind)) {
      return Promise.resolve(
        invalidRequest(
          this.kind,
          `Unknown pull request resource: ${resourceKind}`,
        ),
      );
    }

    return this.adapter.getPullRequestResource(
      validation.value,
      resourceKind,
      options,
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
