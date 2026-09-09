import type {
  ForgeKind,
  ForgeRequestOptions,
  ForgeUser,
  ProviderPullRequestReference,
  PullRequest,
  PullRequestFile,
  PullRequestFileStatus,
  PullRequestState,
} from "./types";
import { ForgeError } from "./types";

type Count = bigint | number | undefined;

export interface PullRequestOperations {
  readData(
    reference: ProviderPullRequestReference,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestData>;
  readFiles(
    reference: ProviderPullRequestReference,
    signal: AbortSignal | undefined,
  ): Promise<PullRequestFile[]>;
  readDiff(
    reference: ProviderPullRequestReference,
    signal: AbortSignal | undefined,
  ): Promise<string>;
  normalizeError(failure: Error): ForgeError;
}

export class PullRequestProvider {
  private readonly forge: ForgeKind;
  private readonly operations: PullRequestOperations;

  constructor(forge: ForgeKind, operations: PullRequestOperations) {
    this.forge = forge;
    this.operations = operations;
  }

  public async getPullRequest(
    reference: ProviderPullRequestReference,
    options?: ForgeRequestOptions,
  ): Promise<PullRequest> {
    try {
      const signal = options?.signal;
      signal?.throwIfAborted();
      const [data, files, diff] = await Promise.all([
        this.operations.readData(reference, signal),
        this.operations.readFiles(reference, signal),
        this.operations.readDiff(reference, signal),
      ]);

      return createPullRequest(this.forge, reference, data, files, diff);
    } catch (cause) {
      if (
        options?.signal?.aborted ||
        (cause instanceof Error && cause.name === "AbortError")
      ) {
        throw cause;
      }

      const failure =
        cause instanceof Error
          ? cause
          : new ForgeError(
              "unavailable",
              "Forge provider failed without an error.",
              cause,
            );
      throw this.operations.normalizeError(failure);
    }
  }
}

export interface PullRequestData {
  title?: string;
  body?: string | null;
  state?: string;
  draft?: boolean | null;
  merged?: boolean | null;
  author?: ForgeUser;
  webUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  additions?: Count;
  deletions?: Count;
  baseSha?: string;
  headSha?: string;
}

export interface ProviderPullRequestPayload {
  title?: string;
  body?: string | null;
  state?: string;
  draft?: boolean | null;
  merged?: boolean | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  additions?: Count;
  deletions?: Count;
  base?: { sha?: string } | null;
  head?: { sha?: string } | null;
  user?: {
    login?: string;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface ProviderPullRequestFile {
  filename?: string;
  previous_filename?: string | null;
  status?: string;
  additions?: Count;
  deletions?: Count;
}

export function pullRequestData(
  payload: ProviderPullRequestPayload,
): PullRequestData {
  return {
    title: payload.title,
    body: payload.body,
    state: payload.state,
    draft: payload.draft,
    merged: payload.merged,
    author: createForgeUser(
      payload.user?.login,
      payload.user?.full_name,
      payload.user?.avatar_url,
    ),
    webUrl: payload.html_url,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    additions: payload.additions,
    deletions: payload.deletions,
    baseSha: payload.base?.sha,
    headSha: payload.head?.sha,
  };
}

export function pullRequestFile(
  file: ProviderPullRequestFile,
): PullRequestFile {
  return createPullRequestFile(
    file.filename,
    file.previous_filename,
    file.status,
    file.additions,
    file.deletions,
  );
}

export function createPullRequest(
  forge: ForgeKind,
  reference: ProviderPullRequestReference,
  data: PullRequestData,
  files: PullRequestFile[],
  diff: string,
): PullRequest {
  return {
    reference: { forge, ...reference },
    title: data.title ?? "",
    body: data.body ?? "",
    state: pullRequestState(data.state),
    draft: data.draft === true,
    merged: data.merged === true,
    author: data.author,
    webUrl: optionalText(data.webUrl),
    createdAt: optionalText(data.createdAt),
    updatedAt: optionalText(data.updatedAt),
    additions: count(data.additions),
    deletions: count(data.deletions),
    changes: {
      revision: {
        baseSha: requiredText(
          data.baseSha,
          "Pull request base revision is missing.",
        ),
        headSha: requiredText(
          data.headSha,
          "Pull request head revision is missing.",
        ),
      },
      files,
      diff: { format: "git-unified-diff", text: diff },
    },
  };
}

export function createPullRequestFile(
  path: string | undefined,
  previousPath: string | null | undefined,
  status: string | undefined,
  additions: Count,
  deletions: Count,
): PullRequestFile {
  const normalizedPreviousPath = optionalText(previousPath);
  const file: PullRequestFile = {
    path: requiredText(path, "Pull request file path is missing."),
    status: pullRequestFileStatus(status, normalizedPreviousPath),
    additions: count(additions),
    deletions: count(deletions),
  };

  if (normalizedPreviousPath !== undefined) {
    file.previousPath = normalizedPreviousPath;
  }

  return file;
}

export function createForgeUser(
  login: string | undefined,
  displayName?: string | null,
  avatarUrl?: string | null,
): ForgeUser | undefined {
  const normalizedLogin = optionalText(login);
  if (normalizedLogin === undefined) {
    return undefined;
  }

  const user: ForgeUser = { login: normalizedLogin };
  const normalizedDisplayName = optionalText(displayName);
  const normalizedAvatarUrl = optionalText(avatarUrl);
  if (normalizedDisplayName !== undefined) {
    user.displayName = normalizedDisplayName;
  }
  if (normalizedAvatarUrl !== undefined) {
    user.avatarUrl = normalizedAvatarUrl;
  }

  return user;
}

export function forgeErrorForStatus(
  provider: string,
  status: number,
  cause: unknown,
  rateLimited = status === 429,
): ForgeError {
  if (status === 401) {
    return new ForgeError(
      "authentication",
      `${provider} request was not authenticated.`,
      cause,
    );
  }
  if (rateLimited) {
    return new ForgeError(
      "rate-limited",
      `${provider} rate limit was exceeded.`,
      cause,
    );
  }
  if (status === 403) {
    return new ForgeError(
      "forbidden",
      `${provider} request was forbidden.`,
      cause,
    );
  }
  if (status === 404) {
    return new ForgeError("not-found", "Pull request was not found.", cause);
  }
  if (status >= 500) {
    return new ForgeError("unavailable", `${provider} is unavailable.`, cause);
  }

  return new ForgeError(
    "invalid-response",
    `${provider} returned an invalid pull request.`,
    cause,
  );
}

function pullRequestFileStatus(
  status: string | undefined,
  previousPath: string | undefined,
): PullRequestFileStatus {
  switch (status) {
    case "added":
    case "created":
    case "copied":
      return "added";
    case "deleted":
    case "removed":
      return "deleted";
    case "renamed":
      return "renamed";
    case "modified":
    case "changed":
    case "unchanged":
      return "modified";
    case undefined:
    case "":
      return previousPath === undefined ? "modified" : "renamed";
    default:
      throw new ForgeError(
        "invalid-response",
        "Pull request file status is unsupported.",
      );
  }
}

function pullRequestState(state: string | undefined): PullRequestState {
  if (state === "open" || state === "closed") {
    return state;
  }

  throw new ForgeError(
    "invalid-response",
    "Pull request state is missing or unsupported.",
  );
}

function requiredText(value: string | undefined, message: string): string {
  if (value === undefined || value === "") {
    throw new ForgeError("invalid-response", message);
  }

  return value;
}

function optionalText(value: string | null | undefined): string | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : value;
}

function count(value: Count): number {
  return value === undefined ? 0 : Number(value);
}
