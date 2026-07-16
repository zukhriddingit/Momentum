"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { selectFocusTaskAction } from "@/features/focus/actions";
import { moveTaskAction } from "@/features/tasks/actions";
import { TaskCard } from "@/features/tasks/task-card";
import type { ProjectBoardView, TaskStatus } from "@/server/types";

const COLUMNS: Array<{ status: TaskStatus; title: string; accent: string }> = [
  { status: "todo", title: "To Do", accent: "bg-slate-400" },
  { status: "in_progress", title: "In Progress", accent: "bg-amber-400" },
  { status: "done", title: "Done", accent: "bg-emerald-500" },
];

export function KanbanBoard({ board }: { board: ProjectBoardView }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  function run(work: () => Promise<void>) {
    setPending(true);
    startTransition(async () => {
      try {
        await work();
      } finally {
        setPending(false);
      }
    });
  }

  function selectFocus(taskId: string) {
    run(async () => {
      const result = await selectFocusTaskAction({
        taskId,
        projectId: board.id,
        workspaceId: board.workspaceId,
      });
      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }
      setStatusMessage("Today's Focus Task is ready.");
      router.refresh();
    });
  }

  function move(taskId: string, status: TaskStatus) {
    run(async () => {
      const result = await moveTaskAction({
        taskId,
        projectId: board.id,
        workspaceId: board.workspaceId,
        status,
      });
      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      const completion = result.data.completion;
      if (completion?.wasNewCompletion) {
        setStatusMessage(`${completion.points.finalPoints} points earned.`);
        router.push(`${pathname}?celebration=${completion.completionId}`);
        return;
      }

      setStatusMessage(`Task moved to ${status.replace("_", " ")}.`);
      router.refresh();
    });
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {statusMessage}
      </p>
      <div
        className="grid gap-5 lg:grid-cols-3"
        aria-label="Project task board"
      >
        {COLUMNS.map((column) => {
          const tasks = board.tasks.filter(
            (task) => task.status === column.status,
          );
          return (
            <section
              key={column.status}
              className="min-h-72 rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
              aria-labelledby={`${column.status}-heading`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2
                  id={`${column.status}-heading`}
                  className="flex items-center gap-2 font-semibold text-slate-900"
                >
                  <span className={`size-2.5 rounded-full ${column.accent}`} />
                  {column.title}
                </h2>
                <span className="text-sm font-medium text-slate-500">
                  {tasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    pending={pending}
                    onFocus={selectFocus}
                    onMove={move}
                  />
                ))}
                {tasks.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                    No tasks here yet.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
