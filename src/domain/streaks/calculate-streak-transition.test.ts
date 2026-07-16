import { describe, expect, it } from "vitest";

import { calculateStreakTransition } from "@/domain/streaks/calculate-streak-transition";
import { toWorkDate } from "@/domain/streaks/work-date";

describe("calculateStreakTransition", () => {
  it("starts the first completed Focus Task at one", () => {
    expect(
      calculateStreakTransition({
        completionWorkDate: "2026-07-15",
        previous: {
          currentCount: 0,
          longestCount: 0,
          lastCompletedWorkDate: null,
        },
        interveningSelections: [],
      }),
    ).toMatchObject({
      preCompletionStreak: 0,
      currentCount: 1,
      longestCount: 1,
    });
  });

  it("pauses across a workday with no Focus Task selected", () => {
    expect(
      calculateStreakTransition({
        completionWorkDate: "2026-07-15",
        previous: {
          currentCount: 2,
          longestCount: 2,
          lastCompletedWorkDate: "2026-07-13",
        },
        interveningSelections: [],
      }),
    ).toMatchObject({
      preCompletionStreak: 2,
      currentCount: 3,
      brokenBeforeCompletion: false,
    });
  });

  it("breaks after a selected but incomplete Focus Task", () => {
    expect(
      calculateStreakTransition({
        completionWorkDate: "2026-07-15",
        previous: {
          currentCount: 2,
          longestCount: 4,
          lastCompletedWorkDate: "2026-07-13",
        },
        interveningSelections: [{ workDate: "2026-07-14", completed: false }],
      }),
    ).toEqual({
      preCompletionStreak: 0,
      currentCount: 1,
      longestCount: 4,
      lastCompletedWorkDate: "2026-07-15",
      incremented: true,
      brokenBeforeCompletion: true,
    });
  });

  it("ignores weekends between Friday and Monday", () => {
    expect(
      calculateStreakTransition({
        completionWorkDate: "2026-07-20",
        previous: {
          currentCount: 2,
          longestCount: 2,
          lastCompletedWorkDate: "2026-07-17",
        },
        interveningSelections: [
          { workDate: "2026-07-18", completed: false },
          { workDate: "2026-07-19", completed: false },
        ],
      }).currentCount,
    ).toBe(3);
  });

  it("does not increment twice on the same work date", () => {
    expect(
      calculateStreakTransition({
        completionWorkDate: "2026-07-15",
        previous: {
          currentCount: 3,
          longestCount: 5,
          lastCompletedWorkDate: "2026-07-15",
        },
        interveningSelections: [],
      }),
    ).toMatchObject({ currentCount: 3, longestCount: 5, incremented: false });
  });

  it("resolves work dates in the user's timezone across a UTC boundary", () => {
    const instant = new Date("2026-11-02T02:30:00.000Z");
    expect(toWorkDate(instant, "America/New_York")).toBe("2026-11-01");
    expect(toWorkDate(instant, "Asia/Tokyo")).toBe("2026-11-02");
  });
});
