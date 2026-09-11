import type { Result } from "better-result";
import { checkCli, type CliCheckError } from "./cli-check";

export type ForgejoServiceInitializationError = CliCheckError<"fj">;

const executableName = "fj";

export class ForgejoService {
  public static async initialize(): Promise<
    Result<ForgejoService, ForgejoServiceInitializationError>
  > {
    return (await checkCli(executableName, ["version"])).map(
      () => new ForgejoService(executableName),
    );
  }

  private constructor(public readonly executableName: "fj") {}
}
