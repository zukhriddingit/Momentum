import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  countUnicodeCodePoints,
  FEEDBACK_CATEGORIES,
  type FeedbackSubmissionReceipt,
  type SubmitFeedbackInput,
} from "@/server/feedback/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

interface FeedbackRow {
  id: string;
  workspace_id: string | null;
  page_context: string | null;
  category: string;
  rating: number;
  message: string;
  created_at: Date;
}

function isNormalizedPageContext(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value === value.trim() &&
      value.length >= 1 &&
      value.length <= 200 &&
      value.startsWith("/") &&
      !value.includes("?") &&
      !value.includes("#"))
  );
}

function assertServiceInput(input: SubmitFeedbackInput): void {
  if (
    !input ||
    typeof input.actorId !== "string" ||
    !UUID_PATTERN.test(input.actorId) ||
    (input.workspaceId !== null &&
      (typeof input.workspaceId !== "string" ||
        !UUID_PATTERN.test(input.workspaceId))) ||
    !isNormalizedPageContext(input.pageContext) ||
    typeof input.category !== "string" ||
    !FEEDBACK_CATEGORIES.includes(input.category) ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5 ||
    typeof input.message !== "string" ||
    input.message !== input.message.trim() ||
    countUnicodeCodePoints(input.message) < 10 ||
    countUnicodeCodePoints(input.message) > 1000 ||
    FORBIDDEN_CONTROL_CHARACTERS.test(input.message) ||
    typeof input.idempotencyKey !== "string" ||
    !UUID_PATTERN.test(input.idempotencyKey) ||
    !(input.occurredAt instanceof Date) ||
    Number.isNaN(input.occurredAt.getTime())
  ) {
    throw new TypeError("Valid normalized feedback is required.");
  }
}

function samePayload(row: FeedbackRow, input: SubmitFeedbackInput): boolean {
  return (
    row.workspace_id === input.workspaceId &&
    row.page_context === input.pageContext &&
    row.category === input.category &&
    row.rating === input.rating &&
    row.message === input.message
  );
}

function receipt(
  row: FeedbackRow,
  wasDuplicate: boolean,
): FeedbackSubmissionReceipt {
  return { id: row.id, createdAt: row.created_at.toISOString(), wasDuplicate };
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<FeedbackSubmissionReceipt> {
  assertServiceInput(input);
  return database().begin(async (sql) => {
    if (input.workspaceId) {
      const membership = await sql<Array<{ exists: boolean }>>`
        select exists (
          select 1 from public.workspace_memberships
          where workspace_id = ${input.workspaceId}
            and user_id = ${input.actorId}
        ) as exists
      `;
      if (!membership[0]?.exists) {
        throw new AppError("NOT_FOUND", "Workspace not found.");
      }
    }

    const inserted = await sql<FeedbackRow[]>`
      insert into public.feedback_submissions (
        user_id, workspace_id, page_context, category, rating,
        message, idempotency_key, created_at
      ) values (
        ${input.actorId}, ${input.workspaceId}, ${input.pageContext},
        ${input.category}, ${input.rating}, ${input.message},
        ${input.idempotencyKey}, ${input.occurredAt}
      )
      on conflict (user_id, idempotency_key) do nothing
      returning id, workspace_id, page_context, category::text,
        rating::integer, message, created_at
    `;
    if (inserted[0]) {
      return receipt(inserted[0], false);
    }

    const existing = await sql<FeedbackRow[]>`
      select id, workspace_id, page_context, category::text,
        rating::integer, message, created_at
      from public.feedback_submissions
      where user_id = ${input.actorId}
        and idempotency_key = ${input.idempotencyKey}
    `;
    if (existing[0] && samePayload(existing[0], input)) {
      return receipt(existing[0], true);
    }
    throw new AppError(
      "CONFLICT",
      "That feedback retry did not match the original submission.",
    );
  });
}
