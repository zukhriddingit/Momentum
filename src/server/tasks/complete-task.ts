import "server-only";

import { earnedMomentumThree } from "@/domain/achievements/momentum-three";
import { selectFocusCompletionMessage } from "@/domain/motivation/focus-complete";
import { calculatePointBreakdown } from "@/domain/rewards/calculate-point-breakdown";
import type { EffortLevel, PointBreakdown } from "@/domain/rewards/types";
import {
  calculateStreakTransition,
  resolvePreCompletionStreak,
  type FocusSelectionOutcome,
} from "@/domain/streaks/calculate-streak-transition";
import { toWorkDate } from "@/domain/streaks/work-date";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { CompletionReceipt, TaskStatus } from "@/server/types";

interface CompletionTaskRow {
  id: string;
  title: string;
  assignee_id: string;
  status: TaskStatus;
  effort: EffortLevel;
  due_at: Date | null;
  project_id: string;
  workspace_id: string;
  timezone: string;
  motivation_tone: "calm" | "friendly" | "energetic" | "minimal";
}

interface ExistingCompletionRow {
  id: string;
  task_id: string;
  project_id: string;
  workspace_id: string;
  task_title: string;
  base_points: number;
  timing_multiplier: string;
  streak_multiplier: string;
  pre_completion_streak: number;
  post_completion_streak: number;
  final_points: number;
  message_title: string;
  message_body: string;
  achievement_name: string | null;
  done_tasks: number;
  total_tasks: number;
  percent_complete: number;
}

interface StreakRow {
  current_count: number;
  longest_count: number;
  last_completed_work_date: string | null;
}

function pointBreakdownFromReceipt(row: ExistingCompletionRow): PointBreakdown {
  const timingMultiplier = Number(row.timing_multiplier) as 1 | 1.1 | 1.2;
  const timingBonus =
    Math.round(row.base_points * timingMultiplier) - row.base_points;

  return {
    basePoints: row.base_points,
    timingMultiplier,
    streakMultiplier: Number(row.streak_multiplier),
    timingBonus,
    streakBonus: row.final_points - row.base_points - timingBonus,
    finalPoints: row.final_points,
  };
}

function receiptFromRow(
  row: ExistingCompletionRow,
  wasNewCompletion: boolean,
): CompletionReceipt {
  return {
    completionId: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    taskTitle: row.task_title,
    wasNewCompletion,
    points: pointBreakdownFromReceipt(row),
    preCompletionStreak: row.pre_completion_streak,
    postCompletionStreak: row.post_completion_streak,
    achievement:
      row.achievement_name === "Momentum Three" ? "Momentum Three" : null,
    message: { title: row.message_title, body: row.message_body },
    projectProgress: {
      doneTasks: row.done_tasks,
      totalTasks: row.total_tasks,
      percentComplete: row.percent_complete,
    },
  };
}

