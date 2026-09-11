import type { Result } from "better-result";
import { checkCli, type CliCheckError } from "./cli-check";

export type GithubServiceInitializationError = CliCheckError<"gh">;

const executableName = "gh";

export class GithubService {
  public static async initialize(): Promise<
    Result<GithubService, GithubServiceInitializationError>
  > {
    return (await checkCli(executableName, ["--version"])).map(
      () => new GithubService(executableName),
    );
  }

  private constructor(public readonly executableName: "gh") {}
}
