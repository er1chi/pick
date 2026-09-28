import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readChangedFiles, readCommits, readWorkingTreePatch } from "../local";

let repo: string;

function git(...args: string[]): void {
  gitIn(repo, ...args);
}

function gitIn(cwd: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
  }
}

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), "pick-branches-"));
  git("init", "-q", "-b", "main");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "init",
  );
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "local work",
  );
});

afterAll(() => rm(repo, { recursive: true, force: true }));

describe("local repository reads", () => {
  test("lists the branch's commits and marks which are pushed", async () => {
    const commits = (await readCommits(repo)).unwrap();

    expect(commits.map(({ message, pushed }) => ({ message, pushed }))).toEqual(
      [
        { message: "local work", pushed: false },
        { message: "init", pushed: true },
      ],
    );
  });
});

describe("working tree changes", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "pick-changes-"));
    const commit = ["-c", "user.name=t", "-c", "user.email=t@t", "commit"];
    await writeFile(join(dir, "edited.txt"), "a\n");
    await writeFile(join(dir, "old-name.txt"), "b\n");
    gitIn(dir, "init", "-q", "-b", "main");
    gitIn(dir, "add", ".");
    gitIn(dir, ...commit, "-q", "-m", "init");
    await writeFile(join(dir, "edited.txt"), "a2\n");
    gitIn(dir, "mv", "old-name.txt", "new-name.txt");
    await mkdir(join(dir, "docs"));
    await writeFile(join(dir, "docs", "draft.md"), "draft\n");
  });

  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("lists staged, unstaged, renamed, and untracked paths", async () => {
    const paths = (await readChangedFiles(dir)).unwrap();

    expect(paths).toEqual(["edited.txt", "new-name.txt", "docs/draft.md"]);
  });

  test("patches tracked edits against HEAD and untracked files as additions", async () => {
    const patch = (await readWorkingTreePatch(dir)).unwrap();

    expect(patch).toContain("diff --git a/edited.txt b/edited.txt");
    expect(patch).toContain("+a2");
    expect(patch).toContain("rename to new-name.txt");
    expect(patch).toContain("diff --git a/docs/draft.md b/docs/draft.md");
    expect(patch).toContain("+draft");
  });
});
