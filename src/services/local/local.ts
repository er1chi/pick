import { Result } from "better-result";
import { GitRemoteErrorCode, type GitRemoteError } from "./types";

export async function readGitRemoteOutput(
  cwd: string,
): Promise<Result<string, GitRemoteError>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn(["git", "remote", "-v"], {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, , exitCode] = await Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]);

      return { stdout, exitCode };
    },
    catch: (): GitRemoteError => ({
      code: GitRemoteErrorCode.GitUnavailable,
    }),
  });

  return execution.andThen(({ stdout, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err<never, GitRemoteError>({
          code: GitRemoteErrorCode.GitCommandFailed,
          exitCode,
        }),
  );
}
