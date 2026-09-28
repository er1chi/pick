import { describe, expect, test } from "bun:test";
import { pullRequestViewId } from "./view-context";

describe("pullRequestViewId", () => {
  test("keeps repositories apart when names contain dashes", () => {
    expect(pullRequestViewId({ owner: "a-b", name: "c" }, 1)).not.toBe(
      pullRequestViewId({ owner: "a", name: "b-c" }, 1),
    );
  });
});
