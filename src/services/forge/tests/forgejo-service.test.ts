import { describe, expect, test } from "bun:test";
import { ForgejoApi } from "../forgejo-api";
import { ForgejoService } from "../forgejo-service";
import { ForgeKind, PullRequestState } from "../types";
import { createFakeCli, exact, stdout } from "./fake-cli-runner";

import type { Result as ResultType } from "better-result";
import type { HttpFetch } from "../forgejo-api";
import type { CannedCommand, FakeCli } from "./fake-cli-runner";

const kind = ForgeKind.Forgejo;
const cwd = "/repo";
const repositoryUrl = "https://forge.example/o/r";
const diffText = "diff --git a/file b/file\n+hello\n";

const versionCommand: CannedCommand = [exact("--version"), stdout("fj 0.3.0")];
const repositoryCommand: CannedCommand = [
  exact("--json repo view"),
  stdout(JSON.stringify({ full_name: "o/r", html_url: repositoryUrl })),
];

const pullRequestView = {
  number: 9,
  title: "Improve things",
  body: "Details",
  state: "open",
  draft: false,
  merged: false,
  user: { login: "author" },
  html_url: `${repositoryUrl}/pulls/9`,
  comments: 3,
  labels: [],
  assignees: [],
  milestone: null,
  requested_reviewers: [{ login: "reviewer" }],
  requested_reviewers_teams: [{ name: "maintainers" }],
};

const comments = [{ id: 1, user: { login: "commenter" }, body: "Looks good" }];

const apiRoot = "https://forge.example/api/v1/repos/o/r";
const commitsPath = "pulls/9/commits?stat=false&verification=false&files=false";

function apiCommit(sha: string) {
  return {
    sha,
    html_url: `${repositoryUrl}/commit/${sha}`,
    commit: {
      message: `commit ${sha}`,
      author: { date: "2026-01-01T00:00:00Z" },
      committer: { date: "2026-01-02T00:00:00Z" },
    },
    author: { login: "author" },
    committer: null,
  };
}

interface FakeRequest {
  readonly url: string;
  readonly authorization: string | null;
}

/** A Forgejo API that replies from `responses`, keyed by the URL below
 * `apiRoot`, and records every request. Unknown URLs answer 404. */
interface FakeResponse {
  readonly body: string;
  readonly headers?: Record<string, string>;
}

function commitsPage(
  shas: readonly string[],
  headers?: Record<string, string>,
): FakeResponse {
  return { body: JSON.stringify(shas.map(apiCommit)), headers };
}

function fakeApi(responses: Record<string, FakeResponse>, token?: string) {
  const requests: FakeRequest[] = [];
  const fetch: HttpFetch = async (url, init) => {
    requests.push({
      url,
      authorization: new Headers(init.headers).get("authorization"),
    });
    const response = responses[url.slice(apiRoot.length + 1)];
    return response === undefined
      ? new Response("not found", { status: 404 })
      : new Response(response.body, { headers: response.headers });
  };
  return { api: new ForgejoApi(fetch, async () => token), requests };
}

async function forgejoService(
  cli: FakeCli,
  api: ForgejoApi = fakeApi({}).api,
): Promise<ForgejoService> {
  return unwrap(await ForgejoService.initialize(cwd, cli.run, api));
}

function unwrap<T, E>(result: ResultType<T, E>): T {
  if (result.isErr()) {
    throw new Error(`expected Ok, got ${String(result.error)}`);
  }
  return result.value;
}

function expectInvokedAsFj(cli: FakeCli): void {
  expect(cli.calls.length).toBeGreaterThan(0);
  for (const call of cli.calls) {
    expect(call.executable).toBe("fj");
    expect(call.cwd).toBe(cwd);
  }
}

