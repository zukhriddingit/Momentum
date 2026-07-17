import { describe, expect, it } from "vitest";

import { resolveRequestNow } from "./clock";

const systemNow = new Date("2026-07-17T15:00:00.000Z");
const requestedNow = "2026-07-20T17:00:00.000Z";

describe("trusted request clock", () => {
  it.each(["local", "preview", "production"] as const)(
    "ignores the test header in %s even when the flag is mis-scoped",
    (environment) => {
      expect(
        resolveRequestNow({
          environment,
          allowTestClock: true,
          testNow: requestedNow,
          systemNow,
        }),
      ).toBe(systemNow);
    },
  );

  it("accepts a valid test clock only in the test environment", () => {
    expect(
      resolveRequestNow({
        environment: "test",
        allowTestClock: true,
        testNow: requestedNow,
        systemNow,
      }).toISOString(),
    ).toBe(requestedNow);
  });

  it("falls back for a disabled or invalid test clock", () => {
    expect(
      resolveRequestNow({
        environment: "test",
        allowTestClock: false,
        testNow: requestedNow,
        systemNow,
      }),
    ).toBe(systemNow);
    expect(
      resolveRequestNow({
        environment: "test",
        allowTestClock: true,
        testNow: "not-a-date",
        systemNow,
      }),
    ).toBe(systemNow);
  });
});
