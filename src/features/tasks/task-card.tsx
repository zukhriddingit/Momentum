"use client";

import { CalendarClock, CircleCheck, Flame, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskView } from "@/server/types";

const EFFORT_LABEL = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  extra_large: "Extra Large",
} as const;

export function TaskCard({
  task,
  pending,
  startPulse,
  onFocus,
  onMove,
  editControl,
}: {
  task: TaskView;
  pending: boolean;
  startPulse: boolean;
  onFocus: (taskId: string) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
  editControl?: ReactNode;
}) {
  const activeAssignee = task.assignee.kind === "member";
  const showMovementControls = activeAssignee && task.isCurrentUsersTask;

  return (
    <Card
      id={`task-${task.id}`}
      className={cn(
        "transition-shadow motion-reduce:transition-none",
        activeAssignee &&
          task.isFocusTask &&
          "border-violet-400 ring-2 ring-violet-100",
        startPulse && "momentum-task-started",
      )}
      data-testid={`task-${task.id}`}
      data-start-pulse={startPulse ? "active" : "idle"}
    >
      <CardHeader className="pb-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge>{EFFORT_LABEL[task.effort]}</Badge>
          {activeAssignee && task.isFocusTask ? (
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
          {task.assignee.kind === "member" ? (
            <p className="flex items-center gap-2">
              <UserRound className="size-3.5" aria-hidden="true" />
              {task.assignee.displayName}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <UserRound className="size-3.5" aria-hidden="true" />
              <a
                href={task.assignee.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-violet-700 underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              >
                @{task.assignee.githubHandle}
              </a>
              <Badge className="bg-amber-100 text-amber-800">
                Waiting for GitHub sign-in
              </Badge>
            </div>
          )}
          {task.dueAt ? (
            <p className="flex items-center gap-2">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Due{" "}
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                new Date(task.dueAt),
              )}
            </p>
          ) : null}
          <p>Estimated base reward: {task.estimatedBasePoints} points</p>
        </div>

        {showMovementControls || editControl ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {showMovementControls &&
            task.status === "todo" &&
            !task.isFocusTask ? (
              <Button
                size="sm"
                variant="secondary"
                className="motion-reduce:transition-none"
                onClick={() => onFocus(task.id)}
                disabled={pending}
              >
                <Flame className="size-4" aria-hidden="true" />
                Choose as Focus
              </Button>
            ) : null}
            {showMovementControls && task.status === "todo" ? (
              <Button
                size="sm"
                className="motion-reduce:transition-none"
                onClick={() => onMove(task.id, "in_progress")}
                disabled={pending}
              >
                Start task
              </Button>
            ) : null}
            {showMovementControls && task.status === "in_progress" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="motion-reduce:transition-none"
                  onClick={() => onMove(task.id, "todo")}
                  disabled={pending}
                >
                  Back to To Do
                </Button>
                <Button
                  size="sm"
                  className="motion-reduce:transition-none"
                  onClick={() => onMove(task.id, "done")}
                  disabled={pending}
                >
                  <CircleCheck className="size-4" aria-hidden="true" />
                  Complete task
                </Button>
              </>
            ) : null}
            {showMovementControls && task.status === "done" ? (
              <Button
                size="sm"
                variant="outline"
                className="motion-reduce:transition-none"
                onClick={() => onMove(task.id, "in_progress")}
                disabled={pending}
              >
                Reopen task
              </Button>
            ) : null}
            {editControl}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
