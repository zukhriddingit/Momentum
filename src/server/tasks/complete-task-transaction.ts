import "server-only";

import type postgres from "postgres";

import {
  evaluateAchievements,
  type AchievementCode,
} from "@/domain/achievements/achievements";
import {
  selectMotivationMessage,
  selectPrimaryCompletionEvent,
} from "@/domain/motivation/select-message";
import type { MotivationTone } from "@/domain/motivation/types";
import { calculatePointBreakdown } from "@/domain/rewards/calculate-point-breakdown";
import type { EffortLevel } from "@/domain/rewards/types";
import {
  calculateStreakTransition,
  resolvePreCompletionStreak,
  type FocusSelectionOutcome,
} from "@/domain/streaks/calculate-streak-transition";
import { toWorkDate } from "@/domain/streaks/work-date";
import { AppError } from "@/server/errors";
import {
  mapCompletionReceipt,
  type AchievementGrantRow,
  type CompletionSnapshotRow,
  type ProjectProgressRow,
} from "@/server/tasks/completion-receipt";
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
  motivation_tone: MotivationTone;
  achievement_visibility_enabled: boolean;
  celebration_animation_enabled: boolean;
}

interface StreakRow {
  current_count: number;
  longest_count: number;
  last_completed_work_date: string | null;
}

type CompletionWithProgressRow = CompletionSnapshotRow & ProjectProgressRow;

async function loadAchievementGrants(
  sql: postgres.TransactionSql,
  completionId: string,
): Promise<AchievementGrantRow[]> {
  return sql<AchievementGrantRow[]>`
    select
      definition.code,
      definition.name,
      definition.description,
      definition.icon,
      achievement_grant.granted_at
    from public.achievement_grants as achievement_grant
    join public.achievement_definitions as definition
      on definition.code = achievement_grant.achievement_code
    where achievement_grant.completion_id = ${completionId}
    order by case definition.code
      when 'first_step' then 1
      when 'focused_finish' then 2
      when 'momentum_three' then 3
      when 'five_day_flow' then 4
      when 'ahead_of_schedule' then 5
    end
  `;
}

async function loadCompletionWithProgress(
  sql: postgres.TransactionSql,
  input: { completionId: string; actorId: string },
): Promise<CompletionWithProgressRow | null> {
  const rows = await sql<CompletionWithProgressRow[]>`
    select
      completion.id,
      completion.task_id,
      completion.project_id,
      completion.workspace_id,
      completion.task_title,
      completion.base_points,
      completion.timing_multiplier,
      completion.streak_multiplier,
      completion.pre_completion_streak,
      completion.post_completion_streak,
      completion.final_points,
      completion.message_event::text as message_event,
      completion.message_tone::text as message_tone,
      completion.message_template_key,
      completion.message_title,
      completion.message_body,
      progress.done_tasks,
      progress.total_tasks,
      progress.percent_complete
    from public.task_completions as completion
    join public.project_progress as progress
      on progress.project_id = completion.project_id
    where completion.id = ${input.completionId}
      and completion.recipient_id = ${input.actorId}
  `;

  return rows[0] ?? null;
}

