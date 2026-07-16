import "server-only";

import type { MotivationTone } from "@/domain/motivation/types";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { MotivationSettingsView } from "@/server/settings/types";

interface MotivationSettingsRow {
  tone: MotivationTone;
  timezone: string;
  deadline_nudges_enabled: boolean;
  celebration_animation_enabled: boolean;
  achievement_visibility_enabled: boolean;
}

export async function getMotivationSettings(input: {
  actorId: string;
}): Promise<MotivationSettingsView> {
  const rows = await database()<MotivationSettingsRow[]>`
    select
      profile.motivation_tone::text as tone,
      profile.timezone,
      coalesce(preference.deadline_nudges_enabled, true)
        as deadline_nudges_enabled,
      coalesce(preference.celebration_animation_enabled, true)
        as celebration_animation_enabled,
      coalesce(preference.achievement_visibility_enabled, true)
        as achievement_visibility_enabled
    from public.profiles as profile
    left join public.motivation_preferences as preference
      on preference.user_id = profile.id
    where profile.id = ${input.actorId}
  `;
  const settings = rows[0];
  if (!settings) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  return {
    tone: settings.tone,
    timezone: settings.timezone,
    deadlineNudgesEnabled: settings.deadline_nudges_enabled,
    celebrationAnimationEnabled: settings.celebration_animation_enabled,
    achievementVisibilityEnabled: settings.achievement_visibility_enabled,
  };
}
