import { Result } from "better-result";
import { ForgeInvalidRequestError, ForgeUnexpectedError } from "./types";

import type {
  ForgeKind,
  ForgeOperationError,
  ForgeRepository,
  PullRequestDocument,
  PullRequestList,
  PullRequestListOptions,
  PullRequestListState,
  PullRequestSummary,
} from "./types";

const defaultListLimit = 100;
const maxListLimit = 1000;
const defaultListState: PullRequestListState = "open";

export type RepositoryLookup = () => Promise<
  Result<ForgeRepository, ForgeOperationError>
>;

interface ListRequest {
  readonly limit: number;
  readonly state: PullRequestListState;
}

/** Validates the list options, then fetches against the current repository.
 * `fetch` may return more than `limit` items; the extra marks truncation. */
export async function requestPullRequestList(
  kind: ForgeKind,
  lookup: RepositoryLookup,
  options: PullRequestListOptions,
  fetch: (
    repository: ForgeRepository,
    request: ListRequest,
  ) => Promise<Result<readonly PullRequestSummary[], ForgeOperationError>>,
): Promise<Result<PullRequestList, ForgeOperationError>> {
  const request = listRequest(kind, options);
  if (request.isErr()) {
    return request;
  }
  const { limit } = request.value;
  return withRepository(kind, lookup, async (repository) => {
    const items = await fetch(repository, request.value);
    return items.map((list) => ({
      repository,
      items: list.slice(0, limit),
      truncated: list.length > limit,
    }));
  });
}

export async function requestPullRequest(
  kind: ForgeKind,
  lookup: RepositoryLookup,
  number: number,
  load: (repository: ForgeRepository) => Promise<PullRequestDocument>,
): Promise<Result<PullRequestDocument, ForgeOperationError>> {
  const valid = validatePullRequestNumber(kind, number);
  if (valid.isErr()) {
    return valid;
  }
  return withRepository(kind, lookup, async (repository) =>
    Result.ok(await load(repository)),
  );
}

function listRequest(
  kind: ForgeKind,
  options: PullRequestListOptions,
): Result<ListRequest, ForgeOperationError> {
  const limit = options.limit ?? defaultListLimit;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    return invalidRequest(
      kind,
      "Pull request list limit must be a positive safe integer",
    );
  }
  return Result.ok({
    limit: Math.min(limit, maxListLimit),
    state: options.state ?? defaultListState,
  });
}

function validatePullRequestNumber(
  kind: ForgeKind,
  number: number,
): Result<number, ForgeOperationError> {
  if (!Number.isSafeInteger(number) || number <= 0) {
    return invalidRequest(
      kind,
      "Pull request number must be a positive safe integer",
    );
  }
  return Result.ok(number);
}

export function validateCommitSha(
  kind: ForgeKind,
  sha: string,
): Result<string, ForgeOperationError> {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    return invalidRequest(
      kind,
      "Commit SHA must be 7 to 40 hexadecimal characters",
    );
  }
  return Result.ok(sha);
}

/** Runs `operation` against the current repository. A throw anywhere inside
 * is reported as a failed `Result`, which is what keeps `Forge` calls from
 * rejecting. */
export async function withRepository<T>(
  kind: ForgeKind,
  lookup: RepositoryLookup,
  operation: (
    repository: ForgeRepository,
  ) => Promise<Result<T, ForgeOperationError>>,
): Promise<Result<T, ForgeOperationError>> {
  try {
    const repository = await lookup();
    if (repository.isErr()) {
      return repository;
    }
    return await operation(repository.value);
  } catch (cause) {
    return Result.err(
      new ForgeUnexpectedError({
        kind,
        cause,
        message: cause instanceof Error ? cause.message : "Unexpected failure",
      }),
    );
  }
}

function invalidRequest<T>(
  kind: ForgeKind,
  message: string,
): Result<T, ForgeOperationError> {
  return Result.err(new ForgeInvalidRequestError({ kind, message }));
}
