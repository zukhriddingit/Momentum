"use client";

import { CalendarClock, CircleCheck, Flame, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskStatus, TaskView } from "@/server/types";

const EFFORT_LABEL = {
  small: "Small · 20 pts",
  medium: "Medium · 40 pts",
  large: "Large · 70 pts",
  extra_large: "Extra Large · 100 pts",
} as const;

export function TaskCard({
  task,
  pending,
  onFocus,
  onMove,
}: {
  task: TaskView;
  pending: boolean;
  onFocus: (taskId: string) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <Card
      className={
        task.isFocusTask
          ? "border-violet-400 ring-2 ring-violet-100"
          : undefined
      }
      data-testid={`task-${task.id}`}
    >
      <CardHeader className="pb-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge>{EFFORT_LABEL[task.effort]}</Badge>
          {task.isFocusTask ? (
            <Badge className="bg-violet-100 text-violet-800">
              <Flame className="mr-1 size-3" aria-hidden="true" />
              Today&apos;s Focus
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-base">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.description ? (
          <p className="text-sm leading-6 text-slate-600">{task.description}</p>
        ) : null}
        <div className="space-y-2 text-xs text-slate-500">
          <p className="flex items-center gap-2">
            <UserRound className="size-3.5" aria-hidden="true" />
            {task.assigneeName}
          </p>
          {task.dueAt ? (
            <p className="flex items-center gap-2">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Due{" "}
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                new Date(task.dueAt),
              )}
            </p>
          ) : null}
        </div>

        {task.isCurrentUsersTask ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {task.status === "todo" && !task.isFocusTask ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onFocus(task.id)}
                disabled={pending}
              >
                <Flame className="size-4" aria-hidden="true" />
                Choose as Focus
              </Button>
            ) : null}
            {task.status === "todo" ? (
              <Button
                size="sm"
                onClick={() => onMove(task.id, "in_progress")}
                disabled={pending}
              >
                Start task
              </Button>
            ) : null}
            {task.status === "in_progress" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMove(task.id, "todo")}
                  disabled={pending}
                >
                  Back to To Do
                </Button>
                <Button
                  size="sm"
                  onClick={() => onMove(task.id, "done")}
                  disabled={pending}
                >
                  <CircleCheck className="size-4" aria-hidden="true" />
                  Complete task
                </Button>
              </>
            ) : null}
            {task.status === "done" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMove(task.id, "in_progress")}
                disabled={pending}
              >
                Reopen task
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
