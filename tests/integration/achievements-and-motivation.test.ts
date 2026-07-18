import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { selectFocusTask } from "@/server/focus/select-focus-task";
import { createProject } from "@/server/projects/create-project";
import { completeTask } from "@/server/tasks/complete-task";
import { createTask } from "@/server/tasks/create-task";
import { moveTask } from "@/server/tasks/move-task";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

const occurredAt = new Date("2026-07-15T15:00:00.000Z");

async function createPersonalProject(sequence: number, label: string) {
  const userId = selfServiceUuid(sequence);
  await insertAuthUser({
    id: userId,
    email: `motivation-${sequence}@momentum.local`,
    displayName: label,
    timezone: "America/New_York",
  });
  const workspace = await createWorkspace({
    actorId: userId,
    name: `${label} Workspace`,
  });
  const project = await createProject({
    actorId: userId,
    workspaceId: workspace.id,
    name: `${label} Project`,
    description: null,
  });

  return { userId, projectId: project.id };
}

async function createTodoTask(input: {
  userId: string;
  projectId: string;
  title: string;
  at?: Date;
}) {
  return createTask({
    actorId: input.userId,
    projectId: input.projectId,
    title: input.title,
    description: null,
    assignee: { kind: "member", userId: input.userId },
    effort: "small",
    dueAt: null,
    status: "todo",
    occurredAt: input.at ?? occurredAt,
  });
}

describe("achievement and motivation completion integration", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("grants only First Step for a first non-Focus completion", async () => {
    const fixture = await createPersonalProject(300, "First Step Member");
    const task = await createTodoTask({
      ...fixture,
      title: "Complete a clear first step",
    });

    const receipt = await completeTask({
      actorId: fixture.userId,
      taskId: task.taskId,
      occurredAt,
    });

    expect(receipt).toMatchObject({
      taskTitle: "Complete a clear first step",
      streakIncremented: false,
      achievements: [{ code: "first_step", name: "First Step" }],
      message: { event: "achievement_unlocked", tone: "friendly" },
    });
  });

  it("grants First Step and Focused Finish once on a first Focus completion", async () => {
    const fixture = await createPersonalProject(301, "Focused Finish Member");
    const task = await createTodoTask({
      ...fixture,
      title: "Finish the first focus",
    });
    await selectFocusTask({
      actorId: fixture.userId,
      taskId: task.taskId,
      occurredAt,
    });

    const receipt = await completeTask({
      actorId: fixture.userId,
      taskId: task.taskId,
      occurredAt,
    });

    expect(receipt.achievements.map(({ code }) => code)).toEqual([
      "first_step",
      "focused_finish",
    ]);
    expect(receipt).toMatchObject({
      preCompletionStreak: 0,
      postCompletionStreak: 1,
      streakIncremented: true,
      message: { event: "achievement_unlocked", tone: "friendly" },
    });
  });

  it("grants Five-Day Flow on an authoritative four-to-five transition", async () => {
    const fixture = await createPersonalProject(302, "Five Day Member");
    const workdays = [
      "2026-07-13T15:00:00.000Z",
      "2026-07-14T15:00:00.000Z",
      "2026-07-15T15:00:00.000Z",
      "2026-07-16T15:00:00.000Z",
      "2026-07-17T15:00:00.000Z",
    ].map((instant) => new Date(instant));
    let finalReceipt = null;

    for (const [index, workday] of workdays.entries()) {
      const task = await createTodoTask({
        ...fixture,
        title: `Focus day ${index + 1}`,
        at: workday,
      });
      await selectFocusTask({
        actorId: fixture.userId,
        taskId: task.taskId,
        occurredAt: workday,
      });
      finalReceipt = await completeTask({
        actorId: fixture.userId,
        taskId: task.taskId,
        occurredAt: workday,
      });
    }

    expect(finalReceipt).not.toBeNull();
    expect(finalReceipt).toMatchObject({
      preCompletionStreak: 4,
      postCompletionStreak: 5,
      achievements: [{ code: "five_day_flow", name: "Five-Day Flow" }],
      message: { event: "achievement_unlocked" },
    });
  });

  it("serializes different-task completions so First Step is granted once", async () => {
    const fixture = await createPersonalProject(303, "Concurrent Member");
    const [firstTask, secondTask] = await Promise.all([
      createTodoTask({ ...fixture, title: "Concurrent task one" }),
      createTodoTask({ ...fixture, title: "Concurrent task two" }),
    ]);

    const receipts = await Promise.all([
      completeTask({
        actorId: fixture.userId,
        taskId: firstTask.taskId,
        occurredAt,
      }),
      completeTask({
        actorId: fixture.userId,
        taskId: secondTask.taskId,
        occurredAt,
      }),
    ]);
    const [grantCount] = await database()<Array<{ count: number }>>`
      select count(*)::integer as count
      from public.achievement_grants
      where user_id = ${fixture.userId}
        and achievement_code = 'first_step'
    `;

    expect(grantCount?.count).toBe(1);
    expect(
      receipts.flatMap(({ achievements }) =>
        achievements.map(({ code }) => code),
      ),
    ).toEqual(["first_step"]);
  });

  it("keeps same-task concurrency and recompletion exactly once", async () => {
    const fixture = await createPersonalProject(304, "Idempotent Member");
    const task = await createTodoTask({
      ...fixture,
      title: "One immutable completion",
    });

    const concurrent = await Promise.all([
      completeTask({
        actorId: fixture.userId,
        taskId: task.taskId,
        occurredAt,
      }),
      completeTask({
        actorId: fixture.userId,
        taskId: task.taskId,
        occurredAt,
      }),
    ]);
    const fresh = concurrent.find(({ wasNewCompletion }) => wasNewCompletion);
    if (!fresh) {
      throw new Error("Expected one new completion receipt.");
    }

    await moveTask({
      actorId: fixture.userId,
      taskId: task.taskId,
      status: "in_progress",
      occurredAt,
    });
    const replay = await completeTask({
      actorId: fixture.userId,
      taskId: task.taskId,
      occurredAt,
    });
    const [artifacts] = await database()<
      Array<{
        completion_count: number;
        ledger_count: number;
        grant_count: number;
        notification_count: number;
      }>
    >`
      select
        (select count(*)::integer from public.task_completions where task_id = ${task.taskId}) as completion_count,
        (select count(*)::integer from public.point_ledger where completion_id = ${fresh.completionId}) as ledger_count,
        (select count(*)::integer from public.achievement_grants where completion_id = ${fresh.completionId}) as grant_count,
        (select count(*)::integer from public.notifications where source_id = ${fresh.completionId}) as notification_count
    `;

    expect(replay).toMatchObject({
      completionId: fresh.completionId,
      wasNewCompletion: false,
      achievements: [{ code: "first_step" }],
      message: fresh.message,
    });
    expect(artifacts).toEqual({
      completion_count: 1,
      ledger_count: 1,
      grant_count: 1,
      notification_count: 1,
    });
  });
});
