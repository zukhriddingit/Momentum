import { afterAll, describe, expect, it } from "vitest";

import { selectFocusTask } from "@/server/focus/select-focus-task";
import { closeDatabase, database } from "@/server/db/client";
import { completeTask } from "@/server/tasks/complete-task";
import { getCompletionCelebration } from "@/server/tasks/get-completion-celebration";
import { moveTask } from "@/server/tasks/move-task";
import { DEMO, demoWorkdayInstant } from "../fixtures/demo";

describe("first completion transaction", () => {
  const occurredAt = demoWorkdayInstant();

  afterAll(async () => {
    await closeDatabase();
  });

  it("awards the seeded Focus Task exactly once, even after reopening", async () => {
    await selectFocusTask({
      actorId: DEMO.userId,
      taskId: DEMO.candidateTaskId,
      occurredAt,
    });
    await moveTask({
      actorId: DEMO.userId,
      taskId: DEMO.candidateTaskId,
      status: "in_progress",
      occurredAt,
    });

    const [first, duplicate] = await Promise.all([
      completeTask({
        actorId: DEMO.userId,
        taskId: DEMO.candidateTaskId,
        occurredAt,
      }),
      completeTask({
        actorId: DEMO.userId,
        taskId: DEMO.candidateTaskId,
        occurredAt,
      }),
    ]);
    const fresh = [first, duplicate].find(
      (receipt) => receipt.wasNewCompletion,
    );
    const replay = [first, duplicate].find(
      (receipt) => !receipt.wasNewCompletion,
    );
    if (!fresh || !replay) {
      throw new Error("Expected one new completion and one idempotent replay.");
    }

    expect(fresh).toMatchObject({
      taskTitle: "Prepare launch brief",
      points: {
        basePoints: 40,
        timingBonus: 8,
        streakBonus: 4,
        finalPoints: 52,
      },
      preCompletionStreak: 2,
      postCompletionStreak: 3,
      streakIncremented: true,
      achievements: [
        { code: "momentum_three", name: "Momentum Three" },
        { code: "ahead_of_schedule", name: "Ahead of Schedule" },
      ],
      message: {
        event: "achievement_unlocked",
        tone: "friendly",
      },
      projectProgress: { doneTasks: 3, totalTasks: 4, percentComplete: 75 },
    });
    expect(replay).toMatchObject({
      completionId: fresh.completionId,
      wasNewCompletion: false,
      points: { finalPoints: 52 },
    });

    const originalMessage = fresh.message;
    await database()`
      update public.profiles
      set motivation_tone = 'minimal'
      where id = ${DEMO.userId}
    `;
    const persistedCelebration = await getCompletionCelebration({
      actorId: DEMO.userId,
      completionId: fresh.completionId,
    });
    expect(persistedCelebration).toMatchObject({
      taskTitle: "Prepare launch brief",
      points: { finalPoints: 52 },
      achievements: [
        { code: "momentum_three", name: "Momentum Three" },
        { code: "ahead_of_schedule", name: "Ahead of Schedule" },
      ],
      message: originalMessage,
    });

    const sql = database();
    const beforeReopen = await sql<
      Array<{
        completion_count: number;
        ledger_count: number;
        ledger_points: number;
        achievement_count: number;
        notification_count: number;
        current_count: number;
        longest_count: number;
      }>
    >`
      select
        (select count(*)::integer from public.task_completions where task_id = ${DEMO.candidateTaskId}) as completion_count,
        (select count(*)::integer from public.point_ledger where completion_id = ${fresh.completionId}) as ledger_count,
        (select coalesce(sum(points), 0)::integer from public.point_ledger where completion_id = ${fresh.completionId}) as ledger_points,
        (select count(*)::integer from public.achievement_grants where completion_id = ${fresh.completionId}) as achievement_count,
        (select count(*)::integer from public.notifications where source_id = ${fresh.completionId}) as notification_count,
        streak.current_count,
        streak.longest_count
      from public.focus_streaks as streak
      where streak.user_id = ${DEMO.userId}
    `;
    expect(beforeReopen[0]).toEqual({
      completion_count: 1,
      ledger_count: 3,
      ledger_points: 52,
      achievement_count: 2,
      notification_count: 1,
      current_count: 3,
      longest_count: 3,
    });

    await moveTask({
      actorId: DEMO.userId,
      taskId: DEMO.candidateTaskId,
      status: "in_progress",
      occurredAt,
    });
    const recompletion = await completeTask({
      actorId: DEMO.userId,
      taskId: DEMO.candidateTaskId,
      occurredAt,
    });
    expect(recompletion).toMatchObject({
      completionId: fresh.completionId,
      wasNewCompletion: false,
      points: { finalPoints: 52 },
      projectProgress: { doneTasks: 3, totalTasks: 4, percentComplete: 75 },
    });

    const afterRecompletion = await sql<
      Array<{
        completion_count: number;
        ledger_count: number;
        ledger_points: number;
        achievement_count: number;
        notification_count: number;
        task_status: string;
      }>
    >`
      select
        (select count(*)::integer from public.task_completions where task_id = ${DEMO.candidateTaskId}) as completion_count,
        (select count(*)::integer from public.point_ledger where completion_id = ${fresh.completionId}) as ledger_count,
        (select coalesce(sum(points), 0)::integer from public.point_ledger where completion_id = ${fresh.completionId}) as ledger_points,
        (select count(*)::integer from public.achievement_grants where completion_id = ${fresh.completionId}) as achievement_count,
        (select count(*)::integer from public.notifications where source_id = ${fresh.completionId}) as notification_count,
        task.status::text as task_status
      from public.tasks as task
      where task.id = ${DEMO.candidateTaskId}
    `;
    expect(afterRecompletion[0]).toEqual({
      completion_count: 1,
      ledger_count: 3,
      ledger_points: 52,
      achievement_count: 2,
      notification_count: 1,
      task_status: "done",
    });
  });
});
