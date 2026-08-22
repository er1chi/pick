import { describe, expect, test } from "bun:test";
import { conflictDisplayRows } from "./conflict-lines";

describe("conflictDisplayRows", () => {
  test("keeps ordinary file lines outside any conflict", () => {
    const rows = conflictDisplayRows({
      name: "plain.ts",
      contents: "alpha\nbeta\n",
    });

    expect(rows.map((row) => [row.kind, row.text])).toEqual([
      ["file", "alpha"],
      ["file", "beta"],
    ]);
  });

  test("labels two-way conflict bodies and markers", () => {
    const rows = conflictDisplayRows({
      name: "two-way.ts",
      contents: `keep
<<<<<<< HEAD
left-hand
=======
right-hand
>>>>>>> other
keep
`,
    });

    expect(rows.map((row) => [row.kind, row.text])).toEqual([
      ["file", "keep"],
      ["conflict-marker", "<<<<<<< HEAD"],
      ["conflict-current", "left-hand"],
      ["conflict-marker", "======="],
      ["conflict-incoming", "right-hand"],
      ["conflict-marker", ">>>>>>> other"],
      ["file", "keep"],
    ]);
  });

  test("labels the optional base side of a three-way conflict", () => {
    const rows = conflictDisplayRows({
      name: "three-way.ts",
      contents: `<<<<<<< ours
current-change
||||||| merged common ancestors
original
=======
incoming-change
>>>>>>> theirs
`,
    });

    expect(rows.map((row) => [row.kind, row.text])).toEqual([
      ["conflict-marker", "<<<<<<< ours"],
      ["conflict-current", "current-change"],
      ["conflict-marker", "||||||| merged common ancestors"],
      ["conflict-base", "original"],
      ["conflict-marker", "======="],
      ["conflict-incoming", "incoming-change"],
      ["conflict-marker", ">>>>>>> theirs"],
    ]);
  });
});
