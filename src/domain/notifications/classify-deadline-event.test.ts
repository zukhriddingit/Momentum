import { describe, expect, it } from "vitest";

import { classifyDeadlineEvent } from "@/domain/notifications/classify-deadline-event";

const addMilliseconds = (date: Date, milliseconds: number) =>
  new Date(date.getTime() + milliseconds);
const addHours = (date: Date, hours: number) =>
  addMilliseconds(date, hours * 60 * 60 * 1000);

describe("classifyDeadlineEvent", () => {
  const now = new Date("2026-07-16T14:00:00.000Z");

  it("uses exact inclusive due-soon and overdue boundaries", () => {
    expect(classifyDeadlineEvent({ now, dueAt: addHours(now, 24) })).toBe(
      "deadline_approaching",
    );
    expect(classifyDeadlineEvent({ now, dueAt: addMilliseconds(now, 1) })).toBe(
      "deadline_approaching",
    );
    expect(classifyDeadlineEvent({ now, dueAt: now })).toBe("overdue_recovery");
    expect(
      classifyDeadlineEvent({ now, dueAt: addMilliseconds(now, -1) }),
    ).toBe("overdue_recovery");
    expect(
      classifyDeadlineEvent({
        now,
        dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1),
      }),
    ).toBeNull();
  });

  it("rejects invalid instants", () => {
    expect(() =>
      classifyDeadlineEvent({ now: new Date("invalid"), dueAt: now }),
    ).toThrow(RangeError);
    expect(() =>
      classifyDeadlineEvent({ now, dueAt: new Date("invalid") }),
    ).toThrow(RangeError);
  });
});
