import "server-only";

import {
  MOTIVATION_TONES,
  type MotivationTone,
} from "@/domain/motivation/types";
import { isIanaTimezone } from "@/domain/profiles/is-iana-timezone";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { MotivationSettingsView } from "@/server/settings/types";

export async function updateMotivationSettings(input: {
  actorId: string;
  tone: MotivationTone;
  timezone: string;
  deadlineNudgesEnabled: boolean;
  celebrationAnimationEnabled: boolean;
  achievementVisibilityEnabled: boolean;
  occurredAt: Date;
}): Promise<MotivationSettingsView> {
  if (
    !(MOTIVATION_TONES as readonly string[]).includes(input.tone) ||
    !isIanaTimezone(input.timezone) ||
    typeof input.deadlineNudgesEnabled !== "boolean" ||
    typeof input.celebrationAnimationEnabled !== "boolean" ||
    typeof input.achievementVisibilityEnabled !== "boolean" ||
    Number.isNaN(input.occurredAt.getTime())
  ) {
    throw new TypeError("Choose valid motivation settings.");
  }

  return database().begin(async (sql) => {
    const profile = await sql<Array<{ id: string }>>`
      update public.profiles
      set
        timezone = ${input.timezone},
        motivation_tone = ${input.tone},
        updated_at = ${input.occurredAt}
      where id = ${input.actorId}
      returning id
    `;
    if (!profile[0]) {
      throw new AppError("NOT_FOUND", "Profile not found.");
    }

    await sql`
      insert into public.motivation_preferences (
        user_id,
        deadline_nudges_enabled,
        celebration_animation_enabled,
        achievement_visibility_enabled,
        updated_at
      ) values (
        ${input.actorId},
        ${input.deadlineNudgesEnabled},
        ${input.celebrationAnimationEnabled},
        ${input.achievementVisibilityEnabled},
        ${input.occurredAt}
      )
      on conflict (user_id) do update set
        deadline_nudges_enabled = excluded.deadline_nudges_enabled,
        celebration_animation_enabled = excluded.celebration_animation_enabled,
        achievement_visibility_enabled = excluded.achievement_visibility_enabled,
        updated_at = excluded.updated_at
    `;

    return {
      tone: input.tone,
      timezone: input.timezone,
      deadlineNudgesEnabled: input.deadlineNudgesEnabled,
      celebrationAnimationEnabled: input.celebrationAnimationEnabled,
      achievementVisibilityEnabled: input.achievementVisibilityEnabled,
    };
  });
}
