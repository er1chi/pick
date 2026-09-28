import { parsePatchFiles } from "@pierre/diffs";
import { describe, expect, test } from "bun:test";
import { highlightSplitRows } from "./highlight";
import { splitRows } from "./split-rows";

const patch = `diff --git a/view.ts b/view.ts
index 1111111..2222222 100644
--- a/view.ts
+++ b/view.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 /**
@@ -10,2 +11,3 @@
 function close(): void {}
+function open(): void {}
 const c = 3;
`;

describe("highlightSplitRows", () => {
  test("resets grammar state at each hunk", async () => {
    const fileDiff = parsePatchFiles(patch).flatMap((entry) => entry.files)[0];
    if (fileDiff === undefined) {
      throw new Error("patch did not parse");
    }
    const rows = splitRows(fileDiff);
    const tokens = await highlightSplitRows(fileDiff, rows);
    const right = tokens?.right ?? [];
    const comment = right[2]?.[0]?.color;
    const afterBoundary = right[3]?.find((token) => token.content === "close");

    expect(right[2]?.map((token) => token.content).join("")).toBe("/**");
    expect(afterBoundary).toBeDefined();
    expect(afterBoundary?.color).not.toBe(comment);
  });
});
