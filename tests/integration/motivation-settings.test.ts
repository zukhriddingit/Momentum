import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { ensureProfile } from "@/server/profiles/ensure-profile";
import { getMotivationSettings } from "@/server/settings/get-motivation-settings";
import { updateMotivationSettings } from "@/server/settings/update-motivation-settings";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

describe("personal motivation settings", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("updates only the authenticated actor's settings", async () => {
    const firstUserId = selfServiceUuid(400);
    const secondUserId = selfServiceUuid(401);
    await Promise.all([
      insertAuthUser({
        id: firstUserId,
        email: "settings-first@momentum.local",
        displayName: "Settings First",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: secondUserId,
        email: "settings-second@momentum.local",
        displayName: "Settings Second",
        timezone: "America/New_York",
      }),
    ]);

    await expect(
      updateMotivationSettings({
        actorId: firstUserId,
        tone: "calm",
        timezone: "America/Los_Angeles",
        deadlineNudgesEnabled: false,
        celebrationAnimationEnabled: false,
        achievementVisibilityEnabled: false,
        occurredAt: new Date("2026-07-16T15:00:00.000Z"),
      }),
    ).resolves.toEqual({
      tone: "calm",
      timezone: "America/Los_Angeles",
      deadlineNudgesEnabled: false,
      celebrationAnimationEnabled: false,
      achievementVisibilityEnabled: false,
    });

    await expect(
      getMotivationSettings({ actorId: firstUserId }),
    ).resolves.toEqual({
      tone: "calm",
      timezone: "America/Los_Angeles",
      deadlineNudgesEnabled: false,
      celebrationAnimationEnabled: false,
      achievementVisibilityEnabled: false,
    });
    await expect(
      getMotivationSettings({ actorId: secondUserId }),
    ).resolves.toEqual({
      tone: "friendly",
      timezone: "America/New_York",
      deadlineNudgesEnabled: true,
      celebrationAnimationEnabled: true,
      achievementVisibilityEnabled: true,
    });
  });

  it("repairs a missing preference row without changing profile details", async () => {
    const userId = selfServiceUuid(402);
    await insertAuthUser({
      id: userId,
      email: "settings-repair@momentum.local",
      displayName: "Settings Repair",
      timezone: "America/New_York",
    });
    await database()`
      delete from public.motivation_preferences
      where user_id = ${userId}
    `;

    await ensureProfile({
      actorId: userId,
      displayName: "Settings Repair",
      timezone: "America/New_York",
    });

    await expect(getMotivationSettings({ actorId: userId })).resolves.toEqual({
      tone: "friendly",
      timezone: "America/New_York",
      deadlineNudgesEnabled: true,
      celebrationAnimationEnabled: true,
      achievementVisibilityEnabled: true,
    });
  });

  it("rejects invalid service input and missing actors", async () => {
    await expect(
      updateMotivationSettings({
        actorId: selfServiceUuid(499),
        tone: "minimal",
        timezone: "Not/AZone",
        deadlineNudgesEnabled: true,
        celebrationAnimationEnabled: true,
        achievementVisibilityEnabled: true,
        occurredAt: new Date("2026-07-16T15:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      updateMotivationSettings({
        actorId: selfServiceUuid(499),
        tone: "minimal",
        timezone: "UTC",
        deadlineNudgesEnabled: true,
        celebrationAnimationEnabled: true,
        achievementVisibilityEnabled: true,
        occurredAt: new Date("2026-07-16T15:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Profile not found.",
    });
  });
});
