import { Result, TaggedError } from "better-result";
import {
  ForgeCommandFailedError,
  ForgeCommandSpawnFailedError,
  ForgeOutputLimitExceededError,
  ForgeTimedOutError,
} from "./types";

import type { CliExecutionError, ForgeKind } from "./types";

const diagnosticOutputLimit = 1024 * 1024;
const maxOutputBytes = 32 * 1024 * 1024;
const timeoutMs = 30_000;

/** Internal abort signal for the stream readers, mapped to a domain error by
 * the `catch` handler of the surrounding `Result.tryPromise`. */
class CliOutputFailure extends TaggedError("CliOutputFailure")<{
  readonly failure: CliExecutionError;
}> {}

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
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        subprocess.kill();
      }, timeoutMs);

      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          readStream(subprocess.stdout, kind, maxOutputBytes),
          readStream(subprocess.stderr, kind, diagnosticOutputLimit),
          subprocess.exited,
        ]);

        if (timedOut) {
          throw new CliOutputFailure({
            failure: new ForgeTimedOutError({
              kind,
              message: `CLI execution exceeded ${timeoutMs}ms`,
            }),
          });
        }

        return { stdout, stderr, exitCode };
      } catch (cause) {
        subprocess.kill();
        throw cause;
      } finally {
        clearTimeout(timeout);
      }
    },
    catch: (cause): CliExecutionError => {
      if (CliOutputFailure.is(cause)) {
        return cause.failure;
      }
      return new ForgeCommandSpawnFailedError({
        kind,
        message: describeCause(cause),
      });
    },
  });

  return execution.andThen(({ stdout, stderr, exitCode }) =>
    exitCode === 0
      ? Result.ok(stdout)
      : Result.err(commandFailure(kind, exitCode, stderr)),
  );
}

function commandFailure(
  kind: ForgeKind,
  exitCode: number,
  stderr: string,
): CliExecutionError {
  return new ForgeCommandFailedError({
    kind,
    exitCode,
    message: stderr.trim() || `CLI exited with code ${exitCode}`,
  });
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
  kind: ForgeKind,
  maxBytes: number,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      byteLength += chunk.value.byteLength;
      if (byteLength > maxBytes) {
        throw new CliOutputFailure({
          failure: new ForgeOutputLimitExceededError({
            kind,
            message: `CLI output exceeded the ${maxBytes}-byte limit`,
          }),
        });
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Could not start the CLI";
}
