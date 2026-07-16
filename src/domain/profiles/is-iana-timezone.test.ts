import { describe, expect, it } from "vitest";

import { isIanaTimezone, normalizeIanaTimezone } from "./is-iana-timezone";

describe("isIanaTimezone", () => {
  it.each(["America/New_York", "Asia/Tokyo", "UTC"])(
    "accepts %s",
    (timezone) => {
      expect(isIanaTimezone(timezone)).toBe(true);
    },
  );

  it.each(["Mars/Olympus_Mons", "", "New_York"])("rejects %s", (timezone) => {
    expect(isIanaTimezone(timezone)).toBe(false);
  });

  it("normalizes accepted identifiers to their canonical form", () => {
    expect(normalizeIanaTimezone("america/new_york")).toBe("America/New_York");
    expect(normalizeIanaTimezone("Mars/Olympus_Mons")).toBeNull();
  });
});
