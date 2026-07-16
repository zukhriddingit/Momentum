export const MOTIVATION_TONES = [
  "calm",
  "friendly",
  "energetic",
  "minimal",
] as const;

export type MotivationTone = (typeof MOTIVATION_TONES)[number];

export const MOTIVATION_EVENTS = [
  "task_completed",
  "completed_early",
  "focus_task_completed",
  "streak_extended",
  "achievement_unlocked",
  "deadline_approaching",
  "overdue_recovery",
] as const;

export type MotivationEvent = (typeof MOTIVATION_EVENTS)[number];

export interface MotivationTemplate {
  key: string;
  title: string;
  body: string;
}

export interface MotivationMessage extends MotivationTemplate {
  event: MotivationEvent;
  tone: MotivationTone;
}
