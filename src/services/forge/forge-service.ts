import type { Result } from "better-result";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import type {
  CliCheckError,
  ForgeAdapter,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  PullRequest,
  PullRequestComment,
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
    if (kind === "github") {
      return (await GithubService.initialize(cwd))
        .map((adapter) => new ForgeService(adapter))
        .mapError((error) => normalizeInitializationError(kind, error));
    }

    return (await ForgejoService.initialize(cwd))
      .map((adapter) => new ForgeService(adapter))
      .mapError((error) => normalizeInitializationError(kind, error));
  }

  public getPullRequest(
    number: number,
  ): Promise<Result<PullRequest, ForgeOperationError>> {
    return this.adapter.getPullRequest(number);
  }

  public getPullRequestComments(
    number: number,
  ): Promise<Result<readonly PullRequestComment[], ForgeOperationError>> {
    return this.adapter.getPullRequestComments(number);
  }
}

function normalizeInitializationError(
  kind: ForgeKind,
  error: CliCheckError,
): ForgeInitializationError {
  switch (error.code) {
    case "executable-unavailable":
      return { kind, code: "executable-unavailable" };
    case "version-check-failed":
      return { kind, code: "version-check-failed", exitCode: error.exitCode };
  }
}
