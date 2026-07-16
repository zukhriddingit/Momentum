import "server-only";

import { database } from "@/server/db/client";
import {
  mapCompletionReceipt,
  type AchievementGrantRow,
  type CompletionSnapshotRow,
  type ProjectProgressRow,
} from "@/server/tasks/completion-receipt";
import type { CompletionCelebrationView } from "@/server/types";

type CelebrationRow = CompletionSnapshotRow &
  ProjectProgressRow & {
    achievement_visibility_enabled: boolean;
    celebration_animation_enabled: boolean;
  };

export async function getCompletionCelebration(input: {
  actorId: string;
  completionId: string;
}): Promise<CompletionCelebrationView | null> {
  const sql = database();
  const [rows, achievementRows] = await Promise.all([
    sql<CelebrationRow[]>`
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
        progress.percent_complete,
        coalesce(preference.achievement_visibility_enabled, true)
          as achievement_visibility_enabled,
        coalesce(preference.celebration_animation_enabled, true)
          as celebration_animation_enabled
      from public.task_completions as completion
      join public.project_progress as progress
        on progress.project_id = completion.project_id
      left join public.motivation_preferences as preference
        on preference.user_id = completion.recipient_id
      where completion.id = ${input.completionId}
        and completion.recipient_id = ${input.actorId}
    `,
    sql<AchievementGrantRow[]>`
      select
        definition.code,
        definition.name,
        definition.description,
        definition.icon,
        achievement_grant.granted_at
      from public.achievement_grants as achievement_grant
      join public.achievement_definitions as definition
        on definition.code = achievement_grant.achievement_code
      join public.task_completions as completion
        on completion.id = achievement_grant.completion_id
      where achievement_grant.completion_id = ${input.completionId}
        and completion.recipient_id = ${input.actorId}
      order by case definition.code
        when 'first_step' then 1
        when 'focused_finish' then 2
        when 'momentum_three' then 3
        when 'five_day_flow' then 4
        when 'ahead_of_schedule' then 5
      end
    `,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return mapCompletionReceipt({
    completion: row,
    achievements: achievementRows,
    progress: row,
    wasNewCompletion: true,
    achievementVisibilityEnabled: row.achievement_visibility_enabled,
    celebrationAnimationEnabled: row.celebration_animation_enabled,
  });
}
