import { Award, Bell, Flame, Target } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardView } from "@/server/types";

export function DashboardCards({ dashboard }: { dashboard: DashboardView }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              Longest: {dashboard.longestStreak}
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-600">
              <Award className="size-4" aria-hidden="true" /> Latest achievement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.achievement ? (
              <>
                <p className="font-bold">{dashboard.achievement.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {dashboard.achievement.description}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Your next focused win is ahead.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section
          className="space-y-3"
          aria-labelledby="project-progress-heading"
        >
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

        <section className="space-y-3" aria-labelledby="notification-heading">
          <h2 id="notification-heading" className="text-xl font-bold">
            Recent encouragement
          </h2>
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
                  "Choose a Focus Task to give today a clear, manageable direction."}
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
