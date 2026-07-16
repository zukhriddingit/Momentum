import { z } from "zod";

import { MOTIVATION_TONES } from "@/domain/motivation/types";
import { isIanaTimezone } from "@/domain/profiles/is-iana-timezone";

export const motivationSettingsSchema = z
  .object({
    tone: z.enum(MOTIVATION_TONES),
    timezone: z
      .string()
      .trim()
      .refine(isIanaTimezone, "Choose a valid timezone."),
    deadlineNudgesEnabled: z.boolean(),
    celebrationAnimationEnabled: z.boolean(),
    achievementVisibilityEnabled: z.boolean(),
  })
  .strict();
