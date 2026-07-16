import "server-only";

import { toWorkDate } from "@/domain/streaks/work-date";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { ProjectBoardView, TaskStatus } from "@/server/types";
import type { EffortLevel } from "@/domain/rewards/types";

interface ProjectRow {
  id: string;
  workspace_id: string;
  workspace_name: string;
  name: string;
  description: string | null;
  timezone: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  assignee_name: string;
  status: TaskStatus;
  effort: EffortLevel;
  due_at: Date | null;
}

export async function getProjectBoard(input: {
  actorId: string;
  projectId: string;
  occurredAt: Date;
}): Promise<ProjectBoardView> {
  const sql = database();
  const projectRows = await sql<ProjectRow[]>`
    select
      project.id,
      project.workspace_id,
      workspace.name as workspace_name,
      project.name,
      project.description,
      profile.timezone
    from public.projects as project
    join public.workspaces as workspace on workspace.id = project.workspace_id
    join public.workspace_memberships as membership
      on membership.workspace_id = project.workspace_id
      and membership.user_id = ${input.actorId}
    join public.profiles as profile on profile.id = ${input.actorId}
    where project.id = ${input.projectId}
  `;
  const project = projectRows[0];
  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found.");
  }

  const workDate = toWorkDate(input.occurredAt, project.timezone);
  const [tasks, focusRows] = await Promise.all([
    sql<TaskRow[]>`
      select
        task.id,
        task.title,
        task.description,
        task.assignee_id,
        assignee.display_name as assignee_name,
        task.status,
        task.effort,
        task.due_at
      from public.tasks as task
      join public.profiles as assignee on assignee.id = task.assignee_id
      where task.project_id = ${input.projectId}
      order by task.created_at, task.id
    `,
    sql<Array<{ task_id: string }>>`
      select task_id
      from public.focus_selections
      where user_id = ${input.actorId}
        and work_date = ${workDate}
    `,
  ]);
  const focusTaskId = focusRows[0]?.task_id ?? null;

  return {
    id: project.id,
    workspaceId: project.workspace_id,
    workspaceName: project.workspace_name,
    name: project.name,
    description: project.description,
    workDate,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      status: task.status,
      effort: task.effort,
      dueAt: task.due_at?.toISOString() ?? null,
      isCurrentUsersTask: task.assignee_id === input.actorId,
      isFocusTask: task.id === focusTaskId,
    })),
  };
}
