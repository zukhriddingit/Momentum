export const MOMENTUM_THREE = {
  code: "momentum_three",
  name: "Momentum Three",
  description: "Complete Focus Tasks across a three-day commitment streak.",
  icon: "flame",
} as const;

export function earnedMomentumThree(input: {
  previousCurrentCount: number;
  newCurrentCount: number;
}): boolean {
  return input.previousCurrentCount < 3 && input.newCurrentCount >= 3;
}
