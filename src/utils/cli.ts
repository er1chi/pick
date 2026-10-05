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

export interface CliOptions {
  readonly timeoutMs?: number;
  readonly env?: Readonly<Record<string, string>>;
  readonly onLine?: (line: string) => void;
}

const maxOutputBytes = 10 * 1024 * 1024;

async function readOutput(
  stream: ReadableStream<Uint8Array>,
  onLine: ((line: string) => void) | undefined,
): Promise<string> {
  if (onLine === undefined) {
    return new Response(stream).text();
  }
  const decoder = new TextDecoder();
  let text = "";
  let pending = "";
  for await (const chunk of stream) {
    const decoded = decoder.decode(chunk, { stream: true });
    text += decoded;
    const buffered = pending + decoded;
    const end = buffered.endsWith("\r") ? -1 : buffered.length;
    const lines = buffered.slice(0, end).split(/\r?\n|\r/);
    pending = (lines.pop() ?? "") + buffered.slice(end);
    lines.forEach(onLine);
  }
  const last = pending.replace(/\r$/, "");
  if (last !== "") {
    onLine(last);
  }
  return text;
}

/** Runs a command to completion. Any exit code is a success here, so callers
 * decide which ones are failures. */
export async function runCli(
  executable: string,
  args: readonly string[],
  cwd: string,
  options: CliOptions = {},
): Promise<Result<CliOutput, CliError>> {
  const { timeoutMs, env, onLine } = options;
  const execution = await Result.tryPromise({
    try: async () => {
      const subprocess = Bun.spawn([executable, ...args], {
        cwd,
        env: env === undefined ? undefined : { ...process.env, ...env },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        timeout: timeoutMs,
        maxBuffer: maxOutputBytes,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        readOutput(subprocess.stdout, onLine),
        readOutput(subprocess.stderr, onLine),
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
