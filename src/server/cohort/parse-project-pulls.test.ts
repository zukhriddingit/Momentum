import { describe, expect, it } from "vitest";

import { parseProjectOnePulls } from "./parse-project-pulls";

const pull = (overrides: Record<string, unknown> = {}) => ({
  html_url:
    "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
  state: "open",
  merged_at: null,
  head: { ref: "participants/summer26/phase-1-project-1/kperpignant" },
  user: {
    id: 227412781,
    login: "kperpignant",
    html_url: "https://github.com/kperpignant",
  },
  ...overrides,
});

describe("parseProjectOnePulls", () => {
  it("keeps open and merged participant submissions and deduplicates stable IDs", () => {
    const entries = parseProjectOnePulls([
      pull(),
      pull({ state: "closed", merged_at: "2026-07-18T12:23:12Z" }),
      pull({ state: "closed", merged_at: null }),
      pull({
        head: { ref: "participants/summer26/phase-1-project-2/kperpignant" },
      }),
      pull({
        head: { ref: "participants/summer26/phase-1-project-1/someone-else" },
      }),
    ]);

    expect(entries).toEqual([
      {
        githubUserId: "227412781",
        githubHandle: "kperpignant",
        profileUrl: "https://github.com/kperpignant",
        sourcePullRequestUrl:
          "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
        displayName: null,
      },
    ]);
  });

  it("rejects malformed upstream payloads", () => {
    expect(() => parseProjectOnePulls({ message: "rate limited" })).toThrow(
      "GitHub pull-request payload was invalid.",
    );
  });
});
