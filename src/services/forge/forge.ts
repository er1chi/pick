import type {
  ForgeKind,
  ForgeRequestOptions,
  ProviderPullRequestReference,
  PullRequest,
  PullRequestReference,
} from "./types";
import { ForgeError } from "./types";

export interface ForgeProvider {
  getPullRequest(
    reference: ProviderPullRequestReference,
    options?: ForgeRequestOptions,
  ): Promise<PullRequest>;
}

export type ForgeProviders = Partial<Record<ForgeKind, ForgeProvider>>;

export class ForgeService {
  private readonly providers: ForgeProviders;

  constructor(providers: ForgeProviders) {
    this.providers = providers;
  }

  public async getPullRequest(
    reference: PullRequestReference,
    options?: ForgeRequestOptions,
  ): Promise<PullRequest> {
    const provider = this.providers[reference.forge];
    if (provider === undefined) {
      throw new ForgeError(
        "unavailable",
        `No ${reference.forge} provider is configured.`,
      );
    }

    return provider.getPullRequest(reference, options);
  }
}
