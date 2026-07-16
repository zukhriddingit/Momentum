import type {
  EffortLevel,
  PointBreakdown,
  TimingMultiplier,
} from "@/domain/rewards/types";

const BASE_POINTS: Readonly<Record<EffortLevel, number>> = {
  small: 20,
  medium: 40,
  large: 70,
  extra_large: 100,
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function timingMultiplier(
  completedAt: Date,
  dueAt: Date | null,
): TimingMultiplier {
  if (dueAt === null || completedAt.getTime() >= dueAt.getTime()) {
    return 1;
  }

  return dueAt.getTime() - completedAt.getTime() >= TWENTY_FOUR_HOURS_MS
    ? 1.2
    : 1.1;
}

export function calculatePointBreakdown(input: {
  effort: EffortLevel;
  dueAt: Date | null;
  completedAt: Date;
  preCompletionStreak: number;
}): PointBreakdown {
  if (
    Number.isNaN(input.completedAt.getTime()) ||
    (input.dueAt !== null && Number.isNaN(input.dueAt.getTime()))
  ) {
    throw new RangeError("Reward timestamps must be valid dates.");
  }

  if (
    !Number.isInteger(input.preCompletionStreak) ||
    input.preCompletionStreak < 0
  ) {
    throw new RangeError(
      "The pre-completion streak must be a non-negative integer.",
    );
  }

  const basePoints = BASE_POINTS[input.effort];
  const timing = timingMultiplier(input.completedAt, input.dueAt);
  const streakMultiplier = 1 + Math.min(0.2, 0.04 * input.preCompletionStreak);
  const timingAdjusted = basePoints * timing;
  const finalPoints = Math.round(timingAdjusted * streakMultiplier);
  const timingBonus = Math.round(timingAdjusted) - basePoints;
  const streakBonus = finalPoints - basePoints - timingBonus;

  return {
    basePoints,
    timingMultiplier: timing,
    streakMultiplier,
    timingBonus,
    streakBonus,
    finalPoints,
  };
}
