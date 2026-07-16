export type DeadlineEvent = "deadline_approaching" | "overdue_recovery";

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyDeadlineEvent(input: {
  now: Date;
  dueAt: Date;
}): DeadlineEvent | null {
  const nowMs = input.now.getTime();
  const dueMs = input.dueAt.getTime();

  if (Number.isNaN(nowMs) || Number.isNaN(dueMs)) {
    throw new RangeError("Deadline classification requires valid dates.");
  }

  if (dueMs <= nowMs) {
    return "overdue_recovery";
  }

  if (dueMs <= nowMs + DAY_MS) {
    return "deadline_approaching";
  }

  return null;
}
