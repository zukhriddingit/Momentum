import "server-only";

import { database } from "@/server/db/client";

export async function markAllNotificationsRead(input: {
  actorId: string;
  occurredAt: Date;
}): Promise<number> {
  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new TypeError("A valid notification read time is required.");
  }

  const rows = await database()<Array<{ id: string }>>`
    update public.notifications
    set read_at = ${input.occurredAt}
    where user_id = ${input.actorId}
      and read_at is null
    returning id
  `;

  return rows.length;
}
