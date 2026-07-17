export const FEEDBACK_CATEGORIES = [
  "bug",
  "confusing",
  "motivation_feedback",
  "feature_request",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export function countUnicodeCodePoints(value: string): number {
  return [...value].length;
}

export interface SubmitFeedbackInput {
  actorId: string;
  workspaceId: string | null;
  pageContext: string | null;
  category: FeedbackCategory;
  rating: number;
  message: string;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface FeedbackSubmissionReceipt {
  id: string;
  createdAt: string;
  wasDuplicate: boolean;
}
