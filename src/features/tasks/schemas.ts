import { z } from "zod";

const nullableTrimmedText = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().nullable());

const nullableIsoDateTime = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.union([z.iso.datetime({ offset: true }), z.null()]),
);

export const taskInputSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: nullableTrimmedText,
  assignee: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("member"), userId: z.uuid() }),
    z.object({ kind: z.literal("cohort"), seatId: z.uuid() }),
  ]),
  effort: z.enum(["small", "medium", "large", "extra_large"]),
  dueAt: nullableIsoDateTime,
  status: z.enum(["todo", "in_progress", "done"]),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
