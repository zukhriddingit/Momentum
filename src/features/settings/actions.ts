"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { motivationSettingsSchema } from "@/features/settings/schemas";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import type { MotivationSettingsView } from "@/server/settings/types";
import { updateMotivationSettings } from "@/server/settings/update-motivation-settings";

export type MotivationSettingsActionState =
  ActionResult<MotivationSettingsView> | null;

export async function updateMotivationSettingsAction(
  _previousState: MotivationSettingsActionState,
  formData: FormData,
): Promise<MotivationSettingsActionState> {
  const parsed = motivationSettingsSchema.safeParse({
    tone: formData.get("tone"),
    timezone: formData.get("timezone"),
    deadlineNudgesEnabled: formData.get("deadlineNudgesEnabled") === "on",
    celebrationAnimationEnabled:
      formData.get("celebrationAnimationEnabled") === "on",
    achievementVisibilityEnabled:
      formData.get("achievementVisibilityEnabled") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the highlighted preferences, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const settings = await updateMotivationSettings({
      actorId: user.id,
      ...parsed.data,
      occurredAt,
    });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { ok: true, data: settings };
  } catch (error) {
    return actionFailure(error);
  }
}
