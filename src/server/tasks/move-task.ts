import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { completeTask } from "@/server/tasks/complete-task";
import type { TaskMutationReceipt, TaskStatus } from "@/server/types";

const ALLOWED_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> =
  {
    todo: ["in_progress"],
    in_progress: ["todo", "done"],
    done: ["in_progress"],
  };

export async function moveTask(input: {
  actorId: string;
  taskId: string;
  status: TaskStatus;
  occurredAt: Date;
}): Promise<TaskMutationReceipt> {
  if (input.status === "done") {
    const completion = await completeTask(input);
    return { taskId: input.taskId, status: "done", completion };
  }

  return database().begin(async (sql) => {
    const rows = await sql<Array<{ id: string; status: TaskStatus }>>`
      select task.id, task.status
      from public.tasks as task
      join public.projects as project on project.id = task.project_id
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
        and membership.user_id = ${input.actorId}
      where task.id = ${input.taskId}
        and task.assignee_id = ${input.actorId}
      for update of task
    `;
    const task = rows[0];
    if (!task) {
      throw new AppError("FORBIDDEN", "Only the assignee can move this task.");
    }

    if (task.status === input.status) {
      return { taskId: task.id, status: input.status, completion: null };
    }

    if (!ALLOWED_TRANSITIONS[task.status].includes(input.status)) {
      throw new AppError(
        "CONFLICT",
        `Tasks cannot move directly from ${task.status} to ${input.status}.`,
      );
    }

    await sql`
      update public.tasks
      set status = ${input.status}, updated_at = ${input.occurredAt}
      where id = ${task.id}
    `;
    return { taskId: task.id, status: input.status, completion: null };
  });
}
