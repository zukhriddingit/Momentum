import "server-only";

import { basePointsForEffort } from "@/domain/rewards/calculate-point-breakdown";
import type { EffortLevel } from "@/domain/rewards/types";
import { toWorkDate } from "@/domain/streaks/work-date";
import { getTaskPermissions } from "@/domain/tasks/task-permissions";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type {
  MembershipRole,
  ProjectBoardView,
  TaskStatus,
} from "@/server/types";

interface ProjectRow {
  id: string;
  workspace_id: string;
  workspace_name: string;
  name: string;
  description: string | null;
  timezone: string;
  celebration_animation_enabled: boolean;
  actor_role: MembershipRole;
}

interface TaskRow {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  assignee_id: string;
  assignee_name: string;
  status: TaskStatus;
  effort: EffortLevel;
  due_at: Date | null;
  first_completed_at: Date | null;
}

interface MemberRow {
  id: string;
  display_name: string;
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
      profile.timezone,
      coalesce(preference.celebration_animation_enabled, true)
        as celebration_animation_enabled,
      membership.role::text as actor_role
    from public.projects as project
    join public.workspaces as workspace on workspace.id = project.workspace_id
    join public.workspace_memberships as membership
      on membership.workspace_id = project.workspace_id
      and membership.user_id = ${input.actorId}
    join public.profiles as profile on profile.id = ${input.actorId}
    left join public.motivation_preferences as preference
      on preference.user_id = profile.id
    where project.id = ${input.projectId}
  `;
  const project = projectRows[0];
  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found.");
  }

  const workDate = toWorkDate(input.occurredAt, project.timezone);
  const [tasks, focusRows, members] = await Promise.all([
    sql<TaskRow[]>`
      select
        task.id,
        task.created_by,
        task.title,
        task.description,
        task.assignee_id,
        assignee.display_name as assignee_name,
        task.status,
        task.effort,
        task.due_at,
        task.first_completed_at
      from public.tasks as task
      join public.projects as task_project on task_project.id = task.project_id
      join public.workspace_memberships as actor
        on actor.workspace_id = task_project.workspace_id
       and actor.user_id = ${input.actorId}
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
    sql<MemberRow[]>`
      select profile.id, profile.display_name
      from public.workspace_memberships as member
      join public.profiles as profile on profile.id = member.user_id
      join public.workspace_memberships as actor
        on actor.workspace_id = member.workspace_id
       and actor.user_id = ${input.actorId}
      where member.workspace_id = ${project.workspace_id}
      order by profile.display_name, profile.id
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
    celebrationAnimationEnabled: project.celebration_animation_enabled,
    actorRole: project.actor_role,
    members: members.map((member) => ({
      id: member.id,
      displayName: member.display_name,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      createdBy: task.created_by,
      title: task.title,
      description: task.description,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      status: task.status,
      effort: task.effort,
      dueAt: task.due_at?.toISOString() ?? null,
      estimatedBasePoints: basePointsForEffort(task.effort),
      permissions: getTaskPermissions({
        actorId: input.actorId,
        role: project.actor_role,
        createdBy: task.created_by,
        assigneeId: task.assignee_id,
        firstCompletedAt: task.first_completed_at,
      }),
      isCurrentUsersTask: task.assignee_id === input.actorId,
      isFocusTask: task.id === focusTaskId,
    })),
  };
}
