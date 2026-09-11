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
  try {
    const subprocess = Bun.spawn([executable, ...args], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    const exitCode = await subprocess.exited;

    if (exitCode !== 0) {
      const error: CliCheckError<Executable> = {
        code: "version-check-failed",
        executable,
        exitCode,
      };
      return Result.err(error);
    }
  } catch {
    const error: CliCheckError<Executable> = {
      code: "executable-unavailable",
      executable,
    };
    return Result.err(error);
  }

  return Result.ok();
}
