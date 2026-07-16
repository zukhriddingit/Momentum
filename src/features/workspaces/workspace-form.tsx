"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceAction,
  type CreateWorkspaceState,
} from "@/features/workspaces/actions";
import type { WorkspaceSummary } from "@/server/types";

export function WorkspaceForm({
  onCreated,
}: {
  onCreated: (workspace: WorkspaceSummary) => void;
}) {
  const [state, action, pending] = useActionState<
    CreateWorkspaceState,
    FormData
  >(createWorkspaceAction, null);
  const nameErrors = state && !state.ok ? state.fieldErrors?.name : undefined;

  useEffect(() => {
    if (state?.ok) {
      onCreated(state.data);
    }
  }, [onCreated, state]);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          name="name"
          type="text"
          autoComplete="organization"
          maxLength={120}
          placeholder="Design Team"
          required
          disabled={pending}
          aria-describedby={
            nameErrors
              ? "workspace-name-help workspace-name-error"
              : "workspace-name-help"
          }
          aria-invalid={nameErrors ? true : undefined}
        />
        <p id="workspace-name-help" className="text-xs text-slate-500">
          Use the team or group name that will make this space easy to find.
        </p>
        {nameErrors?.[0] ? (
          <p id="workspace-name-error" className="text-sm text-rose-700">
            {nameErrors[0]}
          </p>
        ) : null}
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

      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating your workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
