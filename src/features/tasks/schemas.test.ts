import { describe, expect, it } from "vitest";

import { taskInputSchema } from "@/features/tasks/schemas";

const validInput = {
  projectId: crypto.randomUUID(),
  title: "Write brief",
  description: "Describe the launch",
  assignee: { kind: "member", userId: crypto.randomUUID() },
  effort: "medium",
  dueAt: "2026-07-20T16:00:00.000Z",
  status: "todo",
} as const;

describe("taskInputSchema", () => {
  it("accepts every editable task field and trims text", () => {
    expect(
      taskInputSchema.parse({
        ...validInput,
        title: "  Write brief  ",
        description: "  Describe the launch  ",
      }),
    ).toEqual(validInput);
  });

  it("accepts active members and pending cohort seats", () => {
    const userId = crypto.randomUUID();
    const seatId = crypto.randomUUID();

    expect(
      taskInputSchema.parse({
        ...validInput,
        assignee: { kind: "member", userId },
      }).assignee,
    ).toEqual({ kind: "member", userId });
    expect(
      taskInputSchema.parse({
        ...validInput,
        assignee: { kind: "cohort", seatId },
      }).assignee,
    ).toEqual({ kind: "cohort", seatId });
  });

  it.each(["", "   ", null] as const)(
    "normalizes an empty description to null",
    (description) => {
      expect(
        taskInputSchema.parse({ ...validInput, description }).description,
      ).toBeNull();
    },
  );

  it.each(["", "   ", null] as const)(
    "normalizes an empty deadline to null",
    (dueAt) => {
      expect(taskInputSchema.parse({ ...validInput, dueAt }).dueAt).toBeNull();
    },
  );

  it("rejects malformed IDs, title, deadline, effort, and status", () => {
    for (const invalidInput of [
      { ...validInput, projectId: "project" },
      { ...validInput, assignee: { kind: "member", userId: "assignee" } },
      { ...validInput, assignee: { kind: "cohort", seatId: "seat" } },
      {
        ...validInput,
        assignee: { kind: "member", seatId: crypto.randomUUID() },
      },
      {
        ...validInput,
        assignee: { kind: "cohort", userId: crypto.randomUUID() },
      },
      { ...validInput, assignee: { kind: "unknown", id: crypto.randomUUID() } },
      { ...validInput, title: "" },
      { ...validInput, title: "x".repeat(201) },
      { ...validInput, dueAt: "tomorrow" },
      { ...validInput, effort: "huge" },
      { ...validInput, status: "blocked" },
    ]) {
      expect(taskInputSchema.safeParse(invalidInput).success).toBe(false);
    }
  });

  it("does not accept trusted completion or reward fields", () => {
    const result = taskInputSchema.parse({
      ...validInput,
      points: 1_000,
      firstCompletedAt: "2026-07-15T16:00:00.000Z",
      currentStreak: 99,
      role: "owner",
    });

    expect(result).toEqual(validInput);
  });
});
