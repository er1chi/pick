import { Result } from "better-result";

export type CliCheckError<Executable extends string> =
  | {
      readonly code: "executable-unavailable";
      readonly executable: Executable;
    }
  | {
      readonly code: "version-check-failed";
      readonly executable: Executable;
      readonly exitCode: number;
    };

export async function checkCli<Executable extends string>(
  executable: Executable,
  args: readonly string[],
): Promise<Result<void, CliCheckError<Executable>>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn([executable, ...args], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });

      return await subprocess.exited;
    },
    catch: () => ({
      code: "executable-unavailable" as const,
      executable,
    }),
  });

  return execution.andThen((exitCode) =>
    exitCode === 0
      ? Result.ok()
      : Result.err({
          code: "version-check-failed" as const,
          executable,
          exitCode,
        }),
  );
}
