import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type {
  MembershipRole,
  PendingCohortSeatView,
  WorkspaceMemberView,
  WorkspaceOverview,
} from "@/server/types";

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

interface WorkspaceMemberRow {
  id: string;
  display_name: string;
  role: MembershipRole;
  github_handle: string | null;
}

interface PendingCohortSeatRow {
  id: string;
  workspace_id: string;
  github_user_id: string;
  github_handle: string;
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

  const [projects, members, pendingCohortSeats] = await Promise.all([
    sql<ProjectProgressRow[]>`
      select
        project.id,
        project.workspace_id,
        project.name,
        project.description,
        coalesce(progress.done_tasks, 0)::integer as done_tasks,
        coalesce(progress.total_tasks, 0)::integer as total_tasks,
        coalesce(progress.percent_complete, 0)::integer as percent_complete
      from public.projects as project
      join public.workspace_memberships as actor_membership
        on actor_membership.workspace_id = project.workspace_id
       and actor_membership.user_id = ${input.actorId}
      left join public.project_progress as progress
        on progress.project_id = project.id
      where project.workspace_id = ${workspace.id}
        and project.archived_at is null
      order by project.created_at, project.id
    `,
    sql<WorkspaceMemberRow[]>`
      select
        profile.id,
        profile.display_name,
        membership.role::text as role,
        profile.github_handle
      from public.workspace_memberships as membership
      join public.profiles as profile
        on profile.id = membership.user_id
      where membership.workspace_id = ${workspace.id}
      order by
        case membership.role
          when 'owner' then 0
          when 'admin' then 1
          else 2
        end,
        lower(profile.display_name),
        profile.id
    `,
    sql<PendingCohortSeatRow[]>`
      select
        seat.id,
        seat.workspace_id,
        seat.github_user_id::text,
        seat.github_handle
      from public.workspace_cohort_seats as seat
      where seat.workspace_id = ${workspace.id}
        and seat.user_id is null
      order by seat.github_handle, seat.id
    `,
  ]);

  return {
    id: workspace.id,
    name: workspace.name,
    actorRole: workspace.actor_role,
    members: members.map((member): WorkspaceMemberView => ({
      id: member.id,
      displayName: member.display_name,
      role: member.role,
      githubHandle: member.github_handle,
    })),
    pendingCohortSeats: pendingCohortSeats.map(
      (seat): PendingCohortSeatView => ({
        id: seat.id,
        workspaceId: seat.workspace_id,
        githubUserId: seat.github_user_id,
        githubHandle: seat.github_handle,
        profileUrl: `https://github.com/${seat.github_handle}`,
        userId: null,
        claimedAt: null,
      }),
    ),
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
