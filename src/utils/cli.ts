import { Result, TaggedError } from "better-result";

class CliSpawnFailedError extends TaggedError("CliSpawnFailedError")<{
  readonly message: string;
}> {}

class CliTimedOutError extends TaggedError("CliTimedOutError")<{
  readonly message: string;
}> {}

class CliOutputLimitError extends TaggedError("CliOutputLimitError")<{
  readonly message: string;
}> {}

export interface CliOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type CliError =
  | CliSpawnFailedError
  | CliTimedOutError
  | CliOutputLimitError;

const maxOutputBytes = 10 * 1024 * 1024;

/** Runs a command to completion. Any exit code is a success here, so callers
 * decide which ones are failures. */
export async function runCli(
  executable: string,
  args: readonly string[],
  cwd: string,
  timeoutMs?: number,
): Promise<Result<CliOutput, CliError>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn([executable, ...args], {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        timeout: timeoutMs,
        maxBuffer: maxOutputBytes,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]);
      const killed = subprocess.signalCode === "SIGTERM";
      return { output: { stdout, stderr, exitCode }, killed };
    },
    catch: (cause) =>
      new CliSpawnFailedError({
        message:
          cause instanceof Error ? cause.message : "Could not start the CLI",
      }),
  });

  return execution.andThen(({ output, killed }) => {
    if (!killed) {
      return Result.ok(output);
    }
    // Bun kills the process with the same signal for a timeout and for
    // output past `maxBuffer`, so the captured size tells them apart.
    const size = Math.max(
      Buffer.byteLength(output.stdout),
      Buffer.byteLength(output.stderr),
    );
    if (size >= maxOutputBytes) {
      return Result.err(
        new CliOutputLimitError({
          message: `${executable} output exceeded ${maxOutputBytes} bytes`,
        }),
      );
    }
    if (timeoutMs !== undefined) {
      return Result.err(
        new CliTimedOutError({
          message: `${executable} exceeded ${timeoutMs}ms`,
        }),
      );
    }
    return Result.ok(output);
  });
}
