import "server-only";

import type { EffortLevel } from "@/domain/rewards/types";
import { getTaskPermissions } from "@/domain/tasks/task-permissions";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { completeTaskInTransaction } from "@/server/tasks/complete-task-transaction";
import type {
  MembershipRole,
  TaskMutationReceipt,
  TaskStatus,
} from "@/server/types";

interface EditableTaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  status: TaskStatus;
  effort: EffortLevel;
  due_at: Date | null;
  first_completed_at: Date | null;
  created_by: string;
  workspace_id: string;
  actor_role: MembershipRole;
}

function datesMatch(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.getTime() === right.getTime();
}

function descriptiveFieldsMatch(
  task: EditableTaskRow,
  input: {
    title: string;
    description: string | null;
    assigneeId: string;
    effort: EffortLevel;
    dueAt: Date | null;
  },
): boolean {
  return (
    task.title === input.title &&
    task.description === input.description &&
    task.assignee_id === input.assigneeId &&
    task.effort === input.effort &&
    datesMatch(task.due_at, input.dueAt)
  );
}

export async function updateTask(input: {
  actorId: string;
  taskId: string;
  title: string;
  description: string | null;
  assigneeId: string;
  effort: EffortLevel;
  dueAt: Date | null;
  status: TaskStatus;
  occurredAt: Date;
}): Promise<TaskMutationReceipt> {
  return database().begin(async (sql) => {
    const [task] = await sql<EditableTaskRow[]>`
      select
        task.id,
        project.id as project_id,
        task.title,
        task.description,
        task.assignee_id,
        task.status,
        task.effort,
        task.due_at,
        task.first_completed_at,
        task.created_by,
        project.workspace_id,
        membership.role as actor_role
      from public.tasks as task
      join public.projects as project on project.id = task.project_id
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
       and membership.user_id = ${input.actorId}
      where task.id = ${input.taskId}
      for update of task, project, membership
    `;
    if (!task) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    const permissions = getTaskPermissions({
      actorId: input.actorId,
      role: task.actor_role,
      createdBy: task.created_by,
      assigneeId: task.assignee_id,
      firstCompletedAt: task.first_completed_at,
    });
    if (!permissions.canMove) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    const assigneeChanged = task.assignee_id !== input.assigneeId;
    if (assigneeChanged && task.first_completed_at !== null) {
      if (!permissions.canEdit) {
        throw new AppError("NOT_FOUND", "Task not found.");
      }
      throw new AppError("CONFLICT", "Completed tasks cannot be reassigned.");
    }

    if (
      (!permissions.canEdit && !descriptiveFieldsMatch(task, input)) ||
      (assigneeChanged && !permissions.canReassign)
    ) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    const [assigneeMembership] = await sql<Array<{ user_id: string }>>`
      select membership.user_id
      from public.workspace_memberships as membership
      where membership.workspace_id = ${task.workspace_id}
        and membership.user_id = ${input.assigneeId}
      for key share of membership
    `;
    if (!assigneeMembership) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    const requestsFirstCompletion =
      input.status === "done" && task.status !== "done";
    if (requestsFirstCompletion && !permissions.canComplete) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }
    const requestsCompletionReplay =
      input.status === "done" &&
      task.status === "done" &&
      permissions.canComplete;

    if (requestsFirstCompletion || requestsCompletionReplay) {
      await sql`
        update public.tasks
        set
          title = ${input.title},
          description = ${input.description},
          assignee_id = ${input.assigneeId},
          effort = ${input.effort},
          due_at = ${input.dueAt},
          updated_at = ${input.occurredAt}
        where id = ${task.id}
      `;
      const completion = await completeTaskInTransaction(sql, {
        actorId: input.actorId,
        taskId: task.id,
        occurredAt: input.occurredAt,
      });
      return {
        taskId: task.id,
        workspaceId: completion.workspaceId,
        projectId: completion.projectId,
        status: "done",
        completion,
      };
    }

    await sql`
      update public.tasks
      set
        title = ${input.title},
        description = ${input.description},
        assignee_id = ${input.assigneeId},
        effort = ${input.effort},
        due_at = ${input.dueAt},
        status = ${input.status},
        updated_at = ${input.occurredAt}
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
