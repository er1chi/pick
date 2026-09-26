import { type } from "arktype";
import { Result } from "better-result";
import { homedir } from "node:os";
import { join } from "node:path";
import { decodeJson } from "./cli-execution";
import {
  ForgeCancelledError,
  ForgeInvalidRequestError,
  ForgeKind,
  ForgeRequestFailedError,
  ForgeTimedOutError,
} from "./types";

import type { Result as ResultType } from "better-result";
import type { ForgeOperationError, ForgeRepository } from "./types";

const kind = ForgeKind.Forgejo;
const pageSize = 50;
const timeoutMs = 30_000;

const keysSchema = type({
  hosts: type({ "[string]": type({ token: "string" }) }),
});

export type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;
/** The token `fj` stored for an instance, or `undefined` to go anonymous. */
export type TokenLookup = (instance: string) => Promise<string | undefined>;
type Decoder<T> = (cause: unknown) => ResultType<T, ForgeOperationError>;

interface ApiResponse {
  readonly body: string;
  readonly hasMore: boolean;
}

/** Reads a token from `fj`'s keys file, which keys each login by the
 * instance URL without its scheme. */
async function readFjToken(instance: string): Promise<string | undefined> {
  const dataDir =
    process.env.FJ_DATA_DIR ??
    join(
      process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
      "forgejo-cli",
    );
  const text = await Result.tryPromise(() =>
    Bun.file(join(dataDir, "keys.json")).text(),
  );
  if (text.isErr()) {
    return undefined;
  }
  const keys = keysSchema(Result.try(() => JSON.parse(text.value)).unwrapOr(0));
  return keys instanceof type.errors ? undefined : keys.hosts[instance]?.token;
}

/** Reads what `fj` does not expose from the Forgejo REST API, with the login
 * `fj` stored for the instance. */
export class ForgejoApi {
  constructor(
    private readonly fetch: HttpFetch = globalThis.fetch,
    private readonly token: TokenLookup = readFjToken,
  ) {}

  /** Every page of a list endpoint, following Forgejo's `x-hasmore` header. */
  async pagedJson<T>(
    repository: ForgeRepository,
    path: string,
    decode: Decoder<readonly T[]>,
    signal?: AbortSignal,
  ): Promise<Result<readonly T[], ForgeOperationError>> {
    const items: T[] = [];
    for (let page = 1; ; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const response = await this.get(
        repository,
        `${path}${separator}page=${page}&limit=${pageSize}`,
        signal,
      );
      const decoded = response.andThen(({ body }) =>
        decodeJson(kind, decode)(body),
      );
      if (decoded.isErr()) {
        return decoded;
      }
      items.push(...decoded.value);
      if (!response.unwrap().hasMore) {
        return Result.ok(items);
      }
    }
  }

  async text(
    repository: ForgeRepository,
    path: string,
    signal?: AbortSignal,
  ): Promise<Result<string, ForgeOperationError>> {
    const response = await this.get(repository, path, signal);
    return response.map(({ body }) => body);
  }

  private async get(
    repository: ForgeRepository,
    path: string,
    signal: AbortSignal | undefined,
  ): Promise<Result<ApiResponse, ForgeOperationError>> {
    const suffix = `/${repository.fullName}`;
    if (repository.url === null || !repository.url.endsWith(suffix)) {
      return Result.err(
        new ForgeInvalidRequestError({
          kind,
          message: "Forgejo did not report a web URL for this repository",
        }),
      );
    }
    const instance = repository.url.slice(0, -suffix.length);
    const token = await this.token(instance.replace(/^[a-z]+:\/\//i, ""));
    const timeout = AbortSignal.timeout(timeoutMs);
    return Result.tryPromise({
      try: async () => {
        const response = await this.fetch(
          `${instance}/api/v1/repos/${repository.fullName}/${path}`,
          {
            headers:
              token === undefined ? {} : { Authorization: `token ${token}` },
            signal:
              signal === undefined
                ? timeout
                : AbortSignal.any([signal, timeout]),
          },
        );
        if (!response.ok) {
          throw new ForgeRequestFailedError({
            kind,
            status: response.status,
            message: `Forgejo API responded ${response.status} to ${path}`,
          });
        }
        return {
          body: await response.text(),
          hasMore: response.headers.get("x-hasmore") === "true",
        };
      },
      catch: (cause): ForgeOperationError => {
        if (ForgeRequestFailedError.is(cause)) {
          return cause;
        }
        if (signal?.aborted === true) {
          return new ForgeCancelledError({
            kind,
            message: "Request cancelled",
          });
        }
        if (timeout.aborted) {
          return new ForgeTimedOutError({
            kind,
            message: `Forgejo API did not respond within ${timeoutMs / 1000}s`,
          });
        }
        return new ForgeRequestFailedError({
          kind,
          status: null,
          message: cause instanceof Error ? cause.message : "Request failed",
        });
      },
    });
  }
}
