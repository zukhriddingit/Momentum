import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";

export async function requireWorkspaceManager(input: {
  actorId: string;
  workspaceId: string;
}): Promise<void> {
  const [membership] = await database()<Array<{ workspace_id: string }>>`
    select membership.workspace_id
    from public.workspace_memberships as membership
    where membership.workspace_id = ${input.workspaceId}
      and membership.user_id = ${input.actorId}
      and membership.role in ('owner', 'admin')
  `;

  if (!membership) {
    throw new AppError("NOT_FOUND", "Workspace not found.");
  }
}
