import { compareWorkDates, isWeekday } from "@/domain/streaks/work-date";

export interface FocusSelectionOutcome {
  workDate: string;
  completed: boolean;
}

export interface StreakTransition {
  preCompletionStreak: number;
  currentCount: number;
  longestCount: number;
  lastCompletedWorkDate: string;
  incremented: boolean;
  brokenBeforeCompletion: boolean;
}

export function resolvePreCompletionStreak(input: {
  previousCurrentCount: number;
  previousLastCompletedWorkDate: string | null;
  completionWorkDate: string;
  interveningSelections: readonly FocusSelectionOutcome[];
}): { count: number; broken: boolean } {
  const broken = input.interveningSelections.some((selection) => {
    const followsLastCompletion =
      input.previousLastCompletedWorkDate === null ||
      compareWorkDates(
        selection.workDate,
        input.previousLastCompletedWorkDate,
      ) > 0;
    const precedesThisCompletion =
      compareWorkDates(selection.workDate, input.completionWorkDate) < 0;

    return (
      followsLastCompletion &&
      precedesThisCompletion &&
      isWeekday(selection.workDate) &&
      !selection.completed
    );
  });

  return { count: broken ? 0 : input.previousCurrentCount, broken };
}

export function calculateStreakTransition(input: {
  completionWorkDate: string;
  previous: {
    currentCount: number;
    longestCount: number;
    lastCompletedWorkDate: string | null;
  };
  interveningSelections: readonly FocusSelectionOutcome[];
}): StreakTransition {
  if (!isWeekday(input.completionWorkDate)) {
    throw new RangeError("A Focus Streak can only increment on a workday.");
  }

  if (
    !Number.isInteger(input.previous.currentCount) ||
    !Number.isInteger(input.previous.longestCount) ||
    input.previous.currentCount < 0 ||
    input.previous.longestCount < input.previous.currentCount
  ) {
    throw new RangeError("Previous streak values are invalid.");
  }

  if (input.previous.lastCompletedWorkDate === input.completionWorkDate) {
    return {
      preCompletionStreak: input.previous.currentCount,
      currentCount: input.previous.currentCount,
      longestCount: input.previous.longestCount,
      lastCompletedWorkDate: input.completionWorkDate,
      incremented: false,
      brokenBeforeCompletion: false,
    };
  }

  const resolved = resolvePreCompletionStreak({
    previousCurrentCount: input.previous.currentCount,
    previousLastCompletedWorkDate: input.previous.lastCompletedWorkDate,
    completionWorkDate: input.completionWorkDate,
    interveningSelections: input.interveningSelections,
  });
  const brokenBeforeCompletion = resolved.broken;
  const preCompletionStreak = resolved.count;
  const currentCount = preCompletionStreak + 1;

  return {
    preCompletionStreak,
    currentCount,
    longestCount: Math.max(input.previous.longestCount, currentCount),
    lastCompletedWorkDate: input.completionWorkDate,
    incremented: true,
    brokenBeforeCompletion,
  };
}
