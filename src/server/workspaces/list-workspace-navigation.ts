import "server-only";

import { database } from "@/server/db/client";
import type { MembershipRole, WorkspaceNavigationView } from "@/server/types";

interface NavigationRow {
  workspace_id: string;
  workspace_name: string;
  role: MembershipRole;
  project_id: string | null;
  project_name: string | null;
}

export async function listWorkspaceNavigation(input: {
  actorId: string;
}): Promise<WorkspaceNavigationView> {
  const rows = await database()<NavigationRow[]>`
    select
      workspace.id as workspace_id,
      workspace.name as workspace_name,
      membership.role::text as role,
      project.id as project_id,
      project.name as project_name
    from public.workspace_memberships as membership
    join public.workspaces as workspace
      on workspace.id = membership.workspace_id
    left join public.projects as project
      on project.workspace_id = workspace.id
    where membership.user_id = ${input.actorId}
    order by
      workspace.created_at,
      workspace.id,
      project.created_at,
      project.id
  `;

  const workspaces = new Map<
    string,
    WorkspaceNavigationView["workspaces"][number]
  >();

  for (const row of rows) {
    let workspace = workspaces.get(row.workspace_id);
    if (!workspace) {
      workspace = {
        id: row.workspace_id,
        name: row.workspace_name,
        role: row.role,
        projects: [],
      };
      workspaces.set(row.workspace_id, workspace);
    }

    if (row.project_id && row.project_name) {
      workspace.projects.push({ id: row.project_id, name: row.project_name });
    }
  }

  return { workspaces: [...workspaces.values()] };
}
