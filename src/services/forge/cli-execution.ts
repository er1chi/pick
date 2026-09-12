import { Result } from "better-result";
import type { CliExecutionError, ForgeKind } from "./types";

type CliOutput = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

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

      return { stdout, stderr, exitCode } satisfies CliOutput;
    },
    catch: (cause) => ({
      kind,
      code: "command-spawn-failed" as const,
      diagnostic: describeCause(cause),
    }),
  });

  return execution.andThen(({ stdout, stderr, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err({
          kind,
          code: "command-failed" as const,
          exitCode,
          diagnostic: stderr.trim() || `CLI exited with code ${exitCode}`,
        }),
  );
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Could not start the CLI";
}
