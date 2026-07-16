import "server-only";

import { database } from "@/server/db/client";
import type { CompletionCelebrationView } from "@/server/types";

export async function getCompletionCelebration(input: {
  actorId: string;
  completionId: string;
}): Promise<CompletionCelebrationView | null> {
  const rows = await database()<
    Array<{
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
    }>
  >`
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
    join public.project_progress as progress on progress.project_id = completion.project_id
    left join public.achievement_grants as achievement_grant
      on achievement_grant.completion_id = completion.id
    left join public.achievement_definitions as definition
      on definition.code = achievement_grant.achievement_code
    where completion.id = ${input.completionId}
      and completion.recipient_id = ${input.actorId}
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }

  const timingMultiplier = Number(row.timing_multiplier) as 1 | 1.1 | 1.2;
  const timingBonus =
    Math.round(row.base_points * timingMultiplier) - row.base_points;
  return {
    completionId: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    taskTitle: row.task_title,
    wasNewCompletion: true,
    points: {
      basePoints: row.base_points,
      timingMultiplier,
      streakMultiplier: Number(row.streak_multiplier),
      timingBonus,
      streakBonus: row.final_points - row.base_points - timingBonus,
      finalPoints: row.final_points,
    },
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
