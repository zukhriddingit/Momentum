import type { UserIdentity } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { extractVerifiedGitHubIdentity } from "./github-identity";

function githubIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    provider: "github",
    id: "227412781",
    identity_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    identity_data: {
      user_name: "KPerpignant",
      full_name: "Kim Perpignant",
    },
    created_at: "2026-07-18T12:00:00.000Z",
    updated_at: "2026-07-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("extractVerifiedGitHubIdentity", () => {
  it("extracts the stable provider ID and normalized verified handle", () => {
    expect(extractVerifiedGitHubIdentity([githubIdentity()])).toEqual({
      githubUserId: "227412781",
      githubHandle: "kperpignant",
      displayName: "Kim Perpignant",
    });
  });

  it("accepts verified GitHub preferred_username and name metadata fallbacks", () => {
    expect(
      extractVerifiedGitHubIdentity([
        githubIdentity({
          identity_data: {
            preferred_username: "RAVEN-dubgub",
            name: "  Raven Builder  ",
          },
        }),
      ]),
    ).toEqual({
      githubUserId: "227412781",
      githubHandle: "raven-dubgub",
      displayName: "Raven Builder",
    });
  });

  it.each([
    undefined,
    [],
    [githubIdentity({ provider: "email" })],
    [githubIdentity({ id: "not-a-number" })],
    [githubIdentity({ id: "0" })],
    [githubIdentity({ identity_data: { user_name: "two--hyphens" } })],
    [githubIdentity({ identity_data: {} })],
  ])("rejects identities without verified GitHub data", (identities) => {
    expect(() => extractVerifiedGitHubIdentity(identities)).toThrow(
      "A verified GitHub identity is required.",
    );
  });
});
