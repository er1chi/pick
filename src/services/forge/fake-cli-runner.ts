import { Result } from "better-result";
import { ForgeCommandFailedError } from "./types";

import type { CliRunner } from "./forge-cli";
import type { CliExecutionError, ForgeKind } from "./types";

interface RecordedCall {
  readonly executable: string;
  readonly cwd: string;
  readonly args: readonly string[];
}

/** Matches one command line (`args.join(" ")`) to the outcome of running it. */
export type CannedCommand = readonly [
  matches: (command: string) => boolean,
  outcome: Result<string, CliExecutionError>,
];

export interface FakeCli {
  readonly run: CliRunner;
  readonly calls: readonly RecordedCall[];
  /** The recorded calls whose command line starts with `prefix`. */
  callsMatching(prefix: string): readonly RecordedCall[];
}

export function exact(command: string): (candidate: string) => boolean {
  return (candidate) => candidate === command;
}

export function prefix(command: string): (candidate: string) => boolean {
  return (candidate) => candidate.startsWith(command);
}

export function stdout(text: string): Result<string, CliExecutionError> {
  return Result.ok(text);
}

export function fails(
  error: CliExecutionError,
): Result<string, CliExecutionError> {
  return Result.err(error);
}

/** A `CliRunner` that never spawns: it replies from `commands` and records
 * every invocation. Unknown commands fail with exit code 1. */
export function createFakeCli(
  kind: ForgeKind,
  commands: readonly CannedCommand[],
): FakeCli {
  const calls: RecordedCall[] = [];
  const run: CliRunner = async (_kind, executable, args, cwd) => {
    calls.push({ executable, cwd, args });
    const command = args.join(" ");
    const canned = commands.find(([matches]) => matches(command));
    if (canned === undefined) {
      return Result.err(
        new ForgeCommandFailedError({
          kind,
          exitCode: 1,
          message: `no canned response for: ${command}`,
        }),
      );
    }
    const [, outcome] = canned;
    return outcome;
  };
  return {
    run,
    calls,
    callsMatching: (commandPrefix) =>
      calls.filter((call) => call.args.join(" ").startsWith(commandPrefix)),
  };
}
