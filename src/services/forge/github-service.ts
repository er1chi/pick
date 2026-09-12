import type { CliCheckError } from "./cli-check";
import { checkCli } from "./cli-check";

export type GithubServiceInitializationError = CliCheckError<"gh">;

const executableName = "gh";

export class GithubService {
  public readonly kind = "github" as const;

  public static async initialize() {
    return (await checkCli(executableName, ["--version"])).map(
      () => new GithubService(),
    );
  }

  private constructor() {}
}
