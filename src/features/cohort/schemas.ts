import { z } from "zod";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";

export const addCohortSeatSchema = z.object({
  workspaceId: z.uuid(),
  githubHandle: z.string().transform((value, context) => {
    const normalized = normalizeGitHubHandle(value);
    if (normalized === null) {
      context.addIssue({
        code: "custom",
        message: "Enter a valid GitHub username.",
      });
      return z.NEVER;
    }
    return normalized;
  }),
});
