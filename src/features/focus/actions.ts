"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { selectFocusTask } from "@/server/focus/select-focus-task";
import type { FocusSelectionView } from "@/server/types";

const focusSchema = z.object({
  taskId: z.uuid(),
  projectId: z.uuid(),
  workspaceId: z.uuid(),
});

export async function selectFocusTaskAction(input: {
  taskId: string;
  projectId: string;
  workspaceId: string;
}): Promise<ActionResult<FocusSelectionView>> {
  const parsed = focusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That task could not be selected. Refresh and try again.",
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const selection = await selectFocusTask({
      actorId: user.id,
      taskId: parsed.data.taskId,
      occurredAt,
    });
    revalidatePath(
      `/workspaces/${parsed.data.workspaceId}/projects/${parsed.data.projectId}`,
    );
    revalidatePath("/dashboard");
    return { ok: true, data: selection };
  } catch (error) {
    return actionFailure(error);
  }
}
