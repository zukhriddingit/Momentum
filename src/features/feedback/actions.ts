"use server";

import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { feedbackSubmissionSchema } from "@/features/feedback/schemas";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { submitFeedback } from "@/server/feedback/submit-feedback";
import type { FeedbackSubmissionReceipt } from "@/server/feedback/types";

export type FeedbackActionState =
  ActionResult<FeedbackSubmissionReceipt> | null;

export async function submitFeedbackAction(
  _previousState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const parsed = feedbackSubmissionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    pageContext: formData.get("pageContext"),
    category: formData.get("category"),
    rating: formData.get("rating"),
    message: formData.get("message"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the highlighted feedback, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const result = await submitFeedback({
      actorId: user.id,
      ...parsed.data,
      occurredAt,
    });
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error);
  }
}
