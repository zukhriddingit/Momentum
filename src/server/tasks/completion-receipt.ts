import type { AchievementCode } from "@/domain/achievements/achievements";
import type {
  MotivationEvent,
  MotivationTone,
} from "@/domain/motivation/types";
import type { TimingMultiplier } from "@/domain/rewards/types";
import type { AchievementView, CompletionReceipt } from "@/server/types";

export interface CompletionSnapshotRow {
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
  message_event: MotivationEvent;
  message_tone: MotivationTone;
  message_template_key: string;
  message_title: string;
  message_body: string;
}

export interface AchievementGrantRow {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
  granted_at: Date;
}

export interface ProjectProgressRow {
  done_tasks: number;
  total_tasks: number;
  percent_complete: number;
}

function mapAchievementGrant(row: AchievementGrantRow): AchievementView {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    icon: row.icon,
    grantedAt: row.granted_at.toISOString(),
  };
}

export function mapCompletionReceipt(input: {
  completion: CompletionSnapshotRow;
  achievements: AchievementGrantRow[];
  progress: ProjectProgressRow;
  wasNewCompletion: boolean;
  achievementVisibilityEnabled: boolean;
  celebrationAnimationEnabled: boolean;
}): CompletionReceipt {
  const timingMultiplier = Number(
    input.completion.timing_multiplier,
  ) as TimingMultiplier;
  const timingBonus =
    Math.round(input.completion.base_points * timingMultiplier) -
    input.completion.base_points;

  return {
    completionId: input.completion.id,
    taskId: input.completion.task_id,
    projectId: input.completion.project_id,
    workspaceId: input.completion.workspace_id,
    taskTitle: input.completion.task_title,
    wasNewCompletion: input.wasNewCompletion,
    points: {
      basePoints: input.completion.base_points,
      timingMultiplier,
      streakMultiplier: Number(input.completion.streak_multiplier),
      timingBonus,
      streakBonus:
        input.completion.final_points -
        input.completion.base_points -
        timingBonus,
      finalPoints: input.completion.final_points,
    },
    preCompletionStreak: input.completion.pre_completion_streak,
    postCompletionStreak: input.completion.post_completion_streak,
    streakIncremented:
      input.completion.post_completion_streak >
      input.completion.pre_completion_streak,
    achievements: input.achievementVisibilityEnabled
      ? input.achievements.map(mapAchievementGrant)
      : [],
    achievementVisibilityEnabled: input.achievementVisibilityEnabled,
    celebrationAnimationEnabled: input.celebrationAnimationEnabled,
    message: {
      event: input.completion.message_event,
      tone: input.completion.message_tone,
      key: input.completion.message_template_key,
      title: input.completion.message_title,
      body: input.completion.message_body,
    },
    projectProgress: {
      doneTasks: input.progress.done_tasks,
      totalTasks: input.progress.total_tasks,
      percentComplete: input.progress.percent_complete,
    },
  };
}
