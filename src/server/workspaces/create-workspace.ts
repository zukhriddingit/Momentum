import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { WorkspaceSummary } from "@/server/types";

export async function createWorkspace(input: {
  actorId: string;
  name: string;
}): Promise<WorkspaceSummary> {
  const workspaceId = crypto.randomUUID();

  return database().begin(async (sql) => {
    const [workspace] = await sql<Array<{ id: string; name: string }>>`
      insert into public.workspaces (id, name, created_by)
      select ${workspaceId}, ${input.name}, profile.id
      from public.profiles as profile
      where profile.id = ${input.actorId}
      returning id, name
    `;

    if (!workspace) {
      throw new AppError("NOT_FOUND", "Profile not found.");
    }

    await sql`
      insert into public.workspace_memberships (workspace_id, user_id, role)
      values (${workspace.id}, ${input.actorId}, 'owner')
    `;

    return {
      id: workspace.id,
      name: workspace.name,
      role: "owner" as const,
    };
  });
}
