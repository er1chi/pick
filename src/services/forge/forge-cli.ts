import { Result } from "better-result";
import { runCli } from "@/utils/cli";
import {
  ForgeCommandFailedError,
  ForgeCommandSpawnFailedError,
  ForgeExecutableUnavailableError,
  ForgeTimedOutError,
  ForgeVersionCheckFailedError,
} from "./types";

import type {
  CliExecutionError,
  ForgeInitializationError,
  ForgeKind,
} from "./types";

const timeoutMs = 30_000;

export async function executeCli(
  kind: ForgeKind,
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Result<string, CliExecutionError>> {
  const execution = await runCli(executable, args, cwd, timeoutMs);
  return execution
    .mapError(
      (error): CliExecutionError =>
        error.match({
          CliSpawnFailedError: ({ message }) =>
            new ForgeCommandSpawnFailedError({ kind, message }),
          CliTimedOutError: ({ message }) =>
            new ForgeTimedOutError({ kind, message }),
        }),
    )
    .andThen(({ stdout, stderr, exitCode }) =>
      exitCode === 0
        ? Result.ok(stdout)
        : Result.err(
            new ForgeCommandFailedError({
              kind,
              exitCode,
              message: stderr.trim() || `CLI exited with code ${exitCode}`,
            }),
          ),
    );
}

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
