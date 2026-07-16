"use client";

import { useActionState, useCallback, useId, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectAction,
  type ProjectActionState,
  updateProjectAction,
} from "@/features/projects/actions";
import type { ProjectSummary } from "@/server/types";

export function ProjectFormDialog({
  workspaceId,
  project,
  triggerLabel,
  onSaved,
}: {
  workspaceId: string;
  project?: ProjectSummary;
  triggerLabel?: string;
  onSaved?: (project: ProjectSummary) => void;
}) {
  const isEditing = project !== undefined;
  const action = isEditing ? updateProjectAction : createProjectAction;
  const [open, setOpen] = useState(false);
  const handleAction = useCallback(
    async (previousState: ProjectActionState, formData: FormData) => {
      const result = await action(previousState, formData);
      if (result?.ok) {
        setOpen(false);
        onSaved?.(result.data);
      }
      return result;
    },
    [action, onSaved],
  );
  const [state, formAction, pending] = useActionState<
    ProjectActionState,
    FormData
  >(handleAction, null);
  const id = useId();
  const nameErrors = state && !state.ok ? state.fieldErrors?.name : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEditing ? "outline" : "default"}>
          {triggerLabel ?? (isEditing ? "Edit project" : "Create project")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit project" : "Create a project"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Keep the project name and purpose clear for everyone involved."
              : "Give this work a clear home. You can start adding tasks next."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="mt-6 space-y-5">
          {isEditing ? (
            <input type="hidden" name="projectId" value={project.id} />
          ) : (
            <input type="hidden" name="workspaceId" value={workspaceId} />
          )}

          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Project name</Label>
            <Input
              id={`${id}-name`}
              name="name"
              type="text"
              maxLength={140}
              defaultValue={project?.name ?? ""}
              placeholder="Launch plan"
              required
              disabled={pending}
              aria-describedby={
                nameErrors
                  ? `${id}-name-help ${id}-name-error`
                  : `${id}-name-help`
              }
              aria-invalid={nameErrors ? true : undefined}
            />
            <p id={`${id}-name-help`} className="text-xs text-slate-500">
              Choose a short name your team will recognize quickly.
            </p>
            {nameErrors?.[0] ? (
              <p id={`${id}-name-error`} className="text-sm text-rose-700">
                {nameErrors[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-description`}>Description (optional)</Label>
            <Textarea
              id={`${id}-description`}
              name="description"
              defaultValue={project?.description ?? ""}
              placeholder="What outcome is this project working toward?"
              disabled={pending}
            />
          </div>

          {state && !state.ok ? (
            <p
              className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
              role="alert"
              aria-live="polite"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? isEditing
                  ? "Saving changes…"
                  : "Creating project…"
                : isEditing
                  ? "Save project"
                  : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
