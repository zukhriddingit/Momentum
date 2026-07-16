import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  mapNotificationItem,
  type NotificationRow,
  type NotificationSummary,
} from "@/server/notifications/types";

export async function getNotificationSummary(input: {
  actorId: string;
}): Promise<NotificationSummary> {
  const sql = database();
  const [profileRows, countRows, recentRows] = await Promise.all([
    sql<Array<{ timezone: string }>>`
      select timezone
      from public.profiles
      where id = ${input.actorId}
    `,
    sql<Array<{ unread_count: number }>>`
      select count(*)::integer as unread_count
      from public.notifications
      where user_id = ${input.actorId}
        and read_at is null
    `,
    sql<NotificationRow[]>`
      select
        id,
        event_type::text as event_type,
        title,
        body,
        tone::text as tone,
        created_at,
        read_at,
        workspace_id,
        project_id,
        task_id
      from public.notifications
      where user_id = ${input.actorId}
      order by created_at desc, id desc
      limit 5
    `,
  ]);
  const profile = profileRows[0];
  if (!profile) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  return {
    timezone: profile.timezone,
    unreadCount: countRows[0]?.unread_count ?? 0,
    recent: recentRows.map(mapNotificationItem),
  };
}
