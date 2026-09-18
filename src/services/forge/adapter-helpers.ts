import { type } from "arktype";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { checkCli } from "./cli-check";
import { decodeJson, executeCli } from "./cli-execution";
import { ForgeIncompatibleResponseError } from "./types";
import { available, byteLength, failed } from "./normalization";
import type {
  ForgeInitializationError,
  ForgeKind,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestPatch,
  PullRequestList,
  PullRequestListOptions,
  PullRequestListState,
  PullRequestSummary,
} from "./types";

const defaultListLimit = 100;
const defaultListState: PullRequestListState = "open";
const maxListLimit = 1000;
const maxDiffBytes = 16 * 1024 * 1024;
const cliTimeoutMs = 30_000;

export async function initializeForgeAdapter<T>(
  kind: ForgeKind,
  executable: string,
  cwd: string,
  create: () => T,
): Promise<ResultType<T, ForgeInitializationError>> {
  return (await checkCli(kind, executable, ["--version"], cwd)).map(create);
}

function requestedListLimit(value: number | undefined): number {
  return Math.min(value ?? defaultListLimit, maxListLimit);
}

function requestedListState(
  value: PullRequestListState | undefined,
): PullRequestListState {
  return value ?? defaultListState;
}

export function executeForgeJson<T>(
  kind: ForgeKind,
  executable: string,
  cwd: string,
  args: readonly string[],
  decoder: (cause: unknown) => ResultType<T, ForgeOperationError>,
  signal: AbortSignal | undefined,
): Promise<ResultType<T, ForgeOperationError>> {
  return executeCli(kind, executable, args, cwd, {
    signal,
    timeoutMs: cliTimeoutMs,
  }).then((execution) => execution.andThen(decodeJson(kind, decoder)));
}

export function parseForgeSchema<T>(
  kind: ForgeKind,
  schema: (cause: unknown) => T | type.errors,
  cause: unknown,
  diagnostic: string,
): Result<T, ForgeOperationError> {
  const payload = schema(cause);
  if (payload instanceof type.errors) {
    return Result.err(
      new ForgeIncompatibleResponseError({
        kind,
        message: `${diagnostic}: ${payload.summary}`,
      }),
    );
  }
  return Result.ok(payload);
}

export function createCachedForgeRepositoryReader(
  args: readonly string[],
  decoder: (cause: unknown) => ResultType<ForgeRepository, ForgeOperationError>,
  kind: ForgeKind,
  executable: string,
  cwd: string,
): (
  signal: AbortSignal | undefined,
) => Promise<ResultType<ForgeRepository, ForgeOperationError>> {
  let cached: ForgeRepository | undefined;
  return async (signal) => {
    if (cached !== undefined) {
      return Result.ok(cached);
    }

    const result = await executeForgeJson(
      kind,
      executable,
      cwd,
      args,
      decoder,
      signal,
    );
    if (result.isOk()) {
      cached = result.value;
    }
    return result;
  };
}

export async function withForgeRepository<T>(
  getRepository: (
    signal: AbortSignal | undefined,
  ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>,
  signal: AbortSignal | undefined,
  operation: (
    repository: ForgeRepository,
  ) => Promise<ResultType<T, ForgeOperationError>>,
): Promise<ResultType<T, ForgeOperationError>> {
  const repository = await getRepository(signal);
  if (repository.isErr()) {
    return repository;
  }
  return operation(repository.value);
}

export async function loadForgePullRequestList(
  command: (
    repository: ForgeRepository,
    limit: number,
    state: PullRequestListState,
  ) => readonly string[],
  decoder: (
    cause: unknown,
  ) => ResultType<readonly PullRequestSummary[], ForgeOperationError>,
  getRepository: (
    signal: AbortSignal | undefined,
  ) => Promise<ResultType<ForgeRepository, ForgeOperationError>>,
  kind: ForgeKind,
  executable: string,
  cwd: string,
  options: PullRequestListOptions,
): Promise<ResultType<PullRequestList, ForgeOperationError>> {
  const limit = requestedListLimit(options.limit);
  const state = requestedListState(options.state);

  const repository = await getRepository(options.signal);
  if (repository.isErr()) {
    return repository;
  }

  return executeForgeList(
    kind,
    executable,
    cwd,
    repository.value,
    limit,
    command(repository.value, limit, state),
    decoder,
    options.signal,
  );
}

function executeForgeList(
  kind: ForgeKind,
  executable: string,
  cwd: string,
  repository: ForgeRepository,
  limit: number,
  args: readonly string[],
  decoder: (
    cause: unknown,
  ) => ResultType<readonly PullRequestSummary[], ForgeOperationError>,
  signal: AbortSignal | undefined,
): Promise<ResultType<PullRequestList, ForgeOperationError>> {
  return executeForgeJson(kind, executable, cwd, args, decoder, signal).then(
    (result) =>
      result.map((items) => ({
        repository,
        items: items.slice(0, limit),
        truncated: items.length > limit,
      })),
  );
}

export function sectionFromResult<T>(
  result: ResultType<T, ForgeOperationError>,
): ForgeSection<T> {
  return result.isOk() ? available(result.value) : failed(result.error);
}

export async function readForgePatch(
  kind: ForgeKind,
  executable: string,
  cwd: string,
  args: readonly string[],
  signal: AbortSignal | undefined,
): Promise<ForgeSection<PullRequestPatch>> {
  const execution = await executeCli(kind, executable, args, cwd, {
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
