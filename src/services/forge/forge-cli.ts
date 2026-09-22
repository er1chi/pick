import { type } from "arktype";
import { Result } from "better-result";
import { decodeJson, executeCli } from "./cli-execution";
import { available, failed, sectionFromResult } from "./section";
import {
  ForgeCommandSpawnFailedError,
  ForgeExecutableUnavailableError,
  ForgeIncompatibleResponseError,
  ForgeVersionCheckFailedError,
} from "./types";

import type { Result as ResultType } from "better-result";
import type {
  CliExecutionError,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  ForgeSection,
  PullRequestPatch,
} from "./types";

export type CliRunner = typeof executeCli;
type Decoder<T> = (cause: unknown) => ResultType<T, ForgeOperationError>;
type Schema<T> = (cause: unknown) => T | type.errors;

export class ForgeCli {
  private readonly execute: (
    args: readonly string[],
    signal: AbortSignal | undefined,
  ) => Promise<Result<string, CliExecutionError>>;

  constructor(
    readonly kind: ForgeKind,
    executable: string,
    cwd: string,
    run: CliRunner = executeCli,
  ) {
    this.execute = (args, signal) =>
      run(kind, executable, args, cwd, { signal });
  }

  static async initialize(
    kind: ForgeKind,
    executable: string,
    cwd: string,
    run: CliRunner = executeCli,
  ): Promise<Result<ForgeCli, ForgeInitializationError>> {
    const execution = await run(kind, executable, ["--version"], cwd);
    return execution
      .map(() => new ForgeCli(kind, executable, cwd, run))
      .mapError((error) => {
        if (ForgeCommandSpawnFailedError.is(error)) {
          return new ForgeExecutableUnavailableError({
            kind,
            message: error.message,
          });
        }
        return new ForgeVersionCheckFailedError({
          kind,
          cause: error,
          message: error.message,
        });
      });
  }

  async json<T>(
    args: readonly string[],
    decode: Decoder<T>,
    signal?: AbortSignal,
  ): Promise<Result<T, ForgeOperationError>> {
    const execution = await this.execute(args, signal);
    return execution.andThen(decodeJson(this.kind, decode));
  }

  async section<Raw, T>(
    args: readonly string[],
    schema: Schema<Raw>,
    normalize: (raw: Raw) => T,
    diagnostic: string,
    signal?: AbortSignal,
  ): Promise<ForgeSection<T>> {
    const result = await this.json(
      args,
      (cause) => this.parse(schema, cause, diagnostic).map(normalize),
      signal,
    );
    return sectionFromResult(result);
  }

  async patch(
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<ForgeSection<PullRequestPatch>> {
    const execution = await this.execute(args, signal);
    return execution.isOk()
      ? available({ text: execution.value })
      : failed(execution.error);
  }

  /** Runs the command once and shares the result. Concurrent callers share
   * the in-flight run, and a failure is not cached so the next call retries.
   * The shared run takes no caller's signal, so one caller cancelling cannot
   * fail the others. */
  cachedJson<T>(
    args: readonly string[],
    decode: Decoder<T>,
  ): () => Promise<Result<T, ForgeOperationError>> {
    let pending: Promise<Result<T, ForgeOperationError>> | undefined;
    return () => {
      if (pending === undefined) {
        const request = this.json(args, decode);
        pending = request;
        void request.then((result) => {
          if (result.isErr() && pending === request) {
            pending = undefined;
          }
        });
      }
      return pending;
    };
  }

  parse<T>(
    schema: Schema<T>,
    cause: unknown,
    diagnostic: string,
  ): Result<T, ForgeOperationError> {
    const payload = schema(cause);
    if (payload instanceof type.errors) {
      return Result.err(
        new ForgeIncompatibleResponseError({
          kind: this.kind,
          message: `${diagnostic}: ${payload.summary}`,
        }),
      );
    }
    return Result.ok(payload);
  }
}
