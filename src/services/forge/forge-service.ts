import type { Result } from "better-result";
import type { CliCheckError } from "./cli-check";
import { ForgejoService } from "./forgejo-service";
import { GithubService } from "./github-service";
import type {
  ForgeAdapter,
  ForgeInitializationError,
  ForgeKind,
} from "./types";

export class ForgeService {
  private constructor(private readonly adapter: ForgeAdapter) {}

  public get kind(): ForgeKind {
    return this.adapter.kind;
  }

  public static async initialize(
    kind: ForgeKind,
  ): Promise<Result<ForgeService, ForgeInitializationError>> {
    if (kind === "github") {
      return (await GithubService.initialize())
        .map((adapter) => new ForgeService(adapter))
        .mapError((error) => normalizeInitializationError(kind, error));
    }

    return (await ForgejoService.initialize())
      .map((adapter) => new ForgeService(adapter))
      .mapError((error) => normalizeInitializationError(kind, error));
  }
}

function normalizeInitializationError(
  kind: ForgeKind,
  error: CliCheckError<string>,
): ForgeInitializationError {
  switch (error.code) {
    case "executable-unavailable":
      return { kind, code: "executable-unavailable" };
    case "version-check-failed":
      return { kind, code: "version-check-failed", exitCode: error.exitCode };
  }
}
