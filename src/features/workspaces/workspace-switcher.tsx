"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { WorkspaceForm } from "@/features/workspaces/workspace-form";
import type { WorkspaceNavigationView, WorkspaceSummary } from "@/server/types";

function pathSelection(pathname: string): {
  workspaceId: string | null;
  projectId: string | null;
} {
  const parts = pathname.split("/").filter(Boolean);
  const workspaceIndex = parts.indexOf("workspaces");
  if (workspaceIndex < 0) {
    return { workspaceId: null, projectId: null };
  }

  return {
    workspaceId: parts[workspaceIndex + 1] ?? null,
    projectId:
      parts[workspaceIndex + 2] === "projects"
        ? (parts[workspaceIndex + 3] ?? null)
        : null,
  };
}

export function WorkspaceSwitcher({
  navigation,
}: {
  navigation: WorkspaceNavigationView;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const selection = pathSelection(pathname);
  const selectedWorkspace =
    navigation.workspaces.find(
      (workspace) => workspace.id === selection.workspaceId,
    ) ?? navigation.workspaces[0];
  const selectedProjectId = selectedWorkspace?.projects.some(
    (project) => project.id === selection.projectId,
  )
    ? selection.projectId
    : "";

  const handleWorkspaceCreated = useCallback(
    (workspace: WorkspaceSummary) => {
      setCreateOpen(false);
      router.push(`/workspaces/${workspace.id}`);
      router.refresh();
    },
    [router],
  );

  if (pathname === "/onboarding") {
    return null;
  }

  return (
    <div className="flex flex-1 flex-wrap items-end gap-2 lg:flex-nowrap">
      {selectedWorkspace ? (
        <>
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor="workspace-switcher" className="text-xs">
              Workspace
            </Label>
            <Select
              id="workspace-switcher"
              value={selectedWorkspace.id}
              onChange={(event) => {
                const workspace = navigation.workspaces.find(
                  (option) => option.id === event.target.value,
                );
                if (workspace) {
                  router.push(`/workspaces/${workspace.id}`);
                }
              }}
              aria-label="Switch workspace"
            >
              {navigation.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor="project-switcher" className="text-xs">
              Project
            </Label>
            <Select
              id="project-switcher"
              value={selectedProjectId ?? ""}
              onChange={(event) => {
                const projectId = event.target.value;
                const project = selectedWorkspace.projects.find(
                  (option) => option.id === projectId,
                );
                if (project) {
                  router.push(
                    `/workspaces/${selectedWorkspace.id}/projects/${project.id}`,
                  );
                } else if (projectId === "") {
                  router.push(`/workspaces/${selectedWorkspace.id}`);
                }
              }}
              aria-label="Switch project"
            >
              <option value="">Workspace overview</option>
              {selectedWorkspace.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Create a workspace to begin.</p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" aria-label="Create workspace">
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Workspace</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              Add a focused home for another team or area of work.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <WorkspaceForm onCreated={handleWorkspaceCreated} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
