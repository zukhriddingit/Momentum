import type { MotivationTone } from "@/domain/motivation/types";

export type NotificationEventType =
  | "task_completed"
  | "focus_task_completed"
  | "achievement_unlocked"
  | "streak_extended"
  | "deadline_approaching"
  | "overdue_recovery";

export interface NotificationItem {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  tone: MotivationTone;
  createdAt: string;
  readAt: string | null;
  destination: {
    workspaceId: string;
    projectId: string;
    taskId: string | null;
  } | null;
}

export interface NotificationSummary {
  timezone: string;
  unreadCount: number;
  recent: NotificationItem[];
}

export interface NotificationPage {
  timezone: string;
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface NotificationRow {
  id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  tone: MotivationTone;
  created_at: Date;
  read_at: Date | null;
  workspace_id: string;
  project_id: string | null;
  task_id: string | null;
}

export function mapNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    tone: row.tone,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
    destination: row.project_id
      ? {
          workspaceId: row.workspace_id,
          projectId: row.project_id,
          taskId: row.task_id,
        }
      : null,
  };
}
