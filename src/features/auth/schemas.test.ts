import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "./schemas";

describe("signUpSchema", () => {
  it("accepts and normalizes a valid signup", () => {
    const result = signUpSchema.safeParse({
      email: "new@example.com",
      password: "momentum-pass-2026",
      displayName: "  New User  ",
      timezone: "America/New_York",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        email: "new@example.com",
        displayName: "New User",
        timezone: "America/New_York",
      });
    }
  });

  it("canonicalizes a case-insensitive IANA timezone", () => {
    const result = signUpSchema.safeParse({
      email: "new@example.com",
      password: "momentum-pass-2026",
      displayName: "New User",
      timezone: "america/new_york",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/New_York");
    }
  });

  it("rejects malformed signup fields", () => {
    const result = signUpSchema.safeParse({
      email: "bad",
      password: "short",
      displayName: "",
      timezone: "Not/AZone",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        email: ["Enter a valid email address."],
        password: ["Use at least 12 characters."],
        displayName: ["Enter a display name."],
        timezone: ["Choose a valid timezone."],
      });
    }
  });
});

describe("signInSchema", () => {
  it("preserves compatibility with the seeded demo credentials", () => {
    expect(
      signInSchema.safeParse({
        email: "demo@momentum.local",
        password: "momentum-demo",
      }).success,
    ).toBe(true);
  });
});
