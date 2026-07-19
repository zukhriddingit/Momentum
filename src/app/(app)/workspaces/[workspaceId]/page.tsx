import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TeamSection } from "@/features/cohort/team-section";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import { requireUser } from "@/server/auth/require-user";
import { getCohortDirectory } from "@/server/cohort/github-directory";
import { AppError } from "@/server/errors";
import type { WorkspaceOverview } from "@/server/types";
import { getWorkspaceOverview } from "@/server/workspaces/get-workspace-overview";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ projectArchived?: string | string[] }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const projectArchived = Array.isArray(query.projectArchived)
    ? undefined
    : query.projectArchived;
  if (!z.uuid().safeParse(workspaceId).success) {
    notFound();
  }

  const user = await requireUser();
  let workspace: WorkspaceOverview;
  try {
    workspace = await getWorkspaceOverview({ actorId: user.id, workspaceId });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canManageProjects =
    workspace.actorRole === "owner" || workspace.actorRole === "admin";
  const directory = canManageProjects ? await getCohortDirectory() : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-violet-700">Workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {workspace.name}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Keep each project purposeful and make progress easy for the team to
            see.
          </p>
        </div>
        {canManageProjects ? (
          <ProjectFormDialog workspaceId={workspace.id} />
        ) : null}
      </div>

      {projectArchived === "1" ? (
        <p
          role="status"
          className="mb-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          Project archived. Its history is preserved.
        </p>
      ) : null}

      <TeamSection
        workspaceId={workspace.id}
        actorRole={workspace.actorRole}
        members={workspace.members}
        pendingCohortSeats={workspace.pendingCohortSeats}
        directory={directory}
      />

      {workspace.projects.length > 0 ? (
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label={`${workspace.name} projects`}
        >
          {workspace.projects.map((project) => (
            <Link
              key={project.id}
              href={`/workspaces/${workspace.id}/projects/${project.id}`}
              className="rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              <Card className="h-full transition-colors hover:border-violet-300">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{project.name}</CardTitle>
                    <Badge>{project.percentComplete}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="min-h-10 text-sm leading-5 text-slate-600">
                    {project.description ??
                      "A focused place to turn shared work into visible progress."}
                  </p>
                  <Progress
                    value={project.percentComplete}
                    label={`${project.name} progress`}
                  />
                  <p className="text-xs text-slate-500">
                    {project.doneTasks} of {project.totalTasks} tasks complete
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
              <FolderKanban className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-bold">
              Give the work a clear home
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
              A project keeps the next tasks and the team&apos;s progress
              visible without adding unnecessary process.
            </p>
            {canManageProjects ? (
              <div className="mt-5">
                <ProjectFormDialog
                  workspaceId={workspace.id}
                  triggerLabel="Create the first project"
                />
              </div>
            ) : (
              <p className="mt-5 text-sm font-medium text-slate-500">
                An owner or admin can create the first project.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
