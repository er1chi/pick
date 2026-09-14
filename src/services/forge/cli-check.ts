import type { Result } from "better-result";
import { executeCli } from "./cli-execution";
import { ForgeInitializationErrorCode, ForgeOperationErrorCode } from "./types";
import type { CliCheckError, ForgeKind } from "./types";

export async function checkCli(
  kind: ForgeKind,
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Result<void, CliCheckError>> {
  const execution = await executeCli(kind, executable, args, cwd);

  return execution
    .map(() => undefined)
    .mapError((error) =>
      error.code === ForgeOperationErrorCode.CommandSpawnFailed
        ? { code: ForgeInitializationErrorCode.ExecutableUnavailable }
        : {
            code: ForgeInitializationErrorCode.VersionCheckFailed,
            exitCode: error.exitCode,
          },
    );
}
