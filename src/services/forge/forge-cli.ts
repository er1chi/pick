import { executeCli } from "./cli-execution";
import {
  ForgeCommandSpawnFailedError,
  ForgeExecutableUnavailableError,
  ForgeVersionCheckFailedError,
} from "./types";

import type { Result } from "better-result";
import type { ForgeInitializationError, ForgeKind } from "./types";

/** Checks that the forge's CLI is installed. The CLI is only used to find
 * credentials; every request goes to the forge's API. */
export async function verifyCli(
  kind: ForgeKind,
  executable: string,
  cwd: string,
): Promise<Result<void, ForgeInitializationError>> {
  const execution = await executeCli(kind, executable, ["--version"], cwd);
  return execution
    .map(() => undefined)
    .mapError((error) => {
      if (ForgeCommandSpawnFailedError.is(error)) {
        return new ForgeExecutableUnavailableError({
          kind,
          message: error.message,
        });
      }
      return new ForgeVersionCheckFailedError({
        kind,
        cause: error,
        message: error.message,
      });
    });
}
