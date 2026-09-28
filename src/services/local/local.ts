import { Result } from "better-result";
import { GitCommandFailedError, GitUnavailableError } from "./types";

import type { GitError } from "./types";

async function runGit(
  cwd: string,
  args: readonly string[],
): Promise<Result<string, GitError>> {
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn(["git", ...args], {
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
    catch: () =>
      new GitUnavailableError({
        message: "git could not be executed",
      }),
  });

  return execution.andThen(({ stdout, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err<never, GitError>(
          new GitCommandFailedError({
            exitCode,
            message: `git ${args.join(" ")} exited with code ${exitCode}`,
          }),
        ),
  );
}

export async function readGitRemoteOutput(
  cwd: string,
): Promise<Result<string, GitError>> {
  return runGit(cwd, ["remote", "-v"]);
}
