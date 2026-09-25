import { Result, TaggedError } from "better-result";
import {
  ForgeCancelledError,
  ForgeCommandFailedError,
  ForgeCommandSpawnFailedError,
  ForgeInvalidConnectionUrlError,
  ForgeInvalidJsonError,
  ForgeKind,
  ForgeOutputLimitExceededError,
  ForgeTimedOutError,
} from "./types";

import type { Result as ResultType } from "better-result";
import type { CliExecutionError, ForgeOperationError } from "./types";

const diagnosticOutputLimit = 1024 * 1024;
const defaultMaxOutputBytes = 32 * 1024 * 1024;
const defaultTimeoutMs = 30_000;
const requestUrlPattern = /error sending request for url \((\S+)\)/;
const invalidContentTypeMarker = "InvalidContentType";

interface CliExecutionOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

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
  options: CliExecutionOptions = {},
): Promise<Result<string, CliExecutionError>> {
  if (options.signal?.aborted) {
    return Result.err(
      new ForgeCancelledError({
        kind,
        message: "CLI execution was cancelled before it started",
      }),
    );
  }

  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn([executable, ...args], {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      let cancelled = false;
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

      const cancel = () => {
        cancelled = true;
        subprocess.kill();
      };
      const expire = () => {
        timedOut = true;
        subprocess.kill();
      };

      options.signal?.addEventListener("abort", cancel, { once: true });
      timeout = setTimeout(expire, timeoutMs);

      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          readStream(
            subprocess.stdout,
            kind,
            options.maxOutputBytes ?? defaultMaxOutputBytes,
          ),
          readStream(subprocess.stderr, kind, diagnosticOutputLimit),
          subprocess.exited,
        ]);

        if (cancelled) {
          throw new CliOutputFailure({
            failure: new ForgeCancelledError({
              kind,
              message: "CLI execution was cancelled",
            }),
          });
        }
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
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        options.signal?.removeEventListener("abort", cancel);
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

/** `fj` reports a TLS handshake answered by something other than TLS, such
 * as an SSH server, as a corrupt message of type `InvalidContentType`. */
function commandFailure(
  kind: ForgeKind,
  exitCode: number,
  stderr: string,
): CliExecutionError {
  const requestUrl = requestUrlPattern.exec(stderr)?.[1];
  if (
    kind === ForgeKind.Forgejo &&
    requestUrl !== undefined &&
    stderr.includes(invalidContentTypeMarker)
  ) {
    const url = Result.try(() => new URL(requestUrl).origin).unwrapOr(
      requestUrl,
    );
    return new ForgeInvalidConnectionUrlError({
      kind,
      url,
      message: "Could not connect to the Forgejo API",
    });
  }

  return new ForgeCommandFailedError({
    kind,
    exitCode,
    message: stderr.trim() || `CLI exited with code ${exitCode}`,
  });
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
      catch: (cause): ForgeOperationError =>
        new ForgeInvalidJsonError({
          kind,
          message:
            cause instanceof Error
              ? cause.message
              : "CLI returned malformed JSON",
        }),
    });

    return parsed.andThen(decoder);
  };
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
