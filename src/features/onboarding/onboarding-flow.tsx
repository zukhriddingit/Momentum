"use client";

import { useCallback, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "@/features/workspaces/workspace-form";
import type { WorkspaceNavigationView, WorkspaceSummary } from "@/server/types";

export function OnboardingFlow({
  navigation,
}: {
  navigation: WorkspaceNavigationView;
}) {
  const resumableWorkspace = navigation.workspaces.find(
    (workspace) => workspace.projects.length === 0,
  );
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(
    resumableWorkspace ?? null,
  );
  const handleCreated = useCallback((created: WorkspaceSummary) => {
    setWorkspace(created);
  }, []);

  if (workspace) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-violet-700">Step 2 of 2</p>
          <CardTitle>Create your first project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-900">
              {workspace.name}
            </span>{" "}
            is ready. Next, give the work a clear home with one focused project.
          </p>
          <p
            className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900"
            role="status"
            data-workspace-id={workspace.id}
          >
            Your workspace is saved. Project setup is the next step.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-violet-700">Step 1 of 2</p>
        <CardTitle>Create your workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <WorkspaceForm onCreated={handleCreated} />
      </CardContent>
    </Card>
  );
}
