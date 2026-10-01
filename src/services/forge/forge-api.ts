import { type } from "arktype";
import { Result } from "better-result";
import {
  ForgeCancelledError,
  ForgeIncompatibleResponseError,
  ForgeInvalidConnectionUrlError,
  ForgeInvalidJsonError,
  ForgeKind,
  ForgeRequestFailedError,
  ForgeTimedOutError,
} from "./types";

import type { Result as ResultType } from "better-result";
import type { ForgeOperationError, ForgeRepository } from "./types";

const timeoutMs = 30_000;
const jsonAccept = "application/json";
const nextLinkPattern = /<([^>]+)>;\s*rel="next"/;
const serviceNames = {
  [ForgeKind.GitHub]: "GitHub",
  [ForgeKind.Forgejo]: "Forgejo",
};

const graphqlSchema = type({
  "data?": "unknown",
  "errors?": type({ message: "string" }).array(),
});

export type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;
type TokenLookup = (host: string) => Promise<string | undefined>;
export type Decoder<T> = (cause: unknown) => ResultType<T, ForgeOperationError>;

interface ForgeApiOptions {
  readonly baseUrl: (
    repository: ForgeRepository,
  ) => ResultType<string, ForgeOperationError>;
  readonly token: TokenLookup;
  /** The page size query the forge understands, such as `per_page=100`. */
  readonly pageQuery: string;
  readonly fetch?: HttpFetch;
}

interface GraphqlVariables {
  readonly owner: string;
  readonly name: string;
  readonly number: number;
}

interface SendOptions {
  readonly accept: string;
  readonly body?: string;
}

interface ApiResponse {
  readonly body: string;
  readonly next: string | undefined;
}

export function decoder<T>(
  kind: ForgeKind,
  schema: (cause: unknown) => T | type.errors,
  diagnostic: string,
): Decoder<T> {
  return (cause) => {
    const payload = schema(cause);
    return payload instanceof type.errors
      ? Result.err(
          new ForgeIncompatibleResponseError({
            kind,
            message: `${diagnostic}: ${payload.summary}`,
          }),
        )
      : Result.ok(payload);
  };
}

function decodeJson<T>(
  kind: ForgeKind,
  decode: Decoder<T>,
): (body: string) => ResultType<T, ForgeOperationError> {
  return (body) =>
    Result.try({
      try: () => {
        const value: unknown = JSON.parse(body);
        return value;
      },
      catch: (cause): ForgeOperationError =>
        new ForgeInvalidJsonError({
          kind,
          message:
            cause instanceof Error ? cause.message : "Malformed JSON response",
        }),
    }).andThen(decode);
}

export class ForgeApi {
  private readonly fetch: HttpFetch;

  constructor(
    readonly kind: ForgeKind,
    private readonly options: ForgeApiOptions,
  ) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async json<T>(
    repository: ForgeRepository,
    path: string,
    decode: Decoder<T>,
    signal?: AbortSignal,
  ): Promise<ResultType<T, ForgeOperationError>> {
    const response = await this.get(repository, path, jsonAccept, signal);
    return response.andThen(({ body }) => decodeJson(this.kind, decode)(body));
  }

  /** Follows `Link: rel="next"` until the last page, or until at least
   * `limit` items are loaded. */
  async pagedJson<T>(
    repository: ForgeRepository,
    path: string,
    decode: Decoder<readonly T[]>,
    signal?: AbortSignal,
    limit = Number.POSITIVE_INFINITY,
  ): Promise<ResultType<readonly T[], ForgeOperationError>> {
    const separator = path.includes("?") ? "&" : "?";
    const first = `${path}${separator}${this.options.pageQuery}`;
    const items: T[] = [];
    let response = await this.get(repository, first, jsonAccept, signal);
    while (true) {
      const page = response.andThen(({ body, next }) =>
        decodeJson(this.kind, decode)(body).map((values) => ({ values, next })),
      );
      if (page.isErr()) {
        return Result.err(page.error);
      }
      items.push(...page.value.values);
      const { next } = page.value;
      if (next === undefined || items.length >= limit) {
        return Result.ok(items);
      }
      response = await this.send(next, { accept: jsonAccept }, signal);
    }
  }