export async function completeTaskInTransaction(
  sql: postgres.TransactionSql,
  input: {
    actorId: string;
    taskId: string;
    occurredAt: Date;
  },
): Promise<CompletionReceipt> {
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
      profile.motivation_tone::text as motivation_tone,
      coalesce(preference.achievement_visibility_enabled, true)
        as achievement_visibility_enabled,
      coalesce(preference.celebration_animation_enabled, true)
        as celebration_animation_enabled
    from public.tasks as task
    join public.projects as project on project.id = task.project_id
    join public.workspace_memberships as membership
      on membership.workspace_id = project.workspace_id
      and membership.user_id = ${input.actorId}
    join public.profiles as profile on profile.id = task.assignee_id
    left join public.motivation_preferences as preference
      on preference.user_id = task.assignee_id
    where task.id = ${input.taskId}
      and task.assignee_id = ${input.actorId}
    for update of task
  `;
  const task = taskRows[0];
  if (!task) {
    throw new AppError("NOT_FOUND", "Task not found.");
  }

  const existingIdRows = await sql<Array<{ id: string }>>`
    select id
    from public.task_completions
    where task_id = ${input.taskId}
      and recipient_id = ${input.actorId}
  `;
  const existingId = existingIdRows[0]?.id;
  if (existingId) {
    if (task.status !== "done") {
      await sql`
        update public.tasks
        set status = 'done', updated_at = ${input.occurredAt}
        where id = ${task.id}
      `;
    }

    const [completion, achievements] = await Promise.all([
      loadCompletionWithProgress(sql, {
        completionId: existingId,
        actorId: input.actorId,
      }),
      loadAchievementGrants(sql, existingId),
    ]);
    if (!completion) {
      throw new AppError("INTERNAL", "Unable to load completion receipt.");
    }

    return mapCompletionReceipt({
      completion,
      achievements,
      progress: completion,
      wasNewCompletion: false,
      achievementVisibilityEnabled: task.achievement_visibility_enabled,
      celebrationAnimationEnabled: task.celebration_animation_enabled,
    });
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
      and (
        ${streak.last_completed_work_date}::date is null
        or work_date > ${streak.last_completed_work_date}::date
      )
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

  const [historyRows, grantedRows] = await Promise.all([
    sql<Array<{ completion_count: number; focus_completion_count: number }>>`
      select
        count(*)::integer as completion_count,
        count(*) filter (where focus_selection_id is not null)::integer
          as focus_completion_count
      from public.task_completions
      where recipient_id = ${input.actorId}
    `,
    sql<Array<{ achievement_code: AchievementCode }>>`
      select achievement_code
      from public.achievement_grants
      where user_id = ${input.actorId}
    `,
  ]);
  const candidateAchievementCodes = evaluateAchievements({
    priorCompletionCount: historyRows[0]?.completion_count ?? 0,
    priorFocusCompletionCount: historyRows[0]?.focus_completion_count ?? 0,
    completedFocusTask: focusSelection !== null,
    preCompletionStreak,
    postCompletionStreak,
    timingMultiplier: points.timingMultiplier,
    alreadyGranted: new Set(
      grantedRows.map(({ achievement_code }) => achievement_code),
    ),
  });

  const completionId = crypto.randomUUID();
  const messageEvent = selectPrimaryCompletionEvent({
    newAchievementCodes: candidateAchievementCodes,
    achievementVisibilityEnabled: task.achievement_visibility_enabled,
    streakIncremented: streakTransition?.incremented ?? false,
    completedFocusTask: focusSelection !== null,
    timingMultiplier: points.timingMultiplier,
  });
  const message = selectMotivationMessage({
    event: messageEvent,
    tone: task.motivation_tone,
    sourceId: completionId,
  });

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
      task_title,
      message_event,
      message_tone,
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
      ${task.title},
      ${message.event},
      ${message.tone},
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

  for (const achievementCode of candidateAchievementCodes) {
    const insertedRows = await sql<
      Array<{ achievement_code: AchievementCode }>
    >`
      insert into public.achievement_grants (
        id,
        user_id,
        achievement_code,
        completion_id,
        granted_at
      ) values (
        ${crypto.randomUUID()},
        ${input.actorId},
        ${achievementCode},
        ${completionId},
        ${input.occurredAt}
      )
      on conflict (user_id, achievement_code) do nothing
      returning achievement_code
    `;
    if (insertedRows[0]?.achievement_code !== achievementCode) {
      throw new AppError("INTERNAL", "Achievement state changed unexpectedly.");
    }
  }

  const notificationEvent =
    message.event === "completed_early" ? "task_completed" : message.event;
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
      ${crypto.randomUUID()},
      ${input.actorId},
      ${task.workspace_id},
      ${task.project_id},
      ${task.id},
      ${notificationEvent},
      ${completionId},
      ${message.tone},
      ${message.key},
      ${message.title},
      ${message.body},
      null,
      ${input.occurredAt}
    )
  `;

  const [completion, achievements] = await Promise.all([
    loadCompletionWithProgress(sql, {
      completionId,
      actorId: input.actorId,
    }),
    loadAchievementGrants(sql, completionId),
  ]);
  if (!completion) {
    throw new AppError("INTERNAL", "Unable to load completion receipt.");
  }

  return mapCompletionReceipt({
    completion,
    achievements,
    progress: completion,
    wasNewCompletion: true,
    achievementVisibilityEnabled: task.achievement_visibility_enabled,
    celebrationAnimationEnabled: task.celebration_animation_enabled,
  });
}
