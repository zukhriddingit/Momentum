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
    return {
      taskId: completion.taskId,
      workspaceId: completion.workspaceId,
      projectId: completion.projectId,
      status: "done",
      completion,
    };
  }

  return database().begin(async (sql) => {
    const rows = await sql<
      Array<{
        id: string;
        status: TaskStatus;
        project_id: string;
        workspace_id: string;
      }>
    >`
      select
        task.id,
        task.status,
        project.id as project_id,
        project.workspace_id
      from public.tasks as task
      join public.projects as project on project.id = task.project_id
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
        and membership.user_id = ${input.actorId}
      where task.id = ${input.taskId}
        and task.assignee_id = ${input.actorId}
        and project.archived_at is null
      for update of task, project
    `;
    const task = rows[0];
    if (!task) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    if (task.status === input.status) {
      return {
        taskId: task.id,
        workspaceId: task.workspace_id,
        projectId: task.project_id,
        status: input.status,
        completion: null,
      };
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
    return {
      taskId: task.id,
      workspaceId: task.workspace_id,
      projectId: task.project_id,
      status: input.status,
      completion: null,
    };
  });
}
