import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { ForgeOperationErrorCode } from "./types";
import type {
  CliExecutionError,
  ForgeKind,
  ForgeOperationError,
} from "./types";

const diagnosticOutputLimit = 1024 * 1024;
const defaultTimeoutMs = 30_000;

export interface CliExecutionOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

class CliOutputFailure extends Error {
  public constructor(
    public readonly code:
      | ForgeOperationErrorCode.OutputLimitExceeded
      | ForgeOperationErrorCode.Cancelled
      | ForgeOperationErrorCode.TimedOut,
    message: string,
  ) {
    super(message);
  }
}

export async function executeCli(
  kind: ForgeKind,
  executable: string,
  args: readonly string[],
  cwd: string,
  options: CliExecutionOptions = {},
): Promise<Result<string, CliExecutionError>> {
  if (options.signal?.aborted) {
    return Result.err({
      kind,
      code: ForgeOperationErrorCode.Cancelled,
      diagnostic: "CLI execution was cancelled before it started",
    });
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
          readStream(subprocess.stdout, options.maxOutputBytes),
          readStream(subprocess.stderr, diagnosticOutputLimit),
          subprocess.exited,
        ]);

        if (cancelled) {
          throw new CliOutputFailure(
            ForgeOperationErrorCode.Cancelled,
            "CLI execution was cancelled",
          );
        }
        if (timedOut) {
          throw new CliOutputFailure(
            ForgeOperationErrorCode.TimedOut,
            `CLI execution exceeded ${timeoutMs}ms`,
          );
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
      if (cause instanceof CliOutputFailure) {
        return {
          kind,
          code: cause.code,
          diagnostic: cause.message,
        };
      }
      return {
        kind,
        code: ForgeOperationErrorCode.CommandSpawnFailed,
        diagnostic: describeCause(cause),
      };
    },
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

async function readStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number | undefined,
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
      if (maxBytes !== undefined && byteLength > maxBytes) {
        throw new CliOutputFailure(
          ForgeOperationErrorCode.OutputLimitExceeded,
          `CLI output exceeded the ${maxBytes}-byte limit`,
        );
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
