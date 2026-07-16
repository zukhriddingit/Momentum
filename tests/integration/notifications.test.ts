import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { createProject } from "@/server/projects/create-project";
import { createTask } from "@/server/tasks/create-task";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { getNotificationSummary } from "@/server/notifications/get-notification-summary";
import { listNotifications } from "@/server/notifications/list-notifications";
import { markAllNotificationsRead } from "@/server/notifications/mark-all-notifications-read";
import { markNotificationRead } from "@/server/notifications/mark-notification-read";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

describe("owned notification center", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("bounds history, persists reads, and hides cross-user rows", async () => {
    const userA = selfServiceUuid(500);
    const userB = selfServiceUuid(501);
    const occurredAt = new Date("2026-07-16T15:00:00.000Z");
    await Promise.all([
      insertAuthUser({
        id: userA,
        email: "notifications-a@momentum.local",
        displayName: "Notifications A",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: userB,
        email: "notifications-b@momentum.local",
        displayName: "Notifications B",
        timezone: "America/Los_Angeles",
      }),
    ]);
    const workspace = await createWorkspace({
      actorId: userA,
      name: "Notification Workspace",
    });
    const project = await createProject({
      actorId: userA,
      workspaceId: workspace.id,
      name: "Notification Project",
      description: null,
    });
    const task = await createTask({
      actorId: userA,
      projectId: project.id,
      title: "Notification destination",
      description: null,
      assigneeId: userA,
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt,
    });

    await database().begin(async (sql) => {
      for (let index = 0; index < 23; index += 1) {
        await sql`
          insert into public.notifications (
            id,
            user_id,
            workspace_id,
            project_id,
            task_id,
            event_type,
            source_id,
            tone,
            template_key,
            title,
            body,
            deadline_at,
            created_at
          ) values (
            ${selfServiceUuid(520 + index)},
            ${userA},
            ${workspace.id},
            ${project.id},
            ${task.taskId},
            'task_completed',
            ${selfServiceUuid(620 + index)},
            'friendly',
            ${`task_completed-friendly-test-${index}`},
            ${`Progress ${index + 1}`},
            ${`Supportive notification ${index + 1}.`},
            null,
            ${new Date(occurredAt.getTime() + index * 60_000)}
          )
        `;
      }
    });

    const summary = await getNotificationSummary({ actorId: userA });
    expect(summary.timezone).toBe("America/New_York");
    expect(summary.unreadCount).toBe(23);
    expect(summary.recent).toHaveLength(5);
    expect("sourceId" in summary.recent[0]!).toBe(false);
    expect(summary.recent[0]?.destination).toEqual({
      workspaceId: workspace.id,
      projectId: project.id,
      taskId: task.taskId,
    });

    const firstPage = await listNotifications({
      actorId: userA,
      cursor: null,
    });
    expect(firstPage.timezone).toBe("America/New_York");
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await listNotifications({
      actorId: userA,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items).toHaveLength(3);
    expect(secondPage.nextCursor).toBeNull();

    const notificationId = firstPage.items[0]!.id;
    await expect(
      markNotificationRead({
        actorId: userB,
        notificationId,
        occurredAt,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Notification not found.",
    });

    await markNotificationRead({
      actorId: userA,
      notificationId,
      occurredAt,
    });
    await expect(
      markNotificationRead({
        actorId: userA,
        notificationId,
        occurredAt,
      }),
    ).resolves.toBeUndefined();
    expect((await getNotificationSummary({ actorId: userA })).unreadCount).toBe(
      22,
    );

    await markAllNotificationsRead({ actorId: userA, occurredAt });
    expect((await getNotificationSummary({ actorId: userA })).unreadCount).toBe(
      0,
    );
    expect((await getNotificationSummary({ actorId: userB })).unreadCount).toBe(
      0,
    );
  });

  it("rejects malformed opaque cursors before querying history", async () => {
    await expect(
      listNotifications({
        actorId: selfServiceUuid(500),
        cursor: "not-a-notification-cursor",
      }),
    ).rejects.toThrow("Invalid notification cursor.");
  });
});
