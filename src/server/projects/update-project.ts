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

export async function updateProject(input: {
  actorId: string;
  projectId: string;
  name: string;
  description: string | null;
}): Promise<ProjectSummary> {
  return database().begin(async (sql) => {
    const [authorizedProject] = await sql<Array<{ id: string }>>`
      select project.id
      from public.projects as project
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
       and membership.user_id = ${input.actorId}
       and membership.role in ('owner', 'admin')
      where project.id = ${input.projectId}
      for update of project
    `;

    if (!authorizedProject) {
      throw new AppError("NOT_FOUND", "Project not found.");
    }

    const [project] = await sql<ProjectRow[]>`
      update public.projects
      set
        name = ${input.name},
        description = ${input.description},
        updated_at = now()
      where id = ${authorizedProject.id}
      returning id, workspace_id, name, description
    `;

    if (!project) {
      throw new Error("Project update did not return the project.");
    }

    return {
      id: project.id,
      workspaceId: project.workspace_id,
      name: project.name,
      description: project.description,
    };
  });
}
