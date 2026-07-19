import "server-only";

import type { AchievementCode } from "@/domain/achievements/achievements";
import { toWorkDate } from "@/domain/streaks/work-date";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type {
  DashboardAchievementState,
  DashboardPointActivity,
  DashboardView,
} from "@/server/types";

interface PointActivityRow {
  id: string;
  task_title: string;
  completed_at: Date;
  base_points: number;
  timing_multiplier: string;
  final_points: number;
}

function mapPointActivity(row: PointActivityRow): DashboardPointActivity {
  const timingBonus =
    Math.round(row.base_points * Number(row.timing_multiplier)) -
    row.base_points;

  return {
    completionId: row.id,
    taskTitle: row.task_title,
    completedAt: row.completed_at.toISOString(),
    basePoints: row.base_points,
    timingBonus,
    streakBonus: row.final_points - row.base_points - timingBonus,
    finalPoints: row.final_points,
  };
}

export async function getDashboard(input: {
  actorId: string;
  occurredAt: Date;
}): Promise<DashboardView> {
  const sql = database();
  const profileRows = await sql<
    Array<{
      display_name: string;
      timezone: string;
      current_count: number;
      longest_count: number;
      last_completed_work_date: string | null;
      achievement_visibility_enabled: boolean;
    }>
  >`
    select
      profile.display_name,
      profile.timezone,
      coalesce(streak.current_count, 0)::integer as current_count,
      coalesce(streak.longest_count, 0)::integer as longest_count,
      streak.last_completed_work_date,
      coalesce(preference.achievement_visibility_enabled, true)
        as achievement_visibility_enabled
    from public.profiles as profile
    left join public.focus_streaks as streak on streak.user_id = profile.id
    left join public.motivation_preferences as preference
      on preference.user_id = profile.id
    where profile.id = ${input.actorId}
  `;
  const profile = profileRows[0];
  if (!profile) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  const workDate = toWorkDate(input.occurredAt, profile.timezone);
  const [
    breakRows,
    focusRows,
    pointRows,
    activityRows,
    achievementRows,
    projectRows,
    notificationRows,
    unreadRows,
    membershipRows,
  ] = await Promise.all([
    sql<Array<{ exists: boolean }>>`
      select exists (
        select 1
        from public.focus_selections
        where user_id = ${input.actorId}
          and (
            ${profile.last_completed_work_date}::date is null
            or work_date > ${profile.last_completed_work_date}::date
          )
          and work_date < ${workDate}::date
          and extract(isodow from work_date) <= 5
          and completed_at is null
      ) as exists
    `,
    sql<
      Array<{
        id: string;
        title: string;
        project_id: string;
        project_name: string;
      }>
    >`
      select
        task.id,
        task.title,
        project.id as project_id,
        project.name as project_name
      from public.focus_selections as focus
      join public.tasks as task on task.id = focus.task_id
      join public.projects as project
        on project.id = task.project_id
       and project.archived_at is null
      where focus.user_id = ${input.actorId}
        and focus.work_date = ${workDate}
    `,
    sql<Array<{ total_points: number }>>`
      select coalesce(sum(points), 0)::integer as total_points
      from public.point_ledger
      where user_id = ${input.actorId}
    `,
    sql<PointActivityRow[]>`
      select
        id,
        task_title,
        completed_at,
        base_points,
        timing_multiplier,
        final_points
      from public.task_completions
      where recipient_id = ${input.actorId}
      order by completed_at desc, id desc
      limit 5
    `,
    sql<
      Array<{
        code: AchievementCode;
        name: string;
        description: string;
        icon: string;
        granted_at: Date | null;
      }>
    >`
      select
        definition.code,
        definition.name,
        definition.description,
        definition.icon,
        achievement_grant.granted_at
      from public.achievement_definitions as definition
      left join public.achievement_grants as achievement_grant
        on achievement_grant.achievement_code = definition.code
        and achievement_grant.user_id = ${input.actorId}
      order by case definition.code
        when 'first_step' then 1
        when 'focused_finish' then 2
        when 'momentum_three' then 3
        when 'five_day_flow' then 4
        when 'ahead_of_schedule' then 5
      end
    `,
    sql<
      Array<{
        id: string;
        workspace_id: string;
        name: string;
        done_tasks: number;
        total_tasks: number;
        percent_complete: number;
      }>
    >`
      select
        project.id,
        project.workspace_id,
        project.name,
        progress.done_tasks,
        progress.total_tasks,
        progress.percent_complete
      from public.projects as project
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
        and membership.user_id = ${input.actorId}
      join public.project_progress as progress on progress.project_id = project.id
      where project.archived_at is null
      order by project.created_at
    `,
    sql<Array<{ title: string; body: string }>>`
      select title, body
      from public.notifications
      where user_id = ${input.actorId}
      order by created_at desc, id desc
      limit 1
    `,
    sql<Array<{ unread_count: number }>>`
      select count(*)::integer as unread_count
      from public.notifications
      where user_id = ${input.actorId}
        and read_at is null
    `,
    sql<Array<{ exists: boolean }>>`
      select exists (
        select 1
        from public.workspace_memberships as membership
        where membership.user_id = ${input.actorId}
      ) as exists
    `,
  ]);
  const effectiveCurrentStreak = breakRows[0]?.exists
    ? 0
    : profile.current_count;
  const focus = focusRows[0];
  const notification = notificationRows[0];
  const achievements: DashboardAchievementState[] =
    profile.achievement_visibility_enabled
      ? achievementRows.map((achievement) => ({
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          earned: achievement.granted_at !== null,
          grantedAt: achievement.granted_at?.toISOString() ?? null,
        }))
      : [];

  return {
    hasWorkspace: membershipRows[0]?.exists ?? false,
    user: {
      displayName: profile.display_name,
      timezone: profile.timezone,
    },
    focusTask: focus
      ? {
          id: focus.id,
          title: focus.title,
          projectId: focus.project_id,
          projectName: focus.project_name,
        }
      : null,
    totalPoints: pointRows[0]?.total_points ?? 0,
    currentStreak: effectiveCurrentStreak,
    longestStreak: profile.longest_count,
    pointActivity: activityRows.map(mapPointActivity),
    achievements,
    achievementsVisible: profile.achievement_visibility_enabled,
    unreadNotificationCount: unreadRows[0]?.unread_count ?? 0,
    projects: projectRows.map((project) => ({
      id: project.id,
      workspaceId: project.workspace_id,
      name: project.name,
      doneTasks: project.done_tasks,
      totalTasks: project.total_tasks,
      percentComplete: project.percent_complete,
    })),
    notification: notification
      ? { title: notification.title, body: notification.body }
      : null,
  };
}
