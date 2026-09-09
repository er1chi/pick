export type ForgeKind = "github" | "forgejo";

export interface PullRequestReference {
  forge: ForgeKind;
  owner: string;
  repository: string;
  number: number;
}

export type ProviderPullRequestReference = Omit<PullRequestReference, "forge">;

export interface ForgeRequestOptions {
  signal?: AbortSignal;
}

export interface ForgeUser {
  login: string;
  displayName?: string;
  avatarUrl?: string;
}

export type PullRequestState = "open" | "closed";

export type PullRequestFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed";

export interface PullRequestFile {
  path: string;
  previousPath?: string;
  status: PullRequestFileStatus;
  additions: number;
  deletions: number;
}

export interface PullRequestRevision {
  baseSha: string;
  headSha: string;
}

export interface PullRequestChanges {
  revision: PullRequestRevision;
  files: PullRequestFile[];
  diff: {
    format: "git-unified-diff";
    text: string;
  };
}

export interface PullRequest {
  reference: PullRequestReference;
  title: string;
  body: string;
  state: PullRequestState;
  draft: boolean;
  merged: boolean;
  author?: ForgeUser;
  webUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  additions: number;
  deletions: number;
  changes: PullRequestChanges;
}

export type ForgeErrorKind =
  | "authentication"
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "unavailable"
  | "invalid-response";

export class ForgeError extends Error {
  public readonly kind: ForgeErrorKind;
  public override readonly cause?: unknown;

  constructor(kind: ForgeErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "ForgeError";
    this.kind = kind;
    this.cause = cause;
  }
}
