"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { selectFocusTaskAction } from "@/features/focus/actions";
import { moveTaskAction } from "@/features/tasks/actions";
import { TaskCard } from "@/features/tasks/task-card";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import type {
  ProjectBoardView,
  TaskMutationReceipt,
  TaskStatus,
} from "@/server/types";

const COLUMNS: Array<{ status: TaskStatus; title: string; accent: string }> = [
  { status: "todo", title: "To Do", accent: "bg-slate-400" },
  { status: "in_progress", title: "In Progress", accent: "bg-amber-400" },
  { status: "done", title: "Done", accent: "bg-emerald-500" },
];

export function KanbanBoard({
  actorId,
  board,
}: {
  actorId: string;
  board: ProjectBoardView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [startedTaskId, setStartedTaskId] = useState<string | null>(null);
  const startPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (startPulseTimer.current) {
        clearTimeout(startPulseTimer.current);
      }
    },
    [],
  );

  function beginStartPulse(taskId: string): void {
    if (startPulseTimer.current) {
      clearTimeout(startPulseTimer.current);
    }
    setStartedTaskId(taskId);
    startPulseTimer.current = setTimeout(() => {
      setStartedTaskId(null);
      startPulseTimer.current = null;
    }, 1_000);
  }

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
      const shouldPulse =
        status === "in_progress" &&
        board.tasks.some(
          (task) => task.id === taskId && task.status === "todo",
        );
      const result = await moveTaskAction({
        taskId,
        status,
      });
      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      if (shouldPulse && board.celebrationAnimationEnabled) {
        beginStartPulse(taskId);
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

  function handleTaskMutation(
    receipt: TaskMutationReceipt,
    successMessage: string,
  ): void {
    const completion = receipt.completion;
    if (completion?.wasNewCompletion) {
      setStatusMessage(`${completion.points.finalPoints} points earned.`);
      router.push(`${pathname}?celebration=${completion.completionId}`);
      return;
    }

    setStatusMessage(successMessage);
    router.refresh();
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {statusMessage}
      </p>
      <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-slate-900">Project tasks</h2>
          <p className="mt-1 text-sm text-slate-500">
            Keep each next step clear, assigned, and easy to act on.
          </p>
        </div>
        <TaskFormDialog
          mode="create"
          actorId={actorId}
          projectId={board.id}
          members={board.members}
          onSaved={(receipt) =>
            handleTaskMutation(receipt, "Task created and ready to move.")
          }
        />
      </div>
      {board.tasks.length === 0 ? (
        <p className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
          Create one clear task to give this project its first bit of momentum.
        </p>
      ) : null}
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
                    startPulse={startedTaskId === task.id}
                    onFocus={selectFocus}
                    onMove={move}
                    editControl={
                      task.permissions.canEdit ? (
                        <TaskFormDialog
                          mode="edit"
                          actorId={actorId}
                          projectId={board.id}
                          members={board.members}
                          task={task}
                          onSaved={(receipt) =>
                            handleTaskMutation(receipt, "Task changes saved.")
                          }
                        />
                      ) : null
                    }
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
