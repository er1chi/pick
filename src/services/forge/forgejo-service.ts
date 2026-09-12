import type { CliCheckError } from "./cli-check";
import { checkCli } from "./cli-check";

export type ForgejoServiceInitializationError = CliCheckError<"fj">;

const executableName = "fj";

export class ForgejoService {
  public readonly kind = "forgejo" as const;

  public static async initialize() {
    return (await checkCli(executableName, ["--version"])).map(
      () => new ForgejoService(),
    );
  }

  private constructor() {}
}
