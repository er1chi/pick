import { describe, expect, test } from "bun:test";
import { ForgeCli } from "../forge-cli";
import { GithubService } from "../github-service";
import {
  ForgeKind,
  ForgeCommandFailedError,
  ForgeCommandSpawnFailedError,
  ForgeExecutableUnavailableError,
  ForgeInvalidJsonError,
  ForgeVersionCheckFailedError,
} from "../types";
import { createFakeCli, exact, fails, prefix, stdout } from "./fake-cli-runner";

import type { Result as ResultType } from "better-result";
import type { CannedCommand, FakeCli } from "./fake-cli-runner";

const kind = ForgeKind.GitHub;
const cwd = "/repo";
const repository = { fullName: "o/r", owner: "o", name: "r" };
const repositoryUrl = "https://github.com/o/r";
const diffText = "diff --git a/file b/file\n+héllo\n";

const versionCommand: CannedCommand = [
  exact("--version"),
  stdout("gh version 2.0.0"),
];
const repositoryCommand: CannedCommand = [
  exact("repo view --json nameWithOwner,url"),
  stdout(JSON.stringify({ nameWithOwner: "o/r", url: repositoryUrl })),
];

function listItem(number: number) {
  return {
    number,
    title: `Pull request ${number}`,
    state: "OPEN",
    isDraft: false,
    author: { login: "octocat" },
    url: `${repositoryUrl}/pull/${number}`,
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const pullRequestView = {
  number: 7,
  body: "Adds a thing",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  closedAt: null,
  mergedAt: null,
  mergedBy: null,
  baseRefName: "main",
  baseRefOid: "aaaaaaa",
  headRefName: "feature",
  headRefOid: "bbbbbbb",
  headRepository: null,
  additions: 1,
  deletions: 2,
  changedFiles: 3,
  labels: [],
  assignees: [],
  milestone: null,
  maintainerCanModify: true,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: null,
  mergeCommit: null,
  statusCheckRollup: null,
  projectItems: null,
  projectCards: null,
  closingIssuesReferences: null,
};

const commitPages = [
  [
    {
      sha: "ccccccc",
      commit: {
        message: "Add a thing",
        author: { name: "Octo", email: "octo@example.com", date: null },
        committer: null,
      },
      author: { login: "octocat" },
      committer: null,
      html_url: `${repositoryUrl}/commit/ccccccc`,
    },
  ],
];

const emptyPages = stdout(JSON.stringify([[]]));
const paginatedCommands: readonly CannedCommand[] = [
  [
    exact("api --paginate --slurp repos/o/r/pulls/7/commits"),
    stdout(JSON.stringify(commitPages)),
  ],
  [exact("api --paginate --slurp repos/o/r/issues/7/comments"), emptyPages],
  [exact("api --paginate --slurp repos/o/r/pulls/7/reviews"), emptyPages],
  [exact("api --paginate --slurp repos/o/r/pulls/7/comments"), emptyPages],
  [
    exact("api repos/o/r/pulls/7/requested_reviewers"),
    stdout(JSON.stringify({ users: [], teams: [] })),
  ],
  [exact("pr diff 7 --repo o/r --color never"), stdout(diffText)],
];

async function githubService(cli: FakeCli): Promise<GithubService> {
  return unwrap(await GithubService.initialize(cwd, cli.run));
}

function unwrap<T, E>(result: ResultType<T, E>): T {
  if (result.isErr()) {
    throw new Error(`expected Ok, got ${String(result.error)}`);
  }
  return result.value;
}

function expectInvokedAsGh(cli: FakeCli): void {
  expect(cli.calls.length).toBeGreaterThan(0);
  for (const call of cli.calls) {
    expect(call.executable).toBe("gh");
    expect(call.cwd).toBe(cwd);
  }
}

describe("GithubService.getPullRequests", () => {
  test("truncates to the limit and reports truncation", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [
        prefix("pr list "),
        stdout(JSON.stringify([listItem(1), listItem(2), listItem(3)])),
      ],
    ]);
    const service = await githubService(cli);

    const list = unwrap(await service.getPullRequests({ limit: 2 }));

    expect(list.items.map((item) => item.number)).toEqual([1, 2]);
    expect(list.truncated).toBe(true);
    expect(list.repository).toEqual({ ...repository, url: repositoryUrl });

    const [listCall] = cli.callsMatching("pr list ");
    expect(listCall).toBeDefined();
    const limitIndex = listCall?.args.indexOf("--limit") ?? -1;
    expect(limitIndex).toBeGreaterThan(-1);
    expect(listCall?.args[limitIndex + 1]).toBe("3");
    expectInvokedAsGh(cli);
  });

  test("reports malformed list output as invalid JSON", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [prefix("pr list "), stdout("{not json")],
    ]);
    const service = await githubService(cli);

    const list = await service.getPullRequests();

    expect(list.isErr()).toBe(true);
    if (list.isErr()) {
      expect(ForgeInvalidJsonError.is(list.error)).toBe(true);
    }
  });
});