  async text(
    repository: ForgeRepository,
    path: string,
    signal?: AbortSignal,
    accept = "text/plain",
  ): Promise<ResultType<string, ForgeOperationError>> {
    const response = await this.get(repository, path, accept, signal);
    return response.map(({ body }) => body);
  }

  async graphql<T>(
    repository: ForgeRepository,
    query: string,
    variables: GraphqlVariables,
    decode: Decoder<T>,
    signal?: AbortSignal,
  ): Promise<ResultType<T, ForgeOperationError>> {
    const url = this.options
      .baseUrl(repository)
      .map((base) => `${base}/graphql`);
    const response = await url.andThenAsync((target) =>
      this.send(
        target,
        { accept: jsonAccept, body: JSON.stringify({ query, variables }) },
        signal,
      ),
    );
    return response.andThen(({ body }) =>
      decodeJson(this.kind, (cause) =>
        decoder(
          this.kind,
          graphqlSchema,
          "GraphQL response did not match the schema",
        )(cause).andThen(({ data, errors = [] }) =>
          errors.length === 0
            ? decode(data)
            : Result.err(
                new ForgeRequestFailedError({
                  kind: this.kind,
                  status: null,
                  message: errors.map(({ message }) => message).join("; "),
                }),
              ),
        ),
      )(body),
    );
  }

  private async get(
    repository: ForgeRepository,
    path: string,
    accept: string,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ApiResponse, ForgeOperationError>> {
    const url = this.options
      .baseUrl(repository)
      .map((base) => `${base}/repos/${repository.fullName}/${path}`);
    return url.andThenAsync((target) => this.send(target, { accept }, signal));
  }

  private async send(
    url: string,
    { accept, body }: SendOptions,
    signal: AbortSignal | undefined,
  ): Promise<ResultType<ApiResponse, ForgeOperationError>> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const service = serviceNames[this.kind];
    return Result.tryPromise({
      try: async () => {
        const target = new URL(url);
        const token = await this.options.token(target.host);
        const headers = new Headers({ Accept: accept });
        if (body !== undefined) {
          headers.set("Content-Type", jsonAccept);
        }
        if (token !== undefined) {
          headers.set("Authorization", `token ${token}`);
        }
        const response = await this.fetch(url, {
          method: body === undefined ? "GET" : "POST",
          headers,
          body,
          signal:
            signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
        });
        if (!response.ok) {
          throw new ForgeRequestFailedError({
            kind: this.kind,
            status: response.status,
            message: `${service} API responded ${response.status} to ${target.pathname}`,
          });
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (accept === jsonAccept && !contentType.includes("json")) {
          throw new ForgeInvalidConnectionUrlError({
            kind: this.kind,
            url: target.origin,
            message: `Could not connect to the ${service} API`,
          });
        }
        return {
          body: await response.text(),
          next: nextLinkPattern.exec(response.headers.get("link") ?? "")?.[1],
        };
      },
      catch: (cause): ForgeOperationError => {
        if (
          ForgeRequestFailedError.is(cause) ||
          ForgeInvalidConnectionUrlError.is(cause)
        ) {
          return cause;
        }
        if (signal?.aborted === true) {
          return new ForgeCancelledError({
            kind: this.kind,
            message: "Request cancelled",
          });
        }
        if (timeout.aborted) {
          return new ForgeTimedOutError({
            kind: this.kind,
            message: `${service} API did not respond within ${timeoutMs / 1000}s`,
          });
        }
        return new ForgeRequestFailedError({
          kind: this.kind,
          status: null,
          message: cause instanceof Error ? cause.message : "Request failed",
        });
      },
    });
  }
}
