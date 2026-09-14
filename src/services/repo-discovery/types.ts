import { TaggedError } from "better-result";

export interface RecentRepository {
  readonly name: string;
  readonly path: string;
  readonly displayPath: string;
  readonly lastActivityAt: number;
}

export class RepositoryDiscoveryError extends TaggedError(
  "RepositoryDiscoveryError",
)<{
  readonly path: string;
  readonly cause: unknown;
  readonly message: string;
}> {}
