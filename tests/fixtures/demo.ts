export const DEMO = {
  userId: "10000000-0000-4000-8000-000000000001",
  teammateId: "10000000-0000-4000-8000-000000000002",
  workspaceId: "20000000-0000-4000-8000-000000000001",
  projectId: "30000000-0000-4000-8000-000000000001",
  candidateTaskId: "40000000-0000-4000-8000-000000000001",
  dueSoonTaskId: "40000000-0000-4000-8000-000000000002",
  email: "demo@momentum.local",
  password: "momentum-demo",
  teammateEmail: "teammate@momentum.local",
  teammatePassword: "momentum-demo",
} as const;

export const DEMO_COMPLETION_ACHIEVEMENT_CODES = [
  "momentum_three",
  "ahead_of_schedule",
] as const;

const NEW_YORK_TIMEZONE = "America/New_York";

function dateParts(instant: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

export function demoWorkdayInstant(now = new Date()): Date {
  const parts = dateParts(now);
  const cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 17));

  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return cursor;
}

export function demoNudgeDueAt(scanAt = demoWorkdayInstant()): Date {
  return new Date(scanAt.getTime() + 12 * 60 * 60 * 1000);
}
