"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { workspaceSchema } from "@/features/workspaces/schemas";
import { requireUser } from "@/server/auth/require-user";
import type { WorkspaceSummary } from "@/server/types";
import { createWorkspace } from "@/server/workspaces/create-workspace";

export type CreateWorkspaceState = ActionResult<WorkspaceSummary> | null;

export async function createWorkspaceAction(
  _previousState: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const parsed = workspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the workspace name, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const user = await requireUser();
    const workspace = await createWorkspace({
      actorId: user.id,
      name: parsed.data.name,
    });
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    return { ok: true, data: workspace };
  } catch (error) {
    return actionFailure(error);
  }
}
