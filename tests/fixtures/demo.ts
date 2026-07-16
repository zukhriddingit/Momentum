export const DEMO = {
  userId: "10000000-0000-4000-8000-000000000001",
  workspaceId: "20000000-0000-4000-8000-000000000001",
  projectId: "30000000-0000-4000-8000-000000000001",
  candidateTaskId: "40000000-0000-4000-8000-000000000001",
  email: "demo@momentum.local",
  password: "momentum-demo",
} as const;

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
