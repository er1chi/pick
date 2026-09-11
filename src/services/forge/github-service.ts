import type { CliCheckError } from "./cli-check";
import type { ForgeService } from "./forge-service";
import {
  ForgeServiceAdapter,
  initializeForgeService,
} from "./scaffold-capabilities";

export type GithubServiceInitializationError = CliCheckError<"gh">;

const executableName = "gh";

export class GithubService
  extends ForgeServiceAdapter<"github">
  implements ForgeService
{
  public static async initialize() {
    return initializeForgeService(
      executableName,
      ["--version"],
      () => new GithubService(),
    );
  }

  private constructor() {
    super("github");
  }
}
