import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  evaluateAchievements,
  type AchievementEvaluationInput,
} from "@/domain/achievements/achievements";

const baseline: AchievementEvaluationInput = {
  priorCompletionCount: 3,
  priorFocusCompletionCount: 2,
  completedFocusTask: false,
  preCompletionStreak: 2,
  postCompletionStreak: 2,
  timingMultiplier: 1,
  alreadyGranted: new Set(),
};

describe("evaluateAchievements", () => {
  it("defines the five stable codes", () => {
    expect(ACHIEVEMENTS.map(({ code }) => code)).toEqual([
      "first_step",
      "focused_finish",
      "momentum_three",
      "five_day_flow",
      "ahead_of_schedule",
    ]);
  });

  it.each([
    [{ ...baseline, priorCompletionCount: 0 }, ["first_step"]],
    [
      {
        ...baseline,
        priorFocusCompletionCount: 0,
        completedFocusTask: true,
      },
      ["focused_finish"],
    ],
    [
      {
        ...baseline,
        completedFocusTask: true,
        preCompletionStreak: 2,
        postCompletionStreak: 3,
      },
      ["momentum_three"],
    ],
    [
      {
        ...baseline,
        completedFocusTask: true,
        preCompletionStreak: 4,
        postCompletionStreak: 5,
      },
      ["five_day_flow"],
    ],
    [{ ...baseline, timingMultiplier: 1.2 }, ["ahead_of_schedule"]],
  ] satisfies Array<[AchievementEvaluationInput, string[]]>)(
    "returns only the qualifying stable code for %#",
    (input, expected) => expect(evaluateAchievements(input)).toEqual(expected),
  );

  it("returns every possible overlapping first Focus achievement in definition order", () => {
    expect(
      evaluateAchievements({
        ...baseline,
        priorCompletionCount: 0,
        priorFocusCompletionCount: 0,
        completedFocusTask: true,
        preCompletionStreak: 2,
        postCompletionStreak: 3,
        timingMultiplier: 1.2,
      }),
    ).toEqual([
      "first_step",
      "focused_finish",
      "momentum_three",
      "ahead_of_schedule",
    ]);
  });

  it("filters grants already owned by the user", () => {
    expect(
      evaluateAchievements({
        ...baseline,
        priorCompletionCount: 0,
        timingMultiplier: 1.2,
        alreadyGranted: new Set(["first_step"]),
      }),
    ).toEqual(["ahead_of_schedule"]);
  });

  it("does not unlock streak achievements for a non-Focus completion", () => {
    expect(
      evaluateAchievements({
        ...baseline,
        preCompletionStreak: 2,
        postCompletionStreak: 3,
      }),
    ).toEqual([]);
  });

  it("does not treat a 1.10 timing multiplier as at least 24 hours early", () => {
    expect(
      evaluateAchievements({ ...baseline, timingMultiplier: 1.1 }),
    ).toEqual([]);
  });

  it("rejects contradictory authoritative counters", () => {
    expect(() =>
      evaluateAchievements({ ...baseline, priorCompletionCount: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      evaluateAchievements({
        ...baseline,
        preCompletionStreak: 5,
        postCompletionStreak: 3,
      }),
    ).toThrow(RangeError);
    expect(() =>
      evaluateAchievements({
        ...baseline,
        preCompletionStreak: 2,
        postCompletionStreak: 4,
      }),
    ).toThrow(RangeError);
    expect(() =>
      evaluateAchievements({
        ...baseline,
        postCompletionStreak: 2.5,
      }),
    ).toThrow(RangeError);
  });
});
