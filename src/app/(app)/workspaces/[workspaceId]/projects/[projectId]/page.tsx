import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ArchiveProjectDialog } from "@/features/projects/archive-project-dialog";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import { CelebrationDialog } from "@/features/tasks/celebration-dialog";
import { KanbanBoard } from "@/features/tasks/kanban-board";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { getProjectBoard } from "@/server/projects/get-project-board";
import { AppError } from "@/server/errors";
import { getCompletionCelebration } from "@/server/tasks/get-completion-celebration";
import type { ProjectBoardView, WorkspaceOverview } from "@/server/types";
import { getWorkspaceOverview } from "@/server/workspaces/get-workspace-overview";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
  searchParams: Promise<{ celebration?: string }>;
}) {
  const [{ workspaceId, projectId }, query, user, occurredAt] =
    await Promise.all([params, searchParams, requireUser(), requestNow()]);
  if (
    !z.uuid().safeParse(workspaceId).success ||
    !z.uuid().safeParse(projectId).success
  ) {
    notFound();
  }

  let board: ProjectBoardView;
  let workspace: WorkspaceOverview;
  try {
    [board, workspace] = await Promise.all([
      getProjectBoard({
        actorId: user.id,
        projectId,
        occurredAt,
      }),
      getWorkspaceOverview({ actorId: user.id, workspaceId }),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
  if (board.workspaceId !== workspaceId) {
    notFound();
  }
  const canManageProject =
    board.actorRole === "owner" || board.actorRole === "admin";
  const celebrationId = z.uuid().safeParse(query.celebration);
  const celebration = celebrationId.success
    ? await getCompletionCelebration({
        actorId: user.id,
        completionId: celebrationId.data,
      })
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href={`/workspaces/${workspaceId}`}
        className="mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {workspace.name}
      </Link>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-violet-700">
            {board.workspaceName}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {board.name}
          </h1>
          {board.description ? (
            <p className="mt-2 text-slate-600">{board.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays className="size-4" aria-hidden="true" /> Workday{" "}
            {board.workDate}
          </p>
          {canManageProject ? (
            <>
              <ProjectFormDialog
                workspaceId={workspaceId}
                project={{
                  id: board.id,
                  workspaceId,
                  name: board.name,
                  description: board.description,
                }}
              />
              <ArchiveProjectDialog
                projectId={board.id}
                workspaceId={workspaceId}
              />
            </>
          ) : null}
        </div>
      </div>
      <KanbanBoard actorId={user.id} board={board} />
      {celebration ? <CelebrationDialog celebration={celebration} /> : null}
    </main>
  );
}
