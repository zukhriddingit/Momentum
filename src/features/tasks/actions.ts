"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { taskInputSchema } from "@/features/tasks/schemas";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { createTask } from "@/server/tasks/create-task";
import { moveTask } from "@/server/tasks/move-task";
import { updateTask } from "@/server/tasks/update-task";
import type { TaskMutationReceipt } from "@/server/types";

const moveSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(["todo", "in_progress", "done"]),
});

const taskActionContextSchema = z.object({
  taskId: z.uuid(),
});

export type TaskActionState = ActionResult<TaskMutationReceipt> | null;

function taskFields(formData: FormData) {
  const assigneeKind = formData.get("assigneeKind");
  const assigneeId = formData.get("assigneeId");
  const assignee =
    assigneeKind === "member"
      ? { kind: assigneeKind, userId: assigneeId }
      : assigneeKind === "cohort"
        ? { kind: assigneeKind, seatId: assigneeId }
        : { kind: assigneeKind };

  return {
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description"),
    assignee,
    effort: formData.get("effort"),
    dueAt: formData.get("dueAt"),
    status: formData.get("status"),
  };
}

function taskFieldErrors(
  error: z.ZodError<z.infer<typeof taskInputSchema>>,
): Record<string, string[]> {
  const { assignee, ...fieldErrors } = z.flattenError(error).fieldErrors;
  return assignee ? { ...fieldErrors, assigneeId: assignee } : fieldErrors;
}

function revalidateTaskPaths(receipt: TaskMutationReceipt): void {
  revalidatePath("/dashboard");
  revalidatePath(`/workspaces/${receipt.workspaceId}`);
  revalidatePath(
    `/workspaces/${receipt.workspaceId}/projects/${receipt.projectId}`,
  );
}

export async function createTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const parsed = taskInputSchema.safeParse(taskFields(formData));
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the task details, then try again.",
      fieldErrors: parsed.success ? undefined : taskFieldErrors(parsed.error),
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const receipt = await createTask({
      actorId: user.id,
      ...parsed.data,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      occurredAt,
    });
    revalidateTaskPaths(receipt);
    return { ok: true, data: receipt };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const parsed = taskInputSchema.safeParse(taskFields(formData));
  const context = taskActionContextSchema.safeParse({
    taskId: formData.get("taskId"),
  });
  if (!parsed.success || !context.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the task details, then try again.",
      fieldErrors: parsed.success ? undefined : taskFieldErrors(parsed.error),
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const receipt = await updateTask({
      actorId: user.id,
      taskId: context.data.taskId,
      title: parsed.data.title,
      description: parsed.data.description,
      assignee: parsed.data.assignee,
      effort: parsed.data.effort,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      status: parsed.data.status,
      occurredAt,
    });
    revalidateTaskPaths(receipt);
    return { ok: true, data: receipt };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function moveTaskAction(input: {
  taskId: string;
  projectId?: string;
  workspaceId?: string;
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
    revalidateTaskPaths(receipt);
    return { ok: true, data: receipt };
  } catch (error) {
    return actionFailure(error);
  }
}
