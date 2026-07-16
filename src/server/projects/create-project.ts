import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { ProjectSummary } from "@/server/types";

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
}

export async function createProject(input: {
  actorId: string;
  workspaceId: string;
  name: string;
  description: string | null;
}): Promise<ProjectSummary> {
  return database().begin(async (sql) => {
    const [workspace] = await sql<Array<{ id: string }>>`
      select workspace.id
      from public.workspaces as workspace
      join public.workspace_memberships as membership
        on membership.workspace_id = workspace.id
       and membership.user_id = ${input.actorId}
       and membership.role in ('owner', 'admin')
      where workspace.id = ${input.workspaceId}
      for update of workspace
    `;

    if (!workspace) {
      throw new AppError("NOT_FOUND", "Workspace not found.");
    }

    const projectId = crypto.randomUUID();
    const [project] = await sql<ProjectRow[]>`
      insert into public.projects (
        id,
        workspace_id,
        name,
        description,
        created_by
      )
      values (
        ${projectId},
        ${workspace.id},
        ${input.name},
        ${input.description},
        ${input.actorId}
      )
      returning id, workspace_id, name, description
    `;

    if (!project) {
      throw new Error("Project creation did not return the project.");
    }

    return {
      id: project.id,
      workspaceId: project.workspace_id,
      name: project.name,
      description: project.description,
    };
  });
}
