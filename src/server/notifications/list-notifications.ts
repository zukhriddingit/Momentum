import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "@/server/notifications/cursor";
import {
  mapNotificationItem,
  type NotificationPage,
  type NotificationRow,
} from "@/server/notifications/types";

const PAGE_SIZE = 20;

export async function listNotifications(input: {
  actorId: string;
  cursor: string | null;
}): Promise<NotificationPage> {
  const cursor = input.cursor ? decodeNotificationCursor(input.cursor) : null;
  const sql = database();
  const [profileRows, rows] = await Promise.all([
    sql<Array<{ timezone: string }>>`
      select timezone
      from public.profiles
      where id = ${input.actorId}
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
        and (
          ${cursor?.createdAt ?? null}::timestamptz is null
          or (created_at, id) < (
            ${cursor?.createdAt ?? null}::timestamptz,
            ${cursor?.id ?? null}::uuid
          )
        )
      order by created_at desc, id desc
      limit 21
    `,
  ]);
  const profile = profileRows[0];
  if (!profile) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  const pageRows = rows.slice(0, PAGE_SIZE);
  const cursorRow = rows.length > PAGE_SIZE ? pageRows.at(-1) : null;

  return {
    timezone: profile.timezone,
    items: pageRows.map(mapNotificationItem),
    nextCursor: cursorRow
      ? encodeNotificationCursor({
          createdAt: cursorRow.created_at.toISOString(),
          id: cursorRow.id,
        })
      : null,
  };
}
