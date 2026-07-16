import type { TimingMultiplier } from "@/domain/rewards/types";

export const ACHIEVEMENTS = [
  {
    code: "first_step",
    name: "First Step",
    description: "Complete your first task.",
    icon: "footprints",
  },
  {
    code: "focused_finish",
    name: "Focused Finish",
    description: "Complete your first Focus Task.",
    icon: "target",
  },
  {
    code: "momentum_three",
    name: "Momentum Three",
    description: "Reach a three-workday Focus Streak.",
    icon: "flame",
  },
  {
    code: "five_day_flow",
    name: "Five-Day Flow",
    description: "Reach a five-workday Focus Streak.",
    icon: "waves",
  },
  {
    code: "ahead_of_schedule",
    name: "Ahead of Schedule",
    description: "Complete a task at least 24 hours early.",
    icon: "clock-check",
  },
] as const;

export type AchievementDefinition = (typeof ACHIEVEMENTS)[number];
export type AchievementCode = AchievementDefinition["code"];

export interface AchievementEvaluationInput {
  priorCompletionCount: number;
  priorFocusCompletionCount: number;
  completedFocusTask: boolean;
  preCompletionStreak: number;
  postCompletionStreak: number;
  timingMultiplier: TimingMultiplier;
  alreadyGranted: ReadonlySet<AchievementCode>;
}

export function evaluateAchievements(
  input: AchievementEvaluationInput,
): AchievementCode[] {
  const counters = [
    input.priorCompletionCount,
    input.priorFocusCompletionCount,
    input.preCompletionStreak,
    input.postCompletionStreak,
  ];

  if (
    counters.some((counter) => !Number.isInteger(counter) || counter < 0) ||
    input.postCompletionStreak < input.preCompletionStreak ||
    input.postCompletionStreak > input.preCompletionStreak + 1
  ) {
    throw new RangeError("Authoritative achievement state is invalid.");
  }

  const qualifies = new Set<AchievementCode>();

  if (input.priorCompletionCount === 0) {
    qualifies.add("first_step");
  }

  if (input.completedFocusTask && input.priorFocusCompletionCount === 0) {
    qualifies.add("focused_finish");
  }

  if (
    input.completedFocusTask &&
    input.preCompletionStreak < 3 &&
    input.postCompletionStreak >= 3
  ) {
    qualifies.add("momentum_three");
  }

  if (
    input.completedFocusTask &&
    input.preCompletionStreak < 5 &&
    input.postCompletionStreak >= 5
  ) {
    qualifies.add("five_day_flow");
  }

  if (input.timingMultiplier === 1.2) {
    qualifies.add("ahead_of_schedule");
  }

  return ACHIEVEMENTS.map(({ code }) => code).filter(
    (code) => qualifies.has(code) && !input.alreadyGranted.has(code),
  );
}
