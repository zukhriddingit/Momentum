import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CelebrationDialog } from "@/features/tasks/celebration-dialog";
import { KanbanBoard } from "@/features/tasks/kanban-board";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { getProjectBoard } from "@/server/projects/get-project-board";
import { getCompletionCelebration } from "@/server/tasks/get-completion-celebration";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
  searchParams: Promise<{ celebration?: string }>;
}) {
  const [{ workspaceId, projectId }, query, user, occurredAt] =
    await Promise.all([params, searchParams, requireUser(), requestNow()]);
  const board = await getProjectBoard({
    actorId: user.id,
    projectId,
    occurredAt,
  });
  if (board.workspaceId !== workspaceId) {
    notFound();
  }
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
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
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
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="size-4" aria-hidden="true" /> Workday{" "}
          {board.workDate}
        </p>
      </div>
      <KanbanBoard board={board} />
      {celebration ? <CelebrationDialog celebration={celebration} /> : null}
    </main>
  );
}
