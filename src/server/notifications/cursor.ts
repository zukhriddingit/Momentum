import { z } from "zod";

const notificationCursorSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: z.uuid(),
  })
  .strict();

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export function encodeNotificationCursor(cursor: NotificationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeNotificationCursor(value: string): NotificationCursor {
  try {
    return notificationCursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new TypeError("Invalid notification cursor.");
  }
}
