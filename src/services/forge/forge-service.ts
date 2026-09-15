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
  PullRequestDetails,
  PullRequestDetailsOptions,
  PullRequestList,
  PullRequestListOptions,
} from "./types";

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

    return this.adapter.getPullRequests(options);
  }

  public getPullRequestDetails(
    number: number,
    options?: PullRequestDetailsOptions,
  ): Promise<Result<PullRequestDetails, ForgeOperationError>> {
    const validation = validatePullRequestNumber(this.kind, number);
    if (validation.isErr()) {
      return Promise.resolve(validation);
    }

    return this.adapter.getPullRequestDetails(validation.value, options);
  }
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
