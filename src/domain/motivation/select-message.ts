import type { AchievementCode } from "@/domain/achievements/achievements";
import { MESSAGE_CATALOG } from "@/domain/motivation/catalog";
import type {
  MotivationEvent,
  MotivationMessage,
  MotivationTone,
} from "@/domain/motivation/types";
import type { TimingMultiplier } from "@/domain/rewards/types";

export function selectPrimaryCompletionEvent(input: {
  newAchievementCodes: readonly AchievementCode[];
  achievementVisibilityEnabled: boolean;
  streakIncremented: boolean;
  completedFocusTask: boolean;
  timingMultiplier: TimingMultiplier;
}): MotivationEvent {
  if (
    input.achievementVisibilityEnabled &&
    input.newAchievementCodes.length > 0
  ) {
    return "achievement_unlocked";
  }

  if (input.streakIncremented) {
    return "streak_extended";
  }

  if (input.completedFocusTask) {
    return "focus_task_completed";
  }

  if (input.timingMultiplier === 1.2) {
    return "completed_early";
  }

  return "task_completed";
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function selectMotivationMessage(input: {
  event: MotivationEvent;
  tone: MotivationTone;
  sourceId: string;
}): MotivationMessage {
  const templates = MESSAGE_CATALOG[input.event][input.tone];
  const index =
    stableHash(`${input.event}:${input.tone}:${input.sourceId}`) %
    templates.length;
  const template = templates[index] ?? templates[0];

  return { ...template, event: input.event, tone: input.tone };
}
