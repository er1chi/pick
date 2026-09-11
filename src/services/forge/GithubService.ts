import { Result } from "better-result";

export interface GithubServiceInitializationError {
  readonly code: "executable-not-found";
  readonly executable: "gh";
}

const executableName = "gh";

export class GithubService {
  public static initialize(): Result<
    GithubService,
    GithubServiceInitializationError
  > {
    const executablePath = Bun.which(executableName);
    if (executablePath === null) {
      const error: GithubServiceInitializationError = {
        code: "executable-not-found",
        executable: executableName,
      };
      return Result.err(error);
    }

    return Result.ok(new GithubService(executablePath));
  }

  private constructor(public readonly executablePath: string) {}
}
