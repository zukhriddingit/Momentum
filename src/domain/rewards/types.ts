export type EffortLevel = "small" | "medium" | "large" | "extra_large";

export type TimingMultiplier = 1 | 1.1 | 1.2;

export interface PointBreakdown {
  basePoints: number;
  timingMultiplier: TimingMultiplier;
  streakMultiplier: number;
  timingBonus: number;
  streakBonus: number;
  finalPoints: number;
}
