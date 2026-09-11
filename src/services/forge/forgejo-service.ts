import { Result } from "better-result";

export interface ForgejoServiceInitializationError {
  readonly code: "executable-not-found";
  readonly executable: "fj";
}

const executableName = "fj";

export class ForgejoService {
  public static initialize(): Result<
    ForgejoService,
    ForgejoServiceInitializationError
  > {
    const executablePath = Bun.which(executableName);
    if (executablePath === null) {
      const error: ForgejoServiceInitializationError = {
        code: "executable-not-found",
        executable: executableName,
      };
      return Result.err(error);
    }

    return Result.ok(new ForgejoService(executablePath));
  }

  private constructor(public readonly executablePath: string) {}
}
