import type { Result } from "better-result";
import { executeCli } from "./cli-execution";
import type { CliCheckError, ForgeKind } from "./types";

export async function checkCli<Executable extends string>(
  kind: ForgeKind,
  executable: Executable,
  args: readonly string[],
  cwd = process.cwd(),
): Promise<Result<void, CliCheckError<Executable>>> {
  const execution = await executeCli(kind, executable, args, cwd);

  return execution
    .map(() => undefined)
    .mapError((error) =>
      error.code === "command-spawn-failed"
        ? { code: "executable-unavailable" as const, executable }
        : {
            code: "version-check-failed" as const,
            executable,
            exitCode: error.exitCode,
          },
    );
}
