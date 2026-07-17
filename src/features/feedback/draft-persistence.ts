import { feedbackSubmissionSchema } from "@/features/feedback/schemas";
import type { SubmitFeedbackInput } from "@/server/feedback/types";

const SNAPSHOT_VERSION = 1;
const STORAGE_PREFIX = "momentum:feedback:submission:v1";

export type UncertainFeedbackDraft = Pick<
  SubmitFeedbackInput,
  | "workspaceId"
  | "pageContext"
  | "category"
  | "rating"
  | "message"
  | "idempotencyKey"
>;

export interface FeedbackDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type DraftProtectedSubmissionOutcome<T> =
  | {
      status: "resolved";
      result: T;
      draft: UncertainFeedbackDraft | null;
    }
  | {
      status: "uncertain";
      draft: UncertainFeedbackDraft | null;
    };

function normalizeDraft(input: unknown): UncertainFeedbackDraft | null {
  const parsed = feedbackSubmissionSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function feedbackDraftStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function feedbackDraftFromFormData(
  formData: FormData,
): UncertainFeedbackDraft | null {
  return normalizeDraft({
    workspaceId: formData.get("workspaceId"),
    pageContext: formData.get("pageContext"),
    category: formData.get("category"),
    rating: formData.get("rating"),
    message: formData.get("message"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
}

export function serializeFeedbackDraft(input: unknown): string | null {
  const draft = normalizeDraft(input);
  return draft ? JSON.stringify({ version: SNAPSHOT_VERSION, ...draft }) : null;
}

export function restoreFeedbackDraft(
  serialized: string | null,
): UncertainFeedbackDraft | null {
  if (!serialized) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      value.version !== SNAPSHOT_VERSION
    ) {
      return null;
    }

    const record = value as Record<string, unknown>;
    return normalizeDraft({
      workspaceId: record.workspaceId,
      pageContext: record.pageContext,
      category: record.category,
      rating: record.rating,
      message: record.message,
      idempotencyKey: record.idempotencyKey,
    });
  } catch {
    return null;
  }
}

export function persistFeedbackDraft(
  storage: FeedbackDraftStorage,
  key: string,
  input: unknown,
): UncertainFeedbackDraft | null {
  const serialized = serializeFeedbackDraft(input);
  if (!serialized) {
    return null;
  }

  try {
    storage.setItem(key, serialized);
    return restoreFeedbackDraft(serialized);
  } catch {
    return null;
  }
}

export function readFeedbackDraft(
  storage: FeedbackDraftStorage,
  key: string,
): UncertainFeedbackDraft | null {
  try {
    return restoreFeedbackDraft(storage.getItem(key));
  } catch {
    return null;
  }
}

export function clearFeedbackDraft(
  storage: FeedbackDraftStorage,
  key: string,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage may be unavailable; the live dialog still protects the draft.
  }
}

export async function runWithFeedbackDraftProtection<T>({
  storage,
  storageKey,
  formData,
  onPrepared,
  submit,
}: {
  storage: FeedbackDraftStorage;
  storageKey: string;
  formData: FormData;
  onPrepared: (draft: UncertainFeedbackDraft | null) => void;
  submit: () => Promise<T>;
}): Promise<DraftProtectedSubmissionOutcome<T>> {
  const normalizedDraft = feedbackDraftFromFormData(formData);
  const persistedDraft = normalizedDraft
    ? persistFeedbackDraft(storage, storageKey, normalizedDraft)
    : null;
  const protectedDraft = persistedDraft ?? normalizedDraft;

  onPrepared(protectedDraft);

  try {
    const result = await submit();
    clearFeedbackDraft(storage, storageKey);
    return { status: "resolved", result, draft: protectedDraft };
  } catch {
    return { status: "uncertain", draft: protectedDraft };
  }
}
