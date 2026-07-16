"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { moveTask } from "@/server/tasks/move-task";
import type { TaskMutationReceipt } from "@/server/types";

const moveSchema = z.object({
  taskId: z.uuid(),
  projectId: z.uuid(),
  workspaceId: z.uuid(),
  status: z.enum(["todo", "in_progress", "done"]),
});

export async function moveTaskAction(input: {
  taskId: string;
  projectId: string;
  workspaceId: string;
  status: "todo" | "in_progress" | "done";
}): Promise<ActionResult<TaskMutationReceipt>> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That task move was not valid. Refresh and try again.",
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const receipt = await moveTask({
      actorId: user.id,
      taskId: parsed.data.taskId,
      status: parsed.data.status,
      occurredAt,
    });
    revalidatePath(
      `/workspaces/${parsed.data.workspaceId}/projects/${parsed.data.projectId}`,
    );
    revalidatePath("/dashboard");
    return { ok: true, data: receipt };
  } catch (error) {
    return actionFailure(error);
  }
}
