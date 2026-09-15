import { type } from "arktype";
import { Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { checkCli } from "./cli-check";
import { decodeJson, executeCli } from "./cli-execution";
import { ForgeOperationErrorCode } from "./types";
import { available, byteLength, failed } from "./normalization";
import type {
  CliCheckError,
  ForgeKind,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  PullRequestPatch,
  PullRequestList,
  PullRequestListOptions,
  PullRequestSummary,
} from "./types";

const defaultListLimit = 100;
const maxListLimit = 1000;
const maxDiffBytes = 16 * 1024 * 1024;
const cliTimeoutMs = 30_000;

export async function initializeForgeAdapter<T>(
  kind: ForgeKind,
  executable: string,
  cwd: string,
  create: () => T,
): Promise<ResultType<T, CliCheckError>> {
  return (await checkCli(kind, executable, ["--version"], cwd)).map(create);
}

function requestedListLimit(
  kind: ForgeKind,
  value: number | undefined,
): Result<number, ForgeOperationError> {
  if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
    return Result.err({
      kind,
      code: ForgeOperationErrorCode.InvalidRequest,
      diagnostic: "Pull request list limit must be a positive safe integer",
    });
  }
  return Result.ok(Math.min(value ?? defaultListLimit, maxListLimit));
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
    return Result.err({
      kind,
      code: ForgeOperationErrorCode.IncompatibleResponse,
      diagnostic: `${diagnostic}: ${payload.summary}`,
    });
  }
  return Result.ok(payload);
}

export function readForgeRepository(
  args: readonly string[],
  decoder: (cause: unknown) => ResultType<ForgeRepository, ForgeOperationError>,
  kind: ForgeKind,
  executable: string,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<ResultType<ForgeRepository, ForgeOperationError>> {
  return executeForgeJson(kind, executable, cwd, args, decoder, signal);
}

export async function loadForgePullRequestList(
  command: (repository: ForgeRepository, limit: number) => readonly string[],
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
  const repository = await getRepository(options.signal);
  if (repository.isErr()) {
    return repository;
  }

  const limit = requestedListLimit(kind, options.limit);
  if (limit.isErr()) {
    return limit;
  }

  return executeForgeList(
    kind,
    executable,
    cwd,
    repository.value,
    limit.value,
    command(repository.value, limit.value),
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
