import { describe, expect, it } from "vitest";

import {
  clearFeedbackDraft,
  feedbackDraftStorageKey,
  persistFeedbackDraft,
  readFeedbackDraft,
  restoreFeedbackDraft,
  runWithFeedbackDraftProtection,
  serializeFeedbackDraft,
  type FeedbackDraftStorage,
} from "@/features/feedback/draft-persistence";

const valid = {
  workspaceId: "20000000-0000-4000-8000-000000000001",
  pageContext: "/workspaces/20000000-0000-4000-8000-000000000001",
  category: "confusing",
  rating: "4",
  message: "  The focus action could be clearer.  ",
  idempotencyKey: "90000000-0000-4000-8000-000000000001",
};

class MemoryStorage implements FeedbackDraftStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function validFormData(): FormData {
  const formData = new FormData();
  Object.entries(valid).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("uncertain feedback draft persistence", () => {
  it("serializes only the exact normalized and bounded draft fields", () => {
    const serialized = serializeFeedbackDraft(valid);

    expect(restoreFeedbackDraft(serialized)).toEqual({
      workspaceId: valid.workspaceId,
      pageContext: valid.pageContext,
      category: "confusing",
      rating: 4,
      message: "The focus action could be clearer.",
      idempotencyKey: valid.idempotencyKey,
    });
    expect(Object.keys(JSON.parse(serialized!)).sort()).toEqual([
      "category",
      "idempotencyKey",
      "message",
      "pageContext",
      "rating",
      "version",
      "workspaceId",
    ]);
  });

  it.each([
    [null],
    ["not-json"],
    [JSON.stringify({ version: 2, ...valid })],
    [JSON.stringify({ version: 1, ...valid, message: "🚀".repeat(5) })],
    [JSON.stringify({ version: 1, ...valid, message: "x".repeat(1001) })],
    [
      JSON.stringify({
        version: 1,
        ...valid,
        pageContext: "/dashboard?secret=value",
      }),
    ],
  ])("rejects malformed or out-of-bounds stored input", (serialized) => {
    expect(restoreFeedbackDraft(serialized)).toBeNull();
  });

  it("persists, restores, and clears within a user-scoped key", () => {
    const storage = new MemoryStorage();
    const key = feedbackDraftStorageKey("10000000-0000-4000-8000-000000000001");

    expect(persistFeedbackDraft(storage, key, valid)).toEqual(
      restoreFeedbackDraft(serializeFeedbackDraft(valid)),
    );
    expect(readFeedbackDraft(storage, key)?.idempotencyKey).toBe(
      valid.idempotencyKey,
    );

    clearFeedbackDraft(storage, key);
    expect(readFeedbackDraft(storage, key)).toBeNull();
  });

  it("fails closed when storage is unavailable", () => {
    const unavailable: FeedbackDraftStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
      removeItem: () => {
        throw new Error("unavailable");
      },
    };
    const key = feedbackDraftStorageKey("browser");

    expect(persistFeedbackDraft(unavailable, key, valid)).toBeNull();
    expect(readFeedbackDraft(unavailable, key)).toBeNull();
    expect(() => clearFeedbackDraft(unavailable, key)).not.toThrow();
  });

  it("persists and publishes the normalized draft before starting an unresolved request", async () => {
    const storage = new MemoryStorage();
    const key = feedbackDraftStorageKey("pending-user");
    const order: string[] = [];
    let resolveRequest!: (value: { ok: true }) => void;
    const request = new Promise<{ ok: true }>((resolve) => {
      resolveRequest = resolve;
    });

    const outcomePromise = runWithFeedbackDraftProtection({
      storage,
      storageKey: key,
      formData: validFormData(),
      onPrepared(draft) {
        order.push("prepared");
        expect(draft).toEqual(readFeedbackDraft(storage, key));
      },
      submit() {
        order.push("submitted");
        expect(readFeedbackDraft(storage, key)?.message).toBe(
          "The focus action could be clearer.",
        );
        return request;
      },
    });

    expect(order).toEqual(["prepared", "submitted"]);
    expect(readFeedbackDraft(storage, key)).not.toBeNull();

    resolveRequest({ ok: true });
    await expect(outcomePromise).resolves.toMatchObject({
      status: "resolved",
      result: { ok: true },
    });
    expect(readFeedbackDraft(storage, key)).toBeNull();
  });

  it.each([{ ok: true as const }, { ok: false as const, code: "VALIDATION" }])(
    "clears the snapshot after a definitive %# result",
    async (result) => {
      const storage = new MemoryStorage();
      const key = feedbackDraftStorageKey(`resolved-${String(result.ok)}`);

      const outcome = await runWithFeedbackDraftProtection({
        storage,
        storageKey: key,
        formData: validFormData(),
        onPrepared() {},
        submit: async () => result,
      });

      expect(outcome).toEqual({
        status: "resolved",
        result,
        draft: restoreFeedbackDraft(serializeFeedbackDraft(valid)),
      });
      expect(readFeedbackDraft(storage, key)).toBeNull();
    },
  );

  it("retains the preflight snapshot when the transport rejects", async () => {
    const storage = new MemoryStorage();
    const key = feedbackDraftStorageKey("uncertain-user");

    const outcome = await runWithFeedbackDraftProtection({
      storage,
      storageKey: key,
      formData: validFormData(),
      onPrepared() {},
      submit: async () => {
        throw new Error("transport failed");
      },
    });

    expect(outcome.status).toBe("uncertain");
    expect(readFeedbackDraft(storage, key)).toEqual(outcome.draft);
  });

  it("publishes the normalized in-memory draft when storage is unavailable", async () => {
    const unavailable: FeedbackDraftStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
      removeItem: () => {
        throw new Error("unavailable");
      },
    };
    let preparedDraft: unknown = null;

    const outcome = await runWithFeedbackDraftProtection({
      storage: unavailable,
      storageKey: feedbackDraftStorageKey("no-storage-user"),
      formData: validFormData(),
      onPrepared(draft) {
        preparedDraft = draft;
      },
      submit: async () => {
        throw new Error("transport failed");
      },
    });

    expect(preparedDraft).toEqual(
      restoreFeedbackDraft(serializeFeedbackDraft(valid)),
    );
    expect(outcome).toEqual({
      status: "uncertain",
      draft: preparedDraft,
    });
  });
});
