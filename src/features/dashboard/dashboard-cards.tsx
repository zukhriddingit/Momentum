import {
  Bell,
  CircleCheck,
  Flame,
  Lock,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardView } from "@/server/types";

export function DashboardCards({ dashboard }: { dashboard: DashboardView }) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: dashboard.user.timezone,
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-600">
              <Target className="size-4" aria-hidden="true" /> Total points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="total-points">
              {dashboard.totalPoints}
            </p>
            {dashboard.totalPoints === 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Complete a task when you are ready; points never go negative.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-600">
              <Flame className="size-4" aria-hidden="true" /> Current streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="current-streak">
              {dashboard.currentStreak}
            </p>
            <p className="text-xs text-slate-500">
              {dashboard.currentStreak === 0
                ? "No active Focus Streak yet. A day without a Focus Task simply pauses it."
                : `Longest: ${dashboard.longestStreak}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="space-y-3" aria-labelledby="activity-heading">
          <h2
            id="activity-heading"
            className="flex items-center gap-2 text-xl font-bold"
          >
            <TrendingUp className="size-5 text-violet-700" aria-hidden="true" />
            Recent point activity
          </h2>
          <div data-testid="point-activity">
            {dashboard.pointActivity.length > 0 ? (
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {dashboard.pointActivity.map((activity) => (
                  <li className="p-4" key={activity.completionId}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">
                          {activity.taskTitle}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {dateFormatter.format(new Date(activity.completedAt))}
                        </p>
                        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span>Base {activity.basePoints}</span>
                          <span>Early +{activity.timingBonus}</span>
                          <span>Streak +{activity.streakBonus}</span>
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-violet-100 text-violet-800">
                        {activity.finalPoints} points
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <CardContent className="pt-5">
                  <p className="font-semibold">No point activity yet.</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Your first completed task will add a transparent breakdown
                    here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="notification-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="notification-heading" className="text-xl font-bold">
              Recent encouragement
            </h2>
            <Badge data-testid="unread-notification-count">
              {dashboard.unreadNotificationCount}
            </Badge>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4" aria-hidden="true" />
                {dashboard.notification?.title ?? "Ready when you are"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                {dashboard.notification?.body ??
                  "No encouragement notifications yet. Choose a Focus Task whenever a clear direction would help."}
              </p>
              <Link
                href="/notifications"
                className="mt-4 inline-block rounded-lg text-sm font-semibold text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                View notification history
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>

      {dashboard.achievementsVisible ? (
        <section
          className="space-y-3"
          aria-labelledby="achievements-heading"
          data-testid="dashboard-achievements"
        >
          <div>
            <h2 id="achievements-heading" className="text-xl font-bold">
              Achievements
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Milestones reflect completed work; locked ones stay pressure-free.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {dashboard.achievements.map((achievement) => (
              <Card
                key={achievement.code}
                className={
                  achievement.earned
                    ? "border-violet-200 bg-violet-50/50"
                    : "border-dashed"
                }
                data-testid="achievement-card"
              >
                <CardHeader className="pb-2">
                  <span
                    className={
                      achievement.earned
                        ? "grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700"
                        : "grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500"
                    }
                  >
                    {achievement.earned ? (
                      <CircleCheck className="size-4" aria-hidden="true" />
                    ) : (
                      <Lock className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <CardTitle className="pt-2 text-base">
                    {achievement.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-5 text-slate-600">
                    {achievement.description}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {achievement.grantedAt
                      ? `Earned ${dateFormatter.format(
                          new Date(achievement.grantedAt),
                        )}`
                      : "Ready when this fits your work"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="project-progress-heading">
        <h2 id="project-progress-heading" className="text-xl font-bold">
          Project progress
        </h2>
        {dashboard.projects.length > 0 ? (
          dashboard.projects.map((project) => (
            <Link
              key={project.id}
              href={`/workspaces/${project.workspaceId}/projects/${project.id}`}
              className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              <Card className="transition-colors hover:border-violet-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>{project.name}</CardTitle>
                    <Badge>{project.percentComplete}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress
                    value={project.percentComplete}
                    label={`${project.name} progress`}
                  />
                  <p className="text-sm text-slate-500">
                    {project.doneTasks} of {project.totalTasks} tasks complete
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <CardContent className="pt-5">
              <p className="font-semibold">
                Your first project is ready to take shape.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Open a workspace from the navigation above to create a project
                and make progress visible.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