describe("ForgejoService.getPullRequests", () => {
  test("derives merged and open states from the search results", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [
        exact("--json pr search --state open --repo o/r"),
        stdout(
          JSON.stringify([
            {
              number: 1,
              title: "Merged one",
              state: "closed",
              pull_request: { merged: true },
            },
            {
              number: 2,
              title: "Open one",
              state: "open",
              pull_request: { merged: false },
            },
          ]),
        ),
      ],
    ]);
    const service = await forgejoService(cli);

    const list = unwrap(await service.getPullRequests());

    expect(list.repository).toEqual({
      fullName: "o/r",
      owner: "o",
      name: "r",
      url: repositoryUrl,
    });
    expect(list.items.map((item) => item.state)).toEqual([
      PullRequestState.Merged,
      PullRequestState.Open,
    ]);
    expect(list.truncated).toBe(false);
    expectInvokedAsFj(cli);
  });
});

describe("ForgejoService.loadPullRequest", () => {
  test("assembles the document from the view, comments, and diff", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [
        exact("--json pr view 9 --repo o/r"),
        stdout(JSON.stringify(pullRequestView)),
      ],
      [
        exact("--json pr view 9 --repo o/r comments"),
        stdout(JSON.stringify(comments)),
      ],
      [exact("pr view 9 --repo o/r diff"), stdout(diffText)],
    ]);
    const { api } = fakeApi({
      [`${commitsPath}&page=1&limit=50`]: commitsPage(["abc"]),
    });
    const service = await forgejoService(cli, api);

    const document = unwrap(await service.loadPullRequest(9));

    expect(document.details.status).toBe("available");
    if (document.details.status === "available") {
      expect(document.details.value.number).toBe(9);
    }
    expect(document.commits.status).toBe("available");

    const requestedReviewers = document.reviews.requestedReviewers;
    expect(requestedReviewers.status).toBe("available");
    if (requestedReviewers.status === "available") {
      expect(requestedReviewers.value.users.map((user) => user.login)).toEqual([
        "reviewer",
      ]);
      expect(requestedReviewers.value.teams.map((team) => team.name)).toEqual([
        "maintainers",
      ]);
    }

    expect(document.comments.status).toBe("available");
    if (document.comments.status === "available") {
      expect(document.comments.value).toHaveLength(1);
      expect(document.comments.truncated).toBe(true);
    }

    expect(document.diff.status).toBe("available");
    if (document.diff.status === "available") {
      expect(document.diff.value.text).toBe(diffText);
    }
    expectInvokedAsFj(cli);
  });
});

describe("ForgejoApi", () => {
  test("follows x-hasmore across commit pages with the stored token", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [
        exact("--json pr view 9 --repo o/r"),
        stdout(JSON.stringify(pullRequestView)),
      ],
    ]);
    const { api, requests } = fakeApi(
      {
        [`${commitsPath}&page=1&limit=50`]: commitsPage(["a1"], {
          "x-hasmore": "true",
        }),
        [`${commitsPath}&page=2&limit=50`]: commitsPage(["b2"]),
      },
      "secret",
    );
    const service = await forgejoService(cli, api);

    const document = unwrap(await service.loadPullRequest(9));

    expect(document.commits).toEqual({
      status: "available",
      truncated: false,
      value: ["a1", "b2"].map((sha) => ({
        sha,
        message: `commit ${sha}`,
        author: { login: "author" },
        committer: null,
        authoredAt: "2026-01-01T00:00:00Z",
        committedAt: "2026-01-02T00:00:00Z",
        url: `${repositoryUrl}/commit/${sha}`,
      })),
    });
    expect(requests.map((request) => request.authorization)).toEqual([
      "token secret",
      "token secret",
    ]);
  });

  test("reports a failed status as a failed commits section", async () => {
    const cli = createFakeCli(kind, [versionCommand, repositoryCommand]);
    const service = await forgejoService(cli);

    const document = unwrap(await service.loadPullRequest(9));

    expect(document.commits.status).toBe("failed");
    if (document.commits.status === "failed") {
      expect(document.commits.error).toMatchObject({
        _tag: "ForgeRequestFailedError",
        status: 404,
      });
    }
  });

  test("loads a single commit patch", async () => {
    const cli = createFakeCli(kind, [versionCommand, repositoryCommand]);
    const { api } = fakeApi({
      "git/commits/abc1234.diff": { body: diffText },
    });
    const service = await forgejoService(cli, api);

    const patch = unwrap(await service.getCommitPatch("abc1234"));

    expect(patch).toEqual({
      status: "available",
      value: { text: diffText },
      truncated: false,
    });
  });
});
