import { type } from "arktype";
import { Result } from "better-result";
import { decodeJson, executeCli } from "./cli-execution";
import { byteLength } from "./normalization";
import { available, failed, sectionFromResult } from "./section";
import {
  ForgeCommandSpawnFailedError,
  ForgeExecutableUnavailableError,
  ForgeIncompatibleResponseError,
  ForgeVersionCheckFailedError,
} from "./types";

import type { Result as ResultType } from "better-result";
import type { CliExecutionOptions } from "./cli-execution";
import type {
  CliExecutionError,
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestList,
  PullRequestListOptions,
  PullRequestListState,
  PullRequestPatch,
  PullRequestSummary,
} from "./types";

const defaultListLimit = 100;
const defaultListState: PullRequestListState = "open";
const maxListLimit = 1000;
const maxDiffBytes = 16 * 1024 * 1024;
const cliTimeoutMs = 30_000;

export type CliRunner = typeof executeCli;
export type Decoder<T> = (cause: unknown) => ResultType<T, ForgeOperationError>;

export class ForgeCli {
  private readonly execute: (
    args: readonly string[],
    options: CliExecutionOptions,
  ) => Promise<Result<string, CliExecutionError>>;

  constructor(
    readonly kind: ForgeKind,
    executable: string,
    cwd: string,
    run: CliRunner = executeCli,
  ) {
    this.execute = (args, options) => run(kind, executable, args, cwd, options);
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
    const execution = await this.execute(args, {
      signal,
      timeoutMs: cliTimeoutMs,
    });
    return execution.andThen(decodeJson(this.kind, decode));
  }

  async section<Raw, T>(
    args: readonly string[],
    schema: (cause: unknown) => Raw | type.errors,
    normalize: (raw: Raw) => ResultType<T, ForgeOperationError>,
    diagnostic: string,
    signal?: AbortSignal,
  ): Promise<ForgeSection<T>> {
    const result = await this.json(
      args,
      (cause) => this.parse(schema, cause, diagnostic).andThen(normalize),
      signal,
    );
    return sectionFromResult(result);
  }

  async patch(
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<ForgeSection<PullRequestPatch>> {
    const execution = await this.execute(args, {
      signal,
      timeoutMs: cliTimeoutMs,
      maxOutputBytes: maxDiffBytes,
    });
    if (execution.isErr()) {
      return failed(execution.error);
    }

    return available({
      format: "git-patch",
      text: execution.value,
      byteLength: byteLength(execution.value),
    });
  }

  cachedJson<T>(
    args: readonly string[],
    decode: Decoder<T>,
  ): (signal?: AbortSignal) => Promise<Result<T, ForgeOperationError>> {
    let cached: T | undefined;
    return async (signal) => {
      if (cached !== undefined) {
        return Result.ok(cached);
      }

      const result = await this.json(args, decode, signal);
      if (result.isOk()) {
        cached = result.value;
      }
      return result;
    };
  }

  parse<T>(
    schema: (cause: unknown) => T | type.errors,
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

  async pullRequestList(
    getRepository: (
      signal?: AbortSignal,
    ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>,
    command: (
      repository: ForgeRepository,
      limit: number,
      state: PullRequestListState,
    ) => readonly string[],
    decode: Decoder<readonly PullRequestSummary[]>,
    options: PullRequestListOptions,
  ): Promise<Result<PullRequestList, ForgeOperationError>> {
    const limit = requestedListLimit(options.limit);
    const state = requestedListState(options.state);
    const repository = await getRepository(options.signal);
    if (repository.isErr()) {
      return repository;
    }

    const items = await this.json(
      command(repository.value, limit, state),
      decode,
      options.signal,
    );
    return items.map((list) => ({
      repository: repository.value,
      items: list.slice(0, limit),
      truncated: list.length > limit,
    }));
  }
}

export abstract class ForgeAdapterBase {
  public readonly kind: ForgeKind;

  protected constructor(
    protected readonly cli: ForgeCli,
    protected readonly repository: (
      signal?: AbortSignal,
    ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>,
  ) {
    this.kind = cli.kind;
  }

  protected async withRepository<T>(
    signal: AbortSignal | undefined,
    operation: (repository: ForgeRepository) => Promise<T>,
  ): Promise<Result<T, ForgeOperationError>> {
    const result = await this.repository(signal);
    if (result.isErr()) {
      return result;
    }
    return Result.ok(await operation(result.value));
  }
}

function requestedListLimit(value: number | undefined): number {
  return Math.min(value ?? defaultListLimit, maxListLimit);
}

function requestedListState(
  value: PullRequestListState | undefined,
): PullRequestListState {
  return value ?? defaultListState;
}
