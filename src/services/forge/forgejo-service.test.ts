import { describe, expect, test } from "bun:test";
import { createFakeCli, exact, stdout } from "./fake-cli-runner";
import { ForgejoService } from "./forgejo-service";
import { ApplicationContext, PullRequestState } from "./types";

import type { Result as ResultType } from "better-result";
import type { CannedCommand, FakeCli } from "./fake-cli-runner";

const kind = ApplicationContext.Forgejo;
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

async function forgejoService(cli: FakeCli): Promise<ForgejoService> {
  return unwrap(await ForgejoService.initialize(cwd, cli.run));
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
      [exact("--json pr view 9 --repo o/r diff"), stdout(diffText)],
    ]);
    const service = await forgejoService(cli);

    const document = unwrap(await service.loadPullRequest(9));

    expect(unwrap(document.details).number).toBe(9);
    expect(document.commits.status).toBe("unsupported");

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

    const overview = unwrap(document.overview);
    expect(overview.conversationComments.status).toBe("available");
    if (overview.conversationComments.status === "available") {
      expect(overview.conversationComments.value).toHaveLength(1);
      expect(overview.conversationComments.truncated).toBe(true);
    }

    expect(document.diff.status).toBe("available");
    if (document.diff.status === "available") {
      expect(document.diff.value.text).toBe(diffText);
    }
    expectInvokedAsFj(cli);
  });
});
