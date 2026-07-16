import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { ensureProfile } from "@/server/profiles/ensure-profile";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

describe("profile recovery", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("returns the same profile without creating a duplicate", async () => {
    const userId = selfServiceUuid(1);

    await insertAuthUser({
      id: userId,
      email: "profile-recovery@momentum.local",
      displayName: "Self Service User",
      timezone: "America/New_York",
    });

    await database()`
      delete from public.profiles
      where id = ${userId}
    `;

    const first = await ensureProfile({
      actorId: userId,
      displayName: "Self Service User",
      timezone: "america/new_york",
    });
    const second = await ensureProfile({
      actorId: userId,
      displayName: "Self Service User",
      timezone: "America/New_York",
    });

    expect(second).toEqual(first);
    expect(first).toEqual({
      id: userId,
      displayName: "Self Service User",
      timezone: "America/New_York",
      motivationTone: "friendly",
    });

    const [profileCount] = await database()<Array<{ count: number }>>`
      select count(*)::integer as count
      from public.profiles
      where id = ${userId}
    `;
    if (!profileCount) {
      throw new Error("Expected a profile count row.");
    }
    expect(profileCount.count).toBe(1);
  });

  it("does not overwrite an existing profile with conflicting details", async () => {
    const userId = selfServiceUuid(2);

    await insertAuthUser({
      id: userId,
      email: "profile-conflict@momentum.local",
      displayName: "Original Name",
      timezone: "America/New_York",
    });

    await expect(
      ensureProfile({
        actorId: userId,
        displayName: "Different Name",
        timezone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That profile already exists with different details.",
    });
  });
});
