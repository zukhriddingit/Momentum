"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import {
  archiveProjectSchema,
  createProjectSchema,
  updateProjectSchema,
} from "@/features/projects/schemas";
import { requireUser } from "@/server/auth/require-user";
import { archiveProject } from "@/server/projects/archive-project";
import { createProject } from "@/server/projects/create-project";
import { updateProject } from "@/server/projects/update-project";
import type { ArchiveProjectReceipt, ProjectSummary } from "@/server/types";

export type ProjectActionState = ActionResult<ProjectSummary> | null;
export type ArchiveProjectActionState =
  ActionResult<ArchiveProjectReceipt> | null;

export async function createProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = createProjectSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the project details, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const user = await requireUser();
    const project = await createProject({
      actorId: user.id,
      ...parsed.data,
    });
    revalidateProjectPaths(project);
    revalidatePath("/onboarding");
    return { ok: true, data: project };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = updateProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the project details, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const user = await requireUser();
    const project = await updateProject({
      actorId: user.id,
      ...parsed.data,
    });
    revalidateProjectPaths(project);
    return { ok: true, data: project };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function archiveProjectAction(
  _previousState: ArchiveProjectActionState,
  formData: FormData,
): Promise<ArchiveProjectActionState> {
  const parsed = archiveProjectSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That project could not be archived. Refresh and try again.",
    };
  }

  try {
    const user = await requireUser();
    const receipt = await archiveProject({
      actorId: user.id,
      projectId: parsed.data.projectId,
    });
    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    revalidatePath(`/workspaces/${receipt.workspaceId}`);
    revalidatePath(
      `/workspaces/${receipt.workspaceId}/projects/${receipt.projectId}`,
    );
    return { ok: true, data: receipt };
  } catch (error) {
    return actionFailure(error);
  }
}

function revalidateProjectPaths(project: ProjectSummary): void {
  revalidatePath("/dashboard");
  revalidatePath(`/workspaces/${project.workspaceId}`);
  revalidatePath(`/workspaces/${project.workspaceId}/projects/${project.id}`);
}
