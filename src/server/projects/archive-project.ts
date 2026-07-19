import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { ArchiveProjectReceipt } from "@/server/types";

interface ArchivableProjectRow {
  id: string;
  workspace_id: string;
  archived_at: Date | null;
}

export async function archiveProject(input: {
  actorId: string;
  projectId: string;
}): Promise<ArchiveProjectReceipt> {
  return database().begin(async (sql) => {
    const [authorized] = await sql<ArchivableProjectRow[]>`
      select project.id, project.workspace_id, project.archived_at
      from public.projects as project
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
       and membership.user_id = ${input.actorId}
       and membership.role in ('owner', 'admin')
      where project.id = ${input.projectId}
      for update of project
    `;
    if (!authorized) {
      throw new AppError("NOT_FOUND", "Project not found.");
    }

    const [project] = await sql<ArchivableProjectRow[]>`
      update public.projects
      set
        archived_at = coalesce(archived_at, now()),
        updated_at = case when archived_at is null then now() else updated_at end
      where id = ${authorized.id}
      returning id, workspace_id, archived_at
    `;
    if (!project?.archived_at) {
      throw new Error("Project archive did not return an archive time.");
    }

    return {
      projectId: project.id,
      workspaceId: project.workspace_id,
      archivedAt: project.archived_at.toISOString(),
    };
  });
}
