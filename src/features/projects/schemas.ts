import { z } from "zod";

const nullableDescription = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().nullable());

export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter a project name." })
    .max(140, { error: "Keep the project name to 140 characters or fewer." }),
  description: nullableDescription,
});

export const createProjectSchema = projectSchema.extend({
  workspaceId: z.uuid(),
});

export const updateProjectSchema = projectSchema.extend({
  projectId: z.uuid(),
});

export type ProjectInput = z.infer<typeof projectSchema>;
