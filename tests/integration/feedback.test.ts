import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { submitFeedback } from "@/server/feedback/submit-feedback";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { DEMO } from "../fixtures/demo";

const occurredAt = new Date("2026-07-16T15:00:00.000Z");
const base = {
  actorId: DEMO.userId,
  workspaceId: DEMO.workspaceId,
  pageContext: `/workspaces/${DEMO.workspaceId}`,
  category: "confusing" as const,
  rating: 4,
  message: "The focus action could be clearer.",
  idempotencyKey: "91000000-0000-4000-8000-000000000001",
  occurredAt,
};

describe("authenticated feedback submission", () => {
  afterAll(async () => closeDatabase());

  it("stores the authenticated actor and returns one row for identical retries", async () => {
    const first = await submitFeedback(base);
    const retry = await submitFeedback({
      ...base,
      occurredAt: new Date("2026-07-16T15:05:00.000Z"),
    });
    expect(first.wasDuplicate).toBe(false);
    expect(retry).toEqual({ ...first, wasDuplicate: true });
    const [count] = await database()<Array<{ count: number }>>`
      select count(*)::integer as count
      from public.feedback_submissions
      where user_id = ${DEMO.userId}
        and idempotency_key = ${base.idempotencyKey}
    `;
    expect(count?.count).toBe(1);
  });

  it("rejects changed user payload for the same key", async () => {
    for (const changed of [
      { ...base, workspaceId: null },
      { ...base, pageContext: "/dashboard" },
      { ...base, category: "bug" as const },
      { ...base, rating: 3 },
      { ...base, message: "Changed content must not overwrite." },
    ]) {
      await expect(submitFeedback(changed)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
  });

  it("makes an outsider workspace indistinguishable from a missing workspace", async () => {
    const outsiderWorkspace = await createWorkspace({
      actorId: DEMO.teammateId,
      name: "Teammate private workspace",
    });
    for (const workspaceId of [
      outsiderWorkspace.id,
      "92000000-0000-4000-8000-000000000001",
    ]) {
      await expect(
        submitFeedback({
          ...base,
          workspaceId,
          idempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }
  });

  it("exposes only the signed-in user's rows through Supabase RLS", async () => {
    await submitFeedback({
      ...base,
      actorId: DEMO.teammateId,
      idempotencyKey: "91000000-0000-4000-8000-000000000002",
      workspaceId: DEMO.workspaceId,
      message: "The teammate has separate feedback.",
    });
    const createBrowserClient = () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
    const demoClient = createBrowserClient();
    const teammateClient = createBrowserClient();
    await demoClient.auth.signInWithPassword({
      email: DEMO.email,
      password: DEMO.password,
    });
    await teammateClient.auth.signInWithPassword({
      email: DEMO.teammateEmail,
      password: DEMO.teammatePassword,
    });
    const demoRows = await demoClient
      .from("feedback_submissions")
      .select("user_id");
    const teammateRows = await teammateClient
      .from("feedback_submissions")
      .select("user_id");
    expect(demoRows.error).toBeNull();
    expect(teammateRows.error).toBeNull();
    expect(demoRows.data).toHaveLength(1);
    expect(teammateRows.data).toHaveLength(1);
    expect(demoRows.data?.every((row) => row.user_id === DEMO.userId)).toBe(
      true,
    );
    expect(
      teammateRows.data?.every((row) => row.user_id === DEMO.teammateId),
    ).toBe(true);
  });
});
