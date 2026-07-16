import "server-only";

import { toWorkDate } from "@/domain/streaks/work-date";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { DashboardView } from "@/server/types";

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
    }>
  >`
    select
      profile.display_name,
      profile.timezone,
      coalesce(streak.current_count, 0)::integer as current_count,
      coalesce(streak.longest_count, 0)::integer as longest_count,
      streak.last_completed_work_date
    from public.profiles as profile
    left join public.focus_streaks as streak on streak.user_id = profile.id
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
    achievementRows,
    projectRows,
    notificationRows,
  ] = await Promise.all([
    sql<Array<{ exists: boolean }>>`
        select exists (
          select 1
          from public.focus_selections
          where user_id = ${input.actorId}
            and (${profile.last_completed_work_date}::date is null
              or work_date > ${profile.last_completed_work_date}::date)
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
        select task.id, task.title, project.id as project_id, project.name as project_name
        from public.focus_selections as focus
        join public.tasks as task on task.id = focus.task_id
        join public.projects as project on project.id = task.project_id
        where focus.user_id = ${input.actorId}
          and focus.work_date = ${workDate}
      `,
    sql<Array<{ total_points: number }>>`
        select coalesce(sum(points), 0)::integer as total_points
        from public.point_ledger
        where user_id = ${input.actorId}
      `,
    sql<Array<{ name: string; description: string }>>`
        select definition.name, definition.description
        from public.achievement_grants as achievement_grant
        join public.achievement_definitions as definition
          on definition.code = achievement_grant.achievement_code
        where achievement_grant.user_id = ${input.actorId}
        order by achievement_grant.granted_at desc
        limit 1
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
        order by project.created_at
      `,
    sql<Array<{ title: string; body: string }>>`
        select title, body
        from public.notifications
        where user_id = ${input.actorId}
        order by created_at desc
        limit 1
      `,
  ]);
  const effectiveCurrentStreak = breakRows[0]?.exists
    ? 0
    : profile.current_count;
  const focus = focusRows[0];
  const achievement = achievementRows[0];
  const notification = notificationRows[0];

  return {
    user: { displayName: profile.display_name },
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
    achievement: achievement
      ? { name: achievement.name, description: achievement.description }
      : null,
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
