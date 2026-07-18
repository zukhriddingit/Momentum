import { describe, expect, it, vi } from "vitest";

import {
  loadCohortDirectory,
  resolveCohortParticipantWith,
} from "./github-directory";

describe("GitHub cohort directory", () => {
  it("returns validated live entries", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            html_url:
              "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
            state: "open",
            merged_at: null,
            head: {
              ref: "participants/summer26/phase-1-project-1/kperpignant",
            },
            user: {
              id: 227412781,
              login: "kperpignant",
              html_url: "https://github.com/kperpignant",
            },
          },
        ]),
        { status: 200 },
      ),
    );

    const result = await loadCohortDirectory({
      fetcher,
      forceSnapshot: false,
    });

    expect(result.source).toBe("github");
    expect(result.entries[0]?.githubUserId).toBe("227412781");
  });

  it("uses the committed snapshot after an upstream failure", async () => {
    const result = await loadCohortDirectory({
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
      forceSnapshot: false,
    });

    expect(result.source).toBe("snapshot");
    expect(
      result.entries.some((entry) => entry.githubHandle === "kperpignant"),
    ).toBe(true);
  });

  it("resolves a real exact handle when it is absent from the directory", async () => {
    const entry = await resolveCohortParticipantWith("octocat", {
      directory: {
        entries: [],
        source: "snapshot",
        synchronizedAt: "2026-07-18T18:08:40Z",
      },
      fetcher: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 583231,
            login: "octocat",
            html_url: "https://github.com/octocat",
            name: "The Octocat",
          }),
          { status: 200 },
        ),
      ),
    });

    expect(entry).toMatchObject({
      githubUserId: "583231",
      githubHandle: "octocat",
    });
  });
});
