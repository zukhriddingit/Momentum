"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useCallback, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { basePointsForEffort } from "@/domain/rewards/calculate-point-breakdown";
import type { EffortLevel } from "@/domain/rewards/types";
import {
  createTaskAction,
  type TaskActionState,
  updateTaskAction,
} from "@/features/tasks/actions";
import type {
  ProjectBoardView,
  TaskAssigneeOption,
  TaskMutationReceipt,
  TaskStatus,
  TaskView,
} from "@/server/types";

type TaskDialogProps = {
  actorId: string;
  projectId: string;
  assignees: ProjectBoardView["assignees"];
  triggerLabel?: string;
  onSaved: (receipt: TaskMutationReceipt) => void;
} & ({ mode: "create"; task?: never } | { mode: "edit"; task: TaskView });

const EFFORT_OPTIONS: Array<{ value: EffortLevel; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "extra_large", label: "Extra Large" },
];

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

type DecodedAssignee =
  { kind: "member"; id: string } | { kind: "cohort"; id: string };

function assigneeOptionKey(option: TaskAssigneeOption): string {
  return option.kind === "member"
    ? `member:${option.userId}`
    : `cohort:${option.seatId}`;
}

function taskAssigneeKey(task: TaskView | undefined): string {
  if (!task) {
    return "";
  }

  return task.assignee.kind === "member"
    ? `member:${task.assignee.userId}`
    : `cohort:${task.assignee.seatId}`;
}

function decodeAssigneeKey(value: string): DecodedAssignee | null {
  const separator = value.indexOf(":");
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id || (kind !== "member" && kind !== "cohort")) {
    return null;
  }

  return { kind, id };
}

function localDateTimeValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 19);
}

function normalizeDeadline(formData: FormData): void {
  const value = formData.get("dueAt");
  if (typeof value !== "string" || value.trim() === "") {
    return;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    formData.set("dueAt", date.toISOString());
  }
}

