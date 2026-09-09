import { type } from "arktype";
import { Octokit, RequestError } from "octokit";
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

type GithubPullRequestFile = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["listFiles"]>
>["data"][number];

const filePageSize = 100;
const unifiedDiffSchema = type("string");

export class GithubProvider extends PullRequestProvider {
  constructor({ token }: { token: string }) {
    const octokit = new Octokit({ auth: token });
    super("github", {
      readData: async (reference, signal) => {
        const result = await octokit.rest.pulls.get({
          ...pullRequestParameters(reference),
          request: { signal },
        });
        return pullRequestData(result.data);
      },
      readFiles: (reference, signal) =>
        readChangedFiles(octokit, reference, signal),
      readDiff: (reference, signal) =>
        readUnifiedDiff(octokit, reference, signal),
      normalizeError: githubError,
    });
  }
}

async function readChangedFiles(
  octokit: Octokit,
  reference: ProviderPullRequestReference,
  signal: AbortSignal | undefined,
): Promise<PullRequestFile[]> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    ...pullRequestParameters(reference),
    per_page: filePageSize,
    request: { signal },
  });

  if (!Array.isArray(files)) {
    throw new ForgeError(
      "invalid-response",
      "GitHub returned an invalid pull request file list.",
    );
  }

  return files.map((file: GithubPullRequestFile) => pullRequestFile(file));
}

async function readUnifiedDiff(
  octokit: Octokit,
  reference: ProviderPullRequestReference,
  signal: AbortSignal | undefined,
): Promise<string> {
  const result = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      ...pullRequestParameters(reference),
      headers: { accept: "application/vnd.github.v3.diff" },
      request: { signal },
    },
  );
  const diff = unifiedDiffSchema(result.data);

  if (diff instanceof type.errors) {
    throw new ForgeError(
      "invalid-response",
      "GitHub returned an invalid pull request diff.",
      diff,
    );
  }

  return diff;
}

function pullRequestParameters(reference: ProviderPullRequestReference) {
  return {
    owner: reference.owner,
    repo: reference.repository,
    pull_number: reference.number,
  };
}

function githubError(failure: Error): ForgeError {
  if (failure instanceof ForgeError) {
    return failure;
  }
  if (failure instanceof RequestError) {
    return forgeErrorForStatus(
      "GitHub",
      failure.status,
      failure,
      isRateLimitFailure(failure),
    );
  }

  return new ForgeError("unavailable", "GitHub request failed.", failure);
}

function isRateLimitFailure(failure: RequestError): boolean {
  return (
    failure.status === 429 ||
    failure.response?.headers["x-ratelimit-remaining"] === "0" ||
    failure.message.toLowerCase().includes("rate limit")
  );
}
