import type { Result } from "better-result";
import { executeCli } from "./cli-execution";
import {
  ForgeExecutableUnavailableError,
  ForgeVersionCheckFailedError,
} from "./types";
import type { ForgeInitializationError, ForgeKind } from "./types";

export async function checkCli(
  kind: ForgeKind,
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Result<void, ForgeInitializationError>> {
  const execution = await executeCli(kind, executable, args, cwd);

  return execution
    .map(() => undefined)
    .mapError((error) =>
      error.match({
        ForgeCommandSpawnFailedError: (cause) =>
          new ForgeExecutableUnavailableError({
            kind,
            message: cause.message,
          }),
        ForgeCommandFailedError: (cause) =>
          new ForgeVersionCheckFailedError({
            kind,
            exitCode: cause.exitCode,
            message: cause.message,
          }),
        ForgeOutputLimitExceededError: (cause) =>
          new ForgeVersionCheckFailedError({
            kind,
            exitCode: -1,
            message: cause.message,
          }),
        ForgeCancelledError: (cause) =>
          new ForgeVersionCheckFailedError({
            kind,
            exitCode: -1,
            message: cause.message,
          }),
        ForgeTimedOutError: (cause) =>
          new ForgeVersionCheckFailedError({
            kind,
            exitCode: -1,
            message: cause.message,
          }),
      }),
    );
}
