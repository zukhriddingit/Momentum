import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";

export async function markNotificationRead(input: {
  actorId: string;
  notificationId: string;
  occurredAt: Date;
}): Promise<void> {
  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new TypeError("A valid notification read time is required.");
  }

  const sql = database();
  const updatedRows = await sql<Array<{ id: string }>>`
    update public.notifications
    set read_at = ${input.occurredAt}
    where id = ${input.notificationId}
      and user_id = ${input.actorId}
      and read_at is null
    returning id
  `;
  if (updatedRows[0]) {
    return;
  }

  const ownedRows = await sql<Array<{ id: string }>>`
    select id
    from public.notifications
    where id = ${input.notificationId}
      and user_id = ${input.actorId}
  `;
  if (ownedRows[0]) {
    return;
  }

  throw new AppError("NOT_FOUND", "Notification not found.");
}
