import "server-only";

import type { EffortLevel } from "@/domain/rewards/types";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { completeTaskInTransaction } from "@/server/tasks/complete-task-transaction";
import { resolveTaskAssignee } from "@/server/tasks/resolve-task-assignee";
import type {
  TaskAssigneeRef,
  TaskMutationReceipt,
  TaskStatus,
} from "@/server/types";

interface AuthorizedProjectRow {
  id: string;
  workspace_id: string;
}

export async function createTask(input: {
  actorId: string;
  projectId: string;
  title: string;
  description: string | null;
  assignee: TaskAssigneeRef;
  effort: EffortLevel;
  dueAt: Date | null;
  status: TaskStatus;
  occurredAt: Date;
}): Promise<TaskMutationReceipt> {
  return database().begin(async (sql) => {
    const [project] = await sql<AuthorizedProjectRow[]>`
      select project.id, project.workspace_id
      from public.projects as project
      join public.workspace_memberships as actor_membership
        on actor_membership.workspace_id = project.workspace_id
       and actor_membership.user_id = ${input.actorId}
      where project.id = ${input.projectId}
        and project.archived_at is null
      for update of project, actor_membership
    `;
    if (!project) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    const assignee = await resolveTaskAssignee(
      sql,
      project.workspace_id,
      input.assignee,
    );

    if (
      input.status === "done" &&
      (assignee.pending || input.actorId !== assignee.assigneeId)
    ) {
      throw new AppError("NOT_FOUND", "Task not found.");
    }

    const taskId = crypto.randomUUID();
    const initialStatus: TaskStatus = assignee.pending
      ? "todo"
      : input.status === "done"
        ? "todo"
        : input.status;
    await sql`
      insert into public.tasks (
        id,
        project_id,
        title,
        description,
        assignee_id,
        cohort_seat_id,
        status,
        effort,
        due_at,
        created_by,
        created_at,
        updated_at
      ) values (
        ${taskId},
        ${project.id},
        ${input.title},
        ${input.description},
        ${assignee.assigneeId},
        ${assignee.cohortSeatId},
        ${initialStatus},
        ${input.effort},
        ${input.dueAt},
        ${input.actorId},
        ${input.occurredAt},
        ${input.occurredAt}
      )
    `;

    if (input.status === "done") {
      const completion = await completeTaskInTransaction(sql, {
        actorId: input.actorId,
        taskId,
        occurredAt: input.occurredAt,
      });
      return {
        taskId,
        workspaceId: completion.workspaceId,
        projectId: completion.projectId,
        status: "done",
        completion,
      };
    }

    return {
      taskId,
      workspaceId: project.workspace_id,
      projectId: project.id,
      status: initialStatus,
      completion: null,
    };
  });
}
