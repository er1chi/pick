import { describe, expect, test } from "bun:test";
import { available, unsupported } from "@/services/forge/section";
import { formatPresentTimestamp } from "@/utils/format-timestamp";
import { patchFileIndex } from "../../utils/patch-file-index";
import { commitMetaLine } from "../../utils/pr-view-display";

import type {
  PullRequestCommit,
  PullRequestPatch,
} from "@/services/forge/types";

const patchText = `diff --git a/one.txt b/one.txt
index 1111111..2222222 100644
--- a/one.txt
+++ b/one.txt
@@ -1,2 +1,3 @@
 keep
-removed
+added-one
+added-two
diff --git a/two.txt b/two.txt
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/two.txt
@@ -0,0 +1 @@
+added-three
`;

function availablePatch(text: string) {
  return available<PullRequestPatch>({
    format: "git-patch",
    text,
    byteLength: text.length,
  });
}

const commit: PullRequestCommit = {
  sha: "abcdef1234567890abcdef1234567890abcdef12",
  message: "adjust files",
  author: {
    id: null,
    login: "alice",
    displayName: null,
    url: null,
  },
  committer: null,
  authoredAt: null,
  committedAt: "2026-01-15T12:00:00.000Z",
  url: null,
};

describe("patchFileIndex counts", () => {
  test("sums added and removed lines across files", () => {
    const section = availablePatch(patchText);
    expect(patchFileIndex(section).counts).toEqual({
      additions: 3,
      deletions: 1,
    });
    expect(patchFileIndex(undefined).counts).toEqual({
      additions: 0,
      deletions: 0,
    });
    expect(patchFileIndex(unsupported("no patch")).counts).toEqual({
      additions: 0,
      deletions: 0,
    });

    const date = formatPresentTimestamp(commit.committedAt);
    const counts = { additions: 3, deletions: 1 };
    expect(commitMetaLine(commit, counts)).toBe(
      `abcdef123456 · +3 -1 · alice · ${date}`,
    );
    expect(commitMetaLine(commit)).toBe(`abcdef123456 · alice · ${date}`);
  });
});
