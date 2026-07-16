import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { MembershipRole, WorkspaceOverview } from "@/server/types";

interface WorkspaceRow {
  id: string;
  name: string;
  actor_role: MembershipRole;
}

interface ProjectProgressRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  done_tasks: number;
  total_tasks: number;
  percent_complete: number;
}

export async function getWorkspaceOverview(input: {
  actorId: string;
  workspaceId: string;
}): Promise<WorkspaceOverview> {
  const sql = database();
  const [workspace] = await sql<WorkspaceRow[]>`
    select
      workspace.id,
      workspace.name,
      membership.role::text as actor_role
    from public.workspaces as workspace
    join public.workspace_memberships as membership
      on membership.workspace_id = workspace.id
     and membership.user_id = ${input.actorId}
    where workspace.id = ${input.workspaceId}
  `;

  if (!workspace) {
    throw new AppError("NOT_FOUND", "Workspace not found.");
  }

  const projects = await sql<ProjectProgressRow[]>`
    select
      project.id,
      project.workspace_id,
      project.name,
      project.description,
      coalesce(progress.done_tasks, 0)::integer as done_tasks,
      coalesce(progress.total_tasks, 0)::integer as total_tasks,
      coalesce(progress.percent_complete, 0)::integer as percent_complete
    from public.projects as project
    join public.workspace_memberships as membership
      on membership.workspace_id = project.workspace_id
     and membership.user_id = ${input.actorId}
    left join public.project_progress as progress
      on progress.project_id = project.id
    where project.workspace_id = ${input.workspaceId}
    order by project.created_at, project.id
  `;

  return {
    id: workspace.id,
    name: workspace.name,
    actorRole: workspace.actor_role,
    projects: projects.map((project) => ({
      id: project.id,
      workspaceId: project.workspace_id,
      name: project.name,
      description: project.description,
      doneTasks: project.done_tasks,
      totalTasks: project.total_tasks,
      percentComplete: project.percent_complete,
    })),
  };
}
