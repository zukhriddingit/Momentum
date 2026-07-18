import "server-only";

import type postgres from "postgres";

import { AppError } from "@/server/errors";
import type { TaskAssigneeRef } from "@/server/types";

export type ResolvedTaskAssignee =
  | { assigneeId: string; cohortSeatId: null; pending: false }
  | { assigneeId: null; cohortSeatId: string; pending: true };

export async function resolveTaskAssignee(
  sql: postgres.TransactionSql,
  workspaceId: string,
  assignee: TaskAssigneeRef,
): Promise<ResolvedTaskAssignee> {
  if (assignee.kind === "member") {
    const [membership] = await sql<Array<{ user_id: string }>>`
      select user_id from public.workspace_memberships
      where workspace_id = ${workspaceId} and user_id = ${assignee.userId}
      for key share
    `;
    if (!membership) throw new AppError("NOT_FOUND", "Task not found.");
    return {
      assigneeId: membership.user_id,
      cohortSeatId: null,
      pending: false,
    };
  }

  const [seat] = await sql<Array<{ id: string }>>`
    select id from public.workspace_cohort_seats
    where id = ${assignee.seatId}
      and workspace_id = ${workspaceId}
      and user_id is null
    for key share
  `;
  if (!seat) throw new AppError("NOT_FOUND", "Task not found.");
  return { assigneeId: null, cohortSeatId: seat.id, pending: true };
}