export async function completeTask(input: {
  actorId: string;
  taskId: string;
  occurredAt: Date;
}): Promise<CompletionReceipt> {
  return database().begin(async (sql) => {
    const taskRows = await sql<CompletionTaskRow[]>`
      select
        task.id,
        task.title,
        task.assignee_id,
        task.status,
        task.effort,
        task.due_at,
        project.id as project_id,
        project.workspace_id,
        profile.timezone,
        profile.motivation_tone
      from public.tasks as task
      join public.projects as project on project.id = task.project_id
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
        and membership.user_id = ${input.actorId}
      join public.profiles as profile on profile.id = task.assignee_id
      where task.id = ${input.taskId}
        and task.assignee_id = ${input.actorId}
      for update of task
    `;
    const task = taskRows[0];
    if (!task) {
      throw new AppError(
        "FORBIDDEN",
        "Only the assignee can complete this workspace task.",
      );
    }

    const existingRows = await sql<ExistingCompletionRow[]>`
      select
        completion.id,
        completion.task_id,
        completion.project_id,
        completion.workspace_id,
        task.title as task_title,
        completion.base_points,
        completion.timing_multiplier,
        completion.streak_multiplier,
        completion.pre_completion_streak,
        completion.post_completion_streak,
        completion.final_points,
        completion.message_title,
        completion.message_body,
        definition.name as achievement_name,
        progress.done_tasks,
        progress.total_tasks,
        progress.percent_complete
      from public.task_completions as completion
      join public.tasks as task on task.id = completion.task_id
      join public.project_progress as progress
        on progress.project_id = completion.project_id
      left join public.achievement_grants as achievement_grant
        on achievement_grant.completion_id = completion.id
      left join public.achievement_definitions as definition
        on definition.code = achievement_grant.achievement_code
      where completion.task_id = ${input.taskId}
    `;
    const existing = existingRows[0];
    if (existing) {
      if (task.status !== "done") {
        await sql`
          update public.tasks
          set status = 'done', updated_at = ${input.occurredAt}
          where id = ${task.id}
        `;
      }
      const currentProgressRows = await sql<
        Array<{
          done_tasks: number;
          total_tasks: number;
          percent_complete: number;
        }>
      >`
        select done_tasks, total_tasks, percent_complete
        from public.project_progress
        where project_id = ${task.project_id}
      `;
      const currentProgress = currentProgressRows[0];
      return receiptFromRow(
        currentProgress
          ? {
              ...existing,
              done_tasks: currentProgress.done_tasks,
              total_tasks: currentProgress.total_tasks,
              percent_complete: currentProgress.percent_complete,
            }
          : existing,
        false,
      );
    }

    const workDate = toWorkDate(input.occurredAt, task.timezone);
    await sql`
      insert into public.focus_streaks (user_id, current_count, longest_count)
      values (${input.actorId}, 0, 0)
      on conflict (user_id) do nothing
    `;
    const streakRows = await sql<StreakRow[]>`
      select current_count, longest_count, last_completed_work_date
      from public.focus_streaks
      where user_id = ${input.actorId}
      for update
    `;
    const streak = streakRows[0];
    if (!streak) {
      throw new AppError("INTERNAL", "Unable to load Focus Streak state.");
    }

    const focusRows = await sql<Array<{ id: string }>>`
      select id
      from public.focus_selections
      where user_id = ${input.actorId}
        and task_id = ${task.id}
        and work_date = ${workDate}
        and completed_at is null
      for update
    `;
    const focusSelection = focusRows[0] ?? null;
    const interveningRows = await sql<
      Array<{ work_date: string; completed_at: Date | null }>
    >`
      select work_date, completed_at
      from public.focus_selections
      where user_id = ${input.actorId}
        and (${streak.last_completed_work_date}::date is null
          or work_date > ${streak.last_completed_work_date}::date)
        and work_date < ${workDate}::date
      order by work_date
    `;
    const interveningSelections: FocusSelectionOutcome[] = interveningRows.map(
      (selection) => ({
        workDate: selection.work_date,
        completed: selection.completed_at !== null,
      }),
    );
    const resolvedPreStreak = resolvePreCompletionStreak({
      previousCurrentCount: streak.current_count,
      previousLastCompletedWorkDate: streak.last_completed_work_date,
      completionWorkDate: workDate,
      interveningSelections,
    });
    const streakTransition = focusSelection
      ? calculateStreakTransition({
          completionWorkDate: workDate,
          previous: {
            currentCount: streak.current_count,
            longestCount: streak.longest_count,
            lastCompletedWorkDate: streak.last_completed_work_date,
          },
          interveningSelections,
        })
      : null;
    const preCompletionStreak = streakTransition
      ? streakTransition.preCompletionStreak
      : resolvedPreStreak.count;
    const postCompletionStreak = streakTransition
      ? streakTransition.currentCount
      : preCompletionStreak;
    const points = calculatePointBreakdown({
      effort: task.effort,
      dueAt: task.due_at,
      completedAt: input.occurredAt,
      preCompletionStreak,
    });
    const message = selectFocusCompletionMessage();
    const completionId = crypto.randomUUID();

    await sql`
      update public.tasks
      set
        status = 'done',
        first_completed_at = ${input.occurredAt},
        updated_at = ${input.occurredAt}
      where id = ${task.id}
    `;

    if (focusSelection && streakTransition) {
      await sql`
        update public.focus_selections
        set completed_at = ${input.occurredAt}
        where id = ${focusSelection.id}
      `;
      await sql`
        update public.focus_streaks
        set
          current_count = ${streakTransition.currentCount},
          longest_count = ${streakTransition.longestCount},
          last_completed_work_date = ${streakTransition.lastCompletedWorkDate},
          updated_at = ${input.occurredAt}
        where user_id = ${input.actorId}
      `;
    }

    await sql`
      insert into public.task_completions (
        id,
        task_id,
        workspace_id,
        project_id,
        recipient_id,
        actor_id,
        focus_selection_id,
        completed_at,
        base_points,
        timing_multiplier,
        streak_multiplier,
        pre_completion_streak,
        post_completion_streak,
        final_points,
        message_template_key,
        message_title,
        message_body
      ) values (
        ${completionId},
        ${task.id},
        ${task.workspace_id},
        ${task.project_id},
        ${input.actorId},
        ${input.actorId},
        ${focusSelection?.id ?? null},
        ${input.occurredAt},
        ${points.basePoints},
        ${points.timingMultiplier},
        ${points.streakMultiplier},
        ${preCompletionStreak},
        ${postCompletionStreak},
        ${points.finalPoints},
        ${message.key},
        ${message.title},
        ${message.body}
      )
    `;

    const ledgerRows = [
      { id: crypto.randomUUID(), kind: "base", points: points.basePoints },
      ...(points.timingBonus > 0
        ? [
            {
              id: crypto.randomUUID(),
              kind: "timing_bonus",
              points: points.timingBonus,
            },
          ]
        : []),
      ...(points.streakBonus > 0
        ? [
            {
              id: crypto.randomUUID(),
              kind: "streak_bonus",
              points: points.streakBonus,
            },
          ]
        : []),
    ];
    for (const entry of ledgerRows) {
      await sql`
        insert into public.point_ledger (
          id,
          completion_id,
          workspace_id,
          project_id,
          user_id,
          entry_kind,
          points,
          created_at
        ) values (
          ${entry.id},
          ${completionId},
          ${task.workspace_id},
          ${task.project_id},
          ${input.actorId},
          ${entry.kind},
          ${entry.points},
          ${input.occurredAt}
        )
      `;
    }

    const achievementEarned =
      focusSelection !== null &&
      earnedMomentumThree({
        previousCurrentCount: preCompletionStreak,
        newCurrentCount: postCompletionStreak,
      });
    if (achievementEarned) {
      await sql`
        insert into public.achievement_grants (
          id, user_id, achievement_code, completion_id, granted_at
        ) values (
          ${crypto.randomUUID()},
          ${input.actorId},
          'momentum_three',
          ${completionId},
          ${input.occurredAt}
        )
        on conflict (user_id, achievement_code) do nothing
      `;
    }

    await sql`
      insert into public.notifications (
        id,
        user_id,
        workspace_id,
        event_type,
        source_id,
        tone,
        template_key,
        title,
        body,
        created_at
      ) values (
        ${crypto.randomUUID()},
        ${input.actorId},
        ${task.workspace_id},
        'focus_task_completed',
        ${completionId},
        ${task.motivation_tone},
        ${message.key},
        ${message.title},
        ${message.body},
        ${input.occurredAt}
      )
    `;

    const progressRows = await sql<
      Array<{
        done_tasks: number;
        total_tasks: number;
        percent_complete: number;
      }>
    >`
      select done_tasks, total_tasks, percent_complete
      from public.project_progress
      where project_id = ${task.project_id}
    `;
    const progress = progressRows[0];
    if (!progress) {
      throw new AppError("INTERNAL", "Unable to load project progress.");
    }

    return {
      completionId,
      taskId: task.id,
      projectId: task.project_id,
      workspaceId: task.workspace_id,
      taskTitle: task.title,
      wasNewCompletion: true,
      points,
      preCompletionStreak,
      postCompletionStreak,
      achievement: achievementEarned ? "Momentum Three" : null,
      message: { title: message.title, body: message.body },
      projectProgress: {
        doneTasks: progress.done_tasks,
        totalTasks: progress.total_tasks,
        percentComplete: progress.percent_complete,
      },
    };
  });
}
