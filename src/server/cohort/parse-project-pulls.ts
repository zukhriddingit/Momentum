import { z } from "zod";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import type { CohortDirectoryEntry } from "@/server/cohort/types";

const PROJECT_BRANCH = "participants/summer26/phase-1-project-1/";
const pullSchema = z.array(
  z.object({
    html_url: z.url(),
    state: z.enum(["open", "closed"]),
    merged_at: z.iso.datetime().nullable(),
    head: z.object({ ref: z.string() }),
    user: z
      .object({
        id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        login: z.string(),
        html_url: z.url(),
      })
      .nullable(),
  }),
);

export function parseProjectOnePulls(payload: unknown): CohortDirectoryEntry[] {
  const parsed = pullSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TypeError("GitHub pull-request payload was invalid.");
  }

  const byId = new Map<string, CohortDirectoryEntry>();
  for (const pull of parsed.data) {
    if (pull.state === "closed" && pull.merged_at === null) continue;
    if (!pull.head.ref.startsWith(PROJECT_BRANCH) || !pull.user) continue;

    const branchHandle = normalizeGitHubHandle(
      pull.head.ref.slice(PROJECT_BRANCH.length),
    );
    const authorHandle = normalizeGitHubHandle(pull.user.login);
    if (!branchHandle || branchHandle !== authorHandle) continue;

    const githubUserId = String(pull.user.id);
    if (!byId.has(githubUserId)) {
      byId.set(githubUserId, {
        githubUserId,
        githubHandle: authorHandle,
        profileUrl: pull.user.html_url,
        sourcePullRequestUrl: pull.html_url,
        displayName: null,
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.githubHandle.localeCompare(b.githubHandle),
  );
}