export function TaskFormDialog(props: TaskDialogProps) {
  const isEditing = props.mode === "edit";
  const task = props.mode === "edit" ? props.task : undefined;
  const { onSaved } = props;
  const action = isEditing ? updateTaskAction : createTaskAction;
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const sessionIdRef = useRef(0);
  const [displayState, setDisplayState] = useState<TaskActionState>(null);
  const [effort, setEffort] = useState<EffortLevel>(task?.effort ?? "medium");
  const [selectedAssignee, setSelectedAssignee] = useState(
    taskAssigneeKey(task),
  );
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const id = useId();
  const triggerDisabled = task ? !task.permissions.canEdit : false;
  const assigneeDisabled = task ? !task.permissions.canReassign : false;
  const decodedAssignee = decodeAssigneeKey(selectedAssignee);
  const pendingAssignee = decodedAssignee?.kind === "cohort";
  const canChooseDone =
    !pendingAssignee &&
    (task
      ? task.permissions.canComplete
      : decodedAssignee?.kind === "member" &&
        decodedAssignee.id === props.actorId);
  const statusIsLockedDone = status === "done" && !canChooseDone;

  const handleAction = useCallback(
    async (previousState: TaskActionState, formData: FormData) => {
      const submittedSessionId = sessionIdRef.current;
      setDisplayState(null);
      normalizeDeadline(formData);
      const result = await action(previousState, formData);
      if (result?.ok) {
        if (sessionIdRef.current === submittedSessionId) {
          if (!isEditing) {
            setEffort("medium");
            setSelectedAssignee("");
            setStatus("todo");
          }
          setOpen(false);
        }
        onSaved(result.data);
      } else if (sessionIdRef.current === submittedSessionId) {
        setDisplayState(result);
      }
      return result;
    },
    [action, isEditing, onSaved],
  );
  const [, formAction, pending] = useActionState<TaskActionState, FormData>(
    handleAction,
    null,
  );
  const fieldErrors =
    displayState && !displayState.ok ? displayState.fieldErrors : undefined;

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
      sessionIdRef.current += 1;
      setSessionId(sessionIdRef.current);
      setDisplayState(null);
      setEffort(task?.effort ?? "medium");
      setSelectedAssignee(taskAssigneeKey(task));
      setStatus(task?.status ?? "todo");
    }
    setOpen(nextOpen);
  }

  function updateAssignee(nextAssignee: string): void {
    const decoded = decodeAssigneeKey(nextAssignee);
    setSelectedAssignee(nextAssignee);
    if (
      decoded?.kind === "cohort" ||
      (status === "done" &&
        (decoded?.kind !== "member" || decoded.id !== props.actorId))
    ) {
      setStatus("todo");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={isEditing ? "sm" : "default"}
          variant={isEditing ? "outline" : "default"}
          disabled={triggerDisabled}
          className="motion-reduce:transition-none"
        >
          {isEditing ? (
            <Pencil className="size-3.5" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {props.triggerLabel ?? (isEditing ? "Edit task" : "Create task")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit task" : "Create a task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Keep the next step clear and workable for the person taking it on."
              : "Choose one clear outcome so the team knows what moving forward looks like."}
          </DialogDescription>
        </DialogHeader>

        <form key={sessionId} action={formAction} className="mt-6 space-y-5">
          <input type="hidden" name="projectId" value={props.projectId} />
          {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
          <input
            type="hidden"
            name="assigneeKind"
            value={decodedAssignee?.kind ?? ""}
          />
          <input
            type="hidden"
            name="assigneeId"
            value={decodedAssignee?.id ?? ""}
          />

          <div className="space-y-2">
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input
              id={`${id}-title`}
              name="title"
              type="text"
              maxLength={200}
              defaultValue={task?.title ?? ""}
              placeholder="Draft the launch brief"
              required
              disabled={pending}
              className="motion-reduce:transition-none"
              aria-invalid={fieldErrors?.title ? true : undefined}
              aria-describedby={
                fieldErrors?.title ? `${id}-title-error` : undefined
              }
            />
            {fieldErrors?.title?.[0] ? (
              <p id={`${id}-title-error`} className="text-sm text-rose-700">
                {fieldErrors.title[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-description`}>Description (optional)</Label>
            <Textarea
              id={`${id}-description`}
              name="description"
              defaultValue={task?.description ?? ""}
              placeholder="Add the context that will make this easier to complete."
              disabled={pending}
              className="motion-reduce:transition-none"
              aria-invalid={fieldErrors?.description ? true : undefined}
              aria-describedby={
                fieldErrors?.description ? `${id}-description-error` : undefined
              }
            />
            {fieldErrors?.description?.[0] ? (
              <p
                id={`${id}-description-error`}
                className="text-sm text-rose-700"
              >
                {fieldErrors.description[0]}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-assignee`}>Assignee</Label>
              <Select
                id={`${id}-assignee`}
                value={selectedAssignee}
                onChange={(event) => updateAssignee(event.target.value)}
                required
                disabled={pending || assigneeDisabled}
                className="motion-reduce:transition-none"
                aria-invalid={fieldErrors?.assigneeId ? true : undefined}
                aria-describedby={
                  assigneeDisabled
                    ? `${id}-assignee-help`
                    : fieldErrors?.assigneeId
                      ? `${id}-assignee-error`
                      : undefined
                }
              >
                <option value="" disabled>
                  Choose an assignee
                </option>
                {props.assignees.map((assignee) => (
                  <option
                    key={assigneeOptionKey(assignee)}
                    value={assigneeOptionKey(assignee)}
                  >
                    {assignee.kind === "member"
                      ? assignee.label
                      : `@${assignee.githubHandle} — awaiting GitHub sign-in`}
                  </option>
                ))}
              </Select>
              {assigneeDisabled ? (
                <p
                  id={`${id}-assignee-help`}
                  className="text-xs text-slate-500"
                >
                  The assignee stays fixed after the first completion.
                </p>
              ) : null}
              {fieldErrors?.assigneeId?.[0] ? (
                <p
                  id={`${id}-assignee-error`}
                  className="text-sm text-rose-700"
                >
                  {fieldErrors.assigneeId[0]}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-effort`}>Effort</Label>
              <Select
                id={`${id}-effort`}
                name="effort"
                value={effort}
                onChange={(event) =>
                  setEffort(event.target.value as EffortLevel)
                }
                disabled={pending}
                className="motion-reduce:transition-none"
                aria-invalid={fieldErrors?.effort ? true : undefined}
                aria-describedby={`${id}-effort-help${
                  fieldErrors?.effort ? ` ${id}-effort-error` : ""
                }`}
              >
                {EFFORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p
                id={`${id}-effort-help`}
                data-testid="base-point-estimate"
                className="text-xs leading-5 text-slate-500"
              >
                Estimated base reward: {basePointsForEffort(effort)} points.
                Early and streak bonuses are calculated securely when completed.
              </p>
              {fieldErrors?.effort?.[0] ? (
                <p id={`${id}-effort-error`} className="text-sm text-rose-700">
                  {fieldErrors.effort[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-due-at`}>Deadline (optional)</Label>
              <Input
                id={`${id}-due-at`}
                name="dueAt"
                type="datetime-local"
                step={1}
                defaultValue={localDateTimeValue(task?.dueAt)}
                disabled={pending}
                className="motion-reduce:transition-none"
                aria-invalid={fieldErrors?.dueAt ? true : undefined}
                aria-describedby={
                  fieldErrors?.dueAt ? `${id}-due-at-error` : undefined
                }
              />
              {fieldErrors?.dueAt?.[0] ? (
                <p id={`${id}-due-at-error`} className="text-sm text-rose-700">
                  {fieldErrors.dueAt[0]}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-status`}>Status</Label>
              {pendingAssignee ? (
                <Select
                  id={`${id}-status`}
                  name="status"
                  value="todo"
                  disabled={pending}
                  className="motion-reduce:transition-none"
                  aria-invalid={fieldErrors?.status ? true : undefined}
                  aria-describedby={
                    fieldErrors?.status ? `${id}-status-error` : undefined
                  }
                >
                  <option value="todo">To Do</option>
                </Select>
              ) : statusIsLockedDone ? (
                <div className="space-y-2">
                  <input type="hidden" name="status" value="done" />
                  <Select
                    id={`${id}-status`}
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as TaskStatus)
                    }
                    disabled={pending}
                    className="motion-reduce:transition-none"
                  >
                    <option value="done" disabled>
                      Done (current status)
                    </option>
                    {STATUS_OPTIONS.filter(
                      (option) => option.value !== "done",
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-500">
                    Only the assignee can mark this task Done.
                  </p>
                </div>
              ) : (
                <Select
                  id={`${id}-status`}
                  name="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as TaskStatus)
                  }
                  disabled={pending}
                  className="motion-reduce:transition-none"
                  aria-invalid={fieldErrors?.status ? true : undefined}
                  aria-describedby={
                    fieldErrors?.status ? `${id}-status-error` : undefined
                  }
                >
                  {STATUS_OPTIONS.filter(
                    (option) => option.value !== "done" || canChooseDone,
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
              {fieldErrors?.status?.[0] ? (
                <p id={`${id}-status-error`} className="text-sm text-rose-700">
                  {fieldErrors.status[0]}
                </p>
              ) : null}
            </div>
          </div>

          {displayState && !displayState.ok ? (
            <p
              className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
              role="alert"
              aria-live="polite"
            >
              {displayState.message}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="motion-reduce:transition-none"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="motion-reduce:transition-none"
            >
              {pending
                ? isEditing
                  ? "Saving task…"
                  : "Creating task…"
                : isEditing
                  ? "Save task"
                  : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
