import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { ForgeOperationErrorCode } from "./types";
import type {
  CliExecutionError,
  ForgeKind,
  ForgeOperationError,
} from "./types";

export async function executeCli(
  kind: ForgeKind,
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Result<string, CliExecutionError>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn([executable, ...args], {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]);

      return { stdout, stderr, exitCode };
    },
    catch: (cause): CliExecutionError => ({
      kind,
      code: ForgeOperationErrorCode.CommandSpawnFailed,
      diagnostic: describeCause(cause),
    }),
  });

  return execution.andThen(({ stdout, stderr, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err<never, CliExecutionError>({
          kind,
          code: ForgeOperationErrorCode.CommandFailed,
          exitCode,
          diagnostic: stderr.trim() || `CLI exited with code ${exitCode}`,
        }),
  );
}

export function decodeJson<T>(
  kind: ForgeKind,
  decoder: (cause: unknown) => ResultType<T, ForgeOperationError>,
): (output: string) => ResultType<T, ForgeOperationError> {
  return (output) => {
    const parsed = Result.try({
      try: () => {
        const value: unknown = JSON.parse(output);
        return value;
      },
      catch: (cause): ForgeOperationError => ({
        kind,
        code: ForgeOperationErrorCode.InvalidJson,
        diagnostic:
          cause instanceof Error
            ? cause.message
            : "CLI returned malformed JSON",
      }),
    });

    return parsed.andThen(decoder);
  };
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Could not start the CLI";
}
