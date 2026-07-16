import { z } from "zod";

export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter a workspace name." })
    .max(120, { error: "Keep the workspace name to 120 characters or fewer." }),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;
