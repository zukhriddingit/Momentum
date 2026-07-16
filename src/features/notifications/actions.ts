"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { markAllNotificationsRead } from "@/server/notifications/mark-all-notifications-read";
import { markNotificationRead } from "@/server/notifications/mark-notification-read";

const notificationIdSchema = z.object({ notificationId: z.uuid() }).strict();

function revalidateNotificationPaths(): void {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function markNotificationReadAction(input: {
  notificationId: string;
}): Promise<ActionResult<null>> {
  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That notification could not be updated. Refresh and try again.",
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    await markNotificationRead({
      actorId: user.id,
      notificationId: parsed.data.notificationId,
      occurredAt,
    });
    revalidateNotificationPaths();
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<null>
> {
  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    await markAllNotificationsRead({ actorId: user.id, occurredAt });
    revalidateNotificationPaths();
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure(error);
  }
}
