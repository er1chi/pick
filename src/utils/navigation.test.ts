import { describe, expect, test } from "bun:test";
import { moveInList, wrapIndex } from "./navigation";

describe("wrapIndex", () => {
  test("wraps in both directions", () => {
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(-6, 5)).toBe(4);
  });

  test("rejects empty collections", () => {
    expect(() => wrapIndex(0, 0)).toThrow(RangeError);
  });
});

describe("moveInList", () => {
  test("moves circularly through values", () => {
    const items = ["alpha", "beta", "gamma"] as const;

    expect(moveInList(items, "gamma", 1)).toBe("alpha");
    expect(moveInList(items, "alpha", -1)).toBe("gamma");
  });
});
