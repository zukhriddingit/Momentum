import { describe, expect, it } from "vitest";

import { normalizeGitHubHandle } from "./github-handle";

describe("normalizeGitHubHandle", () => {
  it.each([
    [" KPerpignant ", "kperpignant"],
    ["RAVEN-dubgub", "raven-dubgub"],
    ["a", "a"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeGitHubHandle(input)).toBe(expected);
  });

  it.each([
    "",
    "-starts",
    "ends-",
    "two--hyphens",
    "has space",
    "x".repeat(40),
  ])("rejects %s", (input) => expect(normalizeGitHubHandle(input)).toBeNull());
});