describe("GithubService.loadPullRequest", () => {
  test("assembles the document from the view, pages, and diff", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [
        prefix("pr view 7 --repo o/r --json "),
        stdout(JSON.stringify(pullRequestView)),
      ],
      ...paginatedCommands,
    ]);
    const service = await githubService(cli);

    const document = unwrap(await service.loadPullRequest(7));

    expect(document.details.status).toBe("available");
    if (document.details.status === "available") {
      expect(document.details.value.number).toBe(7);
    }
    expect(document.checks).toEqual({
      status: "available",
      value: [],
      truncated: false,
    });
    expect(document.commits.status).toBe("available");
    if (document.commits.status === "available") {
      expect(document.commits.value.map((commit) => commit.sha)).toEqual([
        "ccccccc",
      ]);
    }
    expect(document.diff.status).toBe("available");
    if (document.diff.status === "available") {
      expect(document.diff.value.text).toBe(diffText);
    }
    expectInvokedAsGh(cli);
  });

  test("keeps independent sections when the view fails", async () => {
    const cli = createFakeCli(kind, [
      versionCommand,
      repositoryCommand,
      [
        prefix("pr view 7 "),
        fails(
          new ForgeCommandFailedError({
            kind,
            exitCode: 1,
            message: "pull request not found",
          }),
        ),
      ],
      ...paginatedCommands,
    ]);
    const service = await githubService(cli);

    const document = unwrap(await service.loadPullRequest(7));

    expect(document.details.status).toBe("failed");
    expect(document.checks.status).toBe("failed");
    expect(document.development.projects.status).toBe("failed");
    expect(document.diff.status).toBe("available");
  });
});

describe("ForgeCli.initialize", () => {
  test("maps a spawn failure to an unavailable executable", async () => {
    const cli = createFakeCli(kind, [
      [
        exact("--version"),
        fails(new ForgeCommandSpawnFailedError({ kind, message: "ENOENT" })),
      ],
    ]);

    const initialized = await ForgeCli.initialize(kind, "gh", cwd, cli.run);

    expect(initialized.isErr()).toBe(true);
    if (initialized.isErr()) {
      expect(ForgeExecutableUnavailableError.is(initialized.error)).toBe(true);
    }
  });

  test("maps a failing version command to a version check failure", async () => {
    const cli = createFakeCli(kind, [
      [
        exact("--version"),
        fails(
          new ForgeCommandFailedError({ kind, exitCode: 2, message: "boom" }),
        ),
      ],
    ]);

    const initialized = await ForgeCli.initialize(kind, "gh", cwd, cli.run);

    expect(initialized.isErr()).toBe(true);
    if (initialized.isErr()) {
      const error = initialized.error;
      expect(ForgeVersionCheckFailedError.is(error)).toBe(true);
      if (ForgeVersionCheckFailedError.is(error)) {
        expect(ForgeCommandFailedError.is(error.cause)).toBe(true);
        if (ForgeCommandFailedError.is(error.cause)) {
          expect(error.cause.exitCode).toBe(2);
        }
      }
    }
  });

  test("returns a ready cli when the version command succeeds", async () => {
    const cli = createFakeCli(kind, [versionCommand]);

    const initialized = await ForgeCli.initialize(kind, "gh", cwd, cli.run);

    expect(initialized.isOk()).toBe(true);
    expect(cli.calls).toEqual([{ executable: "gh", cwd, args: ["--version"] }]);
  });
});
