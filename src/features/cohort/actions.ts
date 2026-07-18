"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { addCohortSeatSchema } from "@/features/cohort/schemas";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { addCohortSeat } from "@/server/cohort/add-cohort-seat";
import { resolveCohortParticipant } from "@/server/cohort/github-directory";
import type {
  CohortDirectoryEntry,
  CohortSeatView,
} from "@/server/cohort/types";
import { requireWorkspaceManager } from "@/server/workspaces/require-workspace-manager";

export type AddCohortSeatState = ActionResult<CohortSeatView> | null;

const EXPECTED_LOOKUP_FAILURES = new Set([
  "GitHub handle is invalid.",
  "GitHub account was not found.",
  "GitHub account response was invalid.",
  "GitHub account lookup is temporarily unavailable.",
]);

function isExpectedLookupFailure(error: unknown): error is Error {
  return error instanceof Error && EXPECTED_LOOKUP_FAILURES.has(error.message);
}

export async function addCohortSeatAction(
  _previousState: AddCohortSeatState,
  formData: FormData,
): Promise<AddCohortSeatState> {
  const parsed = addCohortSeatSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    githubHandle: formData.get("githubHandle"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the GitHub username, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const user = await requireUser();
    await requireWorkspaceManager({
      actorId: user.id,
      workspaceId: parsed.data.workspaceId,
    });

    let participant: CohortDirectoryEntry;
    try {
      participant = await resolveCohortParticipant(parsed.data.githubHandle);
    } catch (error) {
      if (isExpectedLookupFailure(error)) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message:
            "We could not verify that GitHub account yet. Check the username or try again.",
        };
      }
      throw error;
    }

    const occurredAt = await requestNow();
    const seat = await addCohortSeat({
      actorId: user.id,
      workspaceId: parsed.data.workspaceId,
      participant,
      occurredAt,
    });
    revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
    return { ok: true, data: seat };
  } catch (error) {
    return actionFailure(error);
  }
}
