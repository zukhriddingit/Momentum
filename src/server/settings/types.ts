import type { MotivationTone } from "@/domain/motivation/types";

export interface MotivationSettingsView {
  tone: MotivationTone;
  timezone: string;
  deadlineNudgesEnabled: boolean;
  celebrationAnimationEnabled: boolean;
  achievementVisibilityEnabled: boolean;
}
