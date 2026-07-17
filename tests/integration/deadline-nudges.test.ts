import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { scanDeadlineNudges } from "@/server/notifications/scan-deadline-nudges";
import { createProject } from "@/server/projects/create-project";
import { createTask } from "@/server/tasks/create-task";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

const addMilliseconds = (date: Date, milliseconds: number) =>
  new Date(date.getTime() + milliseconds);
const addHours = (date: Date, hours: number) =>
  addMilliseconds(date, hours * 60 * 60 * 1000);

describe("deadline nudge scanner", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("uses exact windows, preferences, task state, and deadline identities", async () => {
    const userId = selfServiceUuid(700);
    const disabledUserId = selfServiceUuid(701);
    const occurredAt = new Date("2026-07-16T15:00:00.000Z");
    await Promise.all([
      insertAuthUser({
        id: userId,
        email: "nudges-enabled@momentum.local",
        displayName: "Nudges Enabled",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: disabledUserId,
        email: "nudges-disabled@momentum.local",
        displayName: "Nudges Disabled",
        timezone: "America/New_York",
      }),
    ]);
    const workspace = await createWorkspace({
      actorId: userId,
      name: "Deadline Workspace",
    });
    await database()`
      insert into public.workspace_memberships (workspace_id, user_id, role)
      values (${workspace.id}, ${disabledUserId}, 'member')
    `;
    await database()`
      update public.motivation_preferences
      set deadline_nudges_enabled = false
      where user_id = ${disabledUserId}
    `;
    const project = await createProject({
      actorId: userId,
      workspaceId: workspace.id,
      name: "Deadline Project",
      description: null,
    });

    const createDeadlineTask = (input: {
      title: string;
      assigneeId?: string;
      dueAt: Date;
    }) =>
      createTask({
        actorId: userId,
        projectId: project.id,
        title: input.title,
        description: null,
        assigneeId: input.assigneeId ?? userId,
        effort: "small",
        dueAt: input.dueAt,
        status: "todo",
        occurredAt,
      });

    const [dueSoon, outsideWindow, overdue, completed, disabled] =
      await Promise.all([
        createDeadlineTask({
          title: "Due in exactly 24 hours",
          dueAt: addHours(occurredAt, 24),
        }),
        createDeadlineTask({
          title: "Outside by one millisecond",
          dueAt: addMilliseconds(addHours(occurredAt, 24), 1),
        }),
        createDeadlineTask({
          title: "Overdue at scan time",
          dueAt: occurredAt,
        }),
        createDeadlineTask({
          title: "Already completed",
          dueAt: addHours(occurredAt, 1),
        }),
        createDeadlineTask({
          title: "Nudges disabled",
          assigneeId: disabledUserId,
          dueAt: addHours(occurredAt, 1),
        }),
      ]);
    await database()`
      update public.tasks
      set status = 'done'
      where id = ${completed.taskId}
    `;

    const [artifactsBefore] = await database()<
      Array<{
        completion_count: number;
        ledger_count: number;
        streak_count: number;
        grant_count: number;
      }>
    >`
      select
        (select count(*)::integer from public.task_completions where recipient_id in (${userId}, ${disabledUserId})) as completion_count,
        (select count(*)::integer from public.point_ledger where user_id in (${userId}, ${disabledUserId})) as ledger_count,
        (select count(*)::integer from public.focus_streaks where user_id in (${userId}, ${disabledUserId})) as streak_count,
        (select count(*)::integer from public.achievement_grants where user_id in (${userId}, ${disabledUserId})) as grant_count
    `;

    const first = await scanDeadlineNudges({ occurredAt });
    const retry = await scanDeadlineNudges({ occurredAt });
    expect(first).toEqual({ scannedCount: 3, createdCount: 3 });
    expect(retry).toEqual({ scannedCount: 3, createdCount: 0 });

    const firstNotifications = await database()<
      Array<{ event_type: string; task_id: string; deadline_at: Date }>
    >`
      select event_type::text, task_id, deadline_at
      from public.notifications
      where user_id = ${userId}
      order by event_type, task_id
    `;
    expect(firstNotifications).toEqual([
      expect.objectContaining({
        event_type: "deadline_approaching",
        task_id: dueSoon.taskId,
      }),
      expect.objectContaining({
        event_type: "overdue_recovery",
        task_id: overdue.taskId,
      }),
    ]);

    const changedDeadline = addHours(occurredAt, 23);
    await database()`
      update public.tasks
      set due_at = ${changedDeadline}
      where id = ${dueSoon.taskId}
    `;
    expect(await scanDeadlineNudges({ occurredAt })).toEqual({
      scannedCount: 3,
      createdCount: 1,
    });

    await database()`
      update public.tasks
      set status = 'done'
      where id = ${dueSoon.taskId}
    `;
    expect(await scanDeadlineNudges({ occurredAt })).toEqual({
      scannedCount: 2,
      createdCount: 0,
    });

    const [finalCounts] = await database()<
      Array<{
        enabled_notification_count: number;
        disabled_notification_count: number;
        outside_notification_count: number;
        completed_notification_count: number;
        due_soon_identity_count: number;
      }>
    >`
      select
        (select count(*)::integer from public.notifications where user_id = ${userId}) as enabled_notification_count,
        (select count(*)::integer from public.notifications where user_id = ${disabledUserId}) as disabled_notification_count,
        (select count(*)::integer from public.notifications where task_id = ${outsideWindow.taskId}) as outside_notification_count,
        (select count(*)::integer from public.notifications where task_id = ${completed.taskId}) as completed_notification_count,
        (select count(*)::integer from public.notifications where task_id = ${dueSoon.taskId}) as due_soon_identity_count
    `;
    expect(finalCounts).toEqual({
      enabled_notification_count: 3,
      disabled_notification_count: 0,
      outside_notification_count: 0,
      completed_notification_count: 0,
      due_soon_identity_count: 2,
    });

    const [artifactsAfter] = await database()<(typeof artifactsBefore)[]>`
      select
        (select count(*)::integer from public.task_completions where recipient_id in (${userId}, ${disabledUserId})) as completion_count,
        (select count(*)::integer from public.point_ledger where user_id in (${userId}, ${disabledUserId})) as ledger_count,
        (select count(*)::integer from public.focus_streaks where user_id in (${userId}, ${disabledUserId})) as streak_count,
        (select count(*)::integer from public.achievement_grants where user_id in (${userId}, ${disabledUserId})) as grant_count
    `;
    expect(artifactsAfter).toEqual(artifactsBefore);

    const statuses = await database()<Array<{ id: string; status: string }>>`
      select id, status::text
      from public.tasks
      where id in (
        ${dueSoon.taskId},
        ${outsideWindow.taskId},
        ${overdue.taskId},
        ${completed.taskId},
        ${disabled.taskId}
      )
      order by id
    `;
    expect(statuses.filter(({ status }) => status === "done")).toHaveLength(2);
  });
});
