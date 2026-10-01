import { Result, TaggedError } from "better-result";

class CliSpawnFailedError extends TaggedError("CliSpawnFailedError")<{
  readonly message: string;
}> {}

class CliTimedOutError extends TaggedError("CliTimedOutError")<{
  readonly message: string;
}> {}

export interface CliOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type CliError = CliSpawnFailedError | CliTimedOutError;

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
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]);
      const timedOut =
        timeoutMs !== undefined && subprocess.signalCode === "SIGTERM";
      return { output: { stdout, stderr, exitCode }, timedOut };
    },
    catch: (cause) =>
      new CliSpawnFailedError({
        message:
          cause instanceof Error ? cause.message : "Could not start the CLI",
      }),
  });

  return execution.andThen(({ output, timedOut }) =>
    timedOut
      ? Result.err(
          new CliTimedOutError({
            message: `${executable} exceeded ${timeoutMs}ms`,
          }),
        )
      : Result.ok(output),
  );
}
