import { describe, expect, it } from "vitest";

import {
  basePointsForEffort,
  calculatePointBreakdown,
} from "@/domain/rewards/calculate-point-breakdown";

const completedAt = new Date("2026-07-15T16:00:00.000Z");

describe("calculatePointBreakdown", () => {
  it.each([
    ["small", 20],
    ["medium", 40],
    ["large", 70],
    ["extra_large", 100],
  ] as const)("previews %s effort as %i base points", (effort, expected) => {
    expect(basePointsForEffort(effort)).toBe(expected);
  });

  it.each([
    ["small", 20],
    ["medium", 40],
    ["large", 70],
    ["extra_large", 100],
  ] as const)("maps %s effort to %i base points", (effort, expected) => {
    expect(
      calculatePointBreakdown({
        effort,
        dueAt: null,
        completedAt,
        preCompletionStreak: 0,
      }).finalPoints,
    ).toBe(expected);
  });

  it("uses the 1.20 multiplier at exactly 24 hours early", () => {
    const result = calculatePointBreakdown({
      effort: "medium",
      dueAt: new Date("2026-07-16T16:00:00.000Z"),
      completedAt,
      preCompletionStreak: 0,
    });

    expect(result.timingMultiplier).toBe(1.2);
    expect(result.finalPoints).toBe(48);
  });

  it("uses 1.10 before the deadline and 1.00 at or after it", () => {
    expect(
      calculatePointBreakdown({
        effort: "small",
        dueAt: new Date("2026-07-15T17:00:00.000Z"),
        completedAt,
        preCompletionStreak: 0,
      }).timingMultiplier,
    ).toBe(1.1);

    expect(
      calculatePointBreakdown({
        effort: "small",
        dueAt: completedAt,
        completedAt,
        preCompletionStreak: 0,
      }),
    ).toMatchObject({ timingMultiplier: 1, finalPoints: 20 });
  });

  it("produces the documented 52-point seeded completion", () => {
    const result = calculatePointBreakdown({
      effort: "medium",
      dueAt: new Date("2026-07-25T16:00:00.000Z"),
      completedAt,
      preCompletionStreak: 2,
    });

    expect(result).toEqual({
      basePoints: 40,
      timingMultiplier: 1.2,
      streakMultiplier: 1.08,
      timingBonus: 8,
      streakBonus: 4,
      finalPoints: 52,
    });
  });

  it("caps the streak multiplier at 1.20", () => {
    expect(
      calculatePointBreakdown({
        effort: "large",
        dueAt: null,
        completedAt,
        preCompletionStreak: 99,
      }).streakMultiplier,
    ).toBe(1.2);
  });
});
