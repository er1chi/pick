import type { CliCheckError } from "./cli-check";
import type { ForgeService } from "./forge-service";
import {
  ForgeServiceAdapter,
  initializeForgeService,
} from "./scaffold-capabilities";

export type ForgejoServiceInitializationError = CliCheckError<"fj">;

const executableName = "fj";

export class ForgejoService
  extends ForgeServiceAdapter<"forgejo">
  implements ForgeService
{
  public static async initialize() {
    return initializeForgeService(
      executableName,
      ["version"],
      () => new ForgejoService(),
    );
  }

  private constructor() {
    super("forgejo");
  }
}
