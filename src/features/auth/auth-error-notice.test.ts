import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-error-notice";

describe("getAuthErrorMessage", () => {
  it.each([
    ["github-start", "GitHub sign-in could not start. Please try again."],
    [
      "github-code",
      "GitHub did not return a usable sign-in. Please try again.",
    ],
    [
      "github-claim",
      "We signed you in, but could not connect your pending work yet. Please try GitHub again.",
    ],
  ])("maps %s to supportive public copy", (code, expected) => {
    expect(getAuthErrorMessage(code)).toBe(expected);
  });

  it.each([undefined, "", "unknown", "github-claim?raw=secret"])(
    "does not disclose an unknown error code: %s",
    (code) => {
      expect(getAuthErrorMessage(code)).toBeNull();
    },
  );
});
