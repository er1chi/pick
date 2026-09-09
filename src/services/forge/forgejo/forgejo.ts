import {
  createClient,
  ResponseError,
  type Auth,
  type ClientInstance,
} from "@/gen/.kubb/client";
import { repoDownloadPullDiffOrPatch } from "@/gen/clients/repoDownloadPullDiffOrPatch";
import { repoGetPullRequest } from "@/gen/clients/repoGetPullRequest";
import { repoGetPullRequestFiles } from "@/gen/clients/repoGetPullRequestFiles";
import {
  forgeErrorForStatus,
  pullRequestData,
  pullRequestFile,
  PullRequestProvider,
} from "../provider";
import {
  ForgeError,
  type ProviderPullRequestReference,
  type PullRequestFile,
} from "../types";

declare global {
  type BodyInit = Bun.BodyInit;
}

const filePageLimit = 50;

export class ForgejoProvider extends PullRequestProvider {
  constructor({ baseUrl, token }: { baseUrl: string; token: string }) {
    const authorization = `token ${token}`;
    const client = createClient({
      baseURL: baseUrl,
      auth: (scheme) => authorizationFor(scheme, authorization),
    });
    super("forgejo", {
      readData: async (reference, signal) => {
        const result = await repoGetPullRequest({
          client,
          signal,
          path: pullRequestPath(reference),
        });
        return pullRequestData(result.data);
      },
      readFiles: (reference, signal) =>
        readChangedFiles(client, reference, signal),
      readDiff: (reference, signal) =>
        readUnifiedDiff(client, reference, signal),
      normalizeError: forgejoError,
    });
  }
}

async function readChangedFiles(
  client: ClientInstance,
  reference: ProviderPullRequestReference,
  signal: AbortSignal | undefined,
): Promise<PullRequestFile[]> {
  const files: PullRequestFile[] = [];
  let page = 1;

  while (true) {
    const result = await repoGetPullRequestFiles({
      client,
      signal,
      path: pullRequestPath(reference),
      query: { page, limit: filePageLimit },
    });
    const pageFiles = result.data;

    if (!Array.isArray(pageFiles)) {
      throw new ForgeError(
        "invalid-response",
        "Forgejo returned an invalid pull request file list.",
      );
    }

    files.push(...pageFiles.map(pullRequestFile));
    if (!hasAnotherFilePage(result.response, page, pageFiles.length)) {
      return files;
    }
    page += 1;
  }
}

async function readUnifiedDiff(
  client: ClientInstance,
  reference: ProviderPullRequestReference,
  signal: AbortSignal | undefined,
): Promise<string> {
  const result = await repoDownloadPullDiffOrPatch({
    client,
    signal,
    responseType: "text",
    path: { ...pullRequestPath(reference), diffType: "diff" },
  });

  if (result.data === undefined) {
    throw new ForgeError(
      "invalid-response",
      "Forgejo returned an invalid pull request diff.",
    );
  }

  return result.data;
}

function pullRequestPath(reference: ProviderPullRequestReference) {
  return {
    owner: reference.owner,
    repo: reference.repository,
    index: BigInt(reference.number),
  };
}

function authorizationFor(
  scheme: Auth,
  authorization: string,
): string | undefined {
  return scheme.type === "apiKey" && scheme.name === "Authorization"
    ? authorization
    : undefined;
}

function forgejoError(failure: Error): ForgeError {
  if (failure instanceof ForgeError) {
    return failure;
  }
  if (failure instanceof ResponseError) {
    return forgeErrorForStatus("Forgejo", failure.status, failure);
  }

  return new ForgeError("unavailable", "Forgejo request failed.", failure);
}

function hasAnotherFilePage(
  response: Response,
  page: number,
  pageLength: number,
): boolean {
  const hasMore = response.headers.get("x-hasmore");
  if (hasMore === "true") {
    return true;
  }
  if (hasMore === "false") {
    return false;
  }

  const pageCount = Number(response.headers.get("x-pagecount"));
  return pageCount > 0 ? page < pageCount : pageLength >= filePageLimit;
}
