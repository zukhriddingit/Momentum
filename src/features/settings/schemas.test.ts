import { describe, expect, it } from "vitest";

import { MOTIVATION_TONES } from "@/domain/motivation/types";
import { motivationSettingsSchema } from "@/features/settings/schemas";

describe("motivationSettingsSchema", () => {
  it.each(MOTIVATION_TONES)("accepts the %s tone", (tone) => {
    expect(
      motivationSettingsSchema.parse({
        tone,
        timezone: "America/New_York",
        deadlineNudgesEnabled: true,
        celebrationAnimationEnabled: false,
        achievementVisibilityEnabled: true,
      }),
    ).toEqual({
      tone,
      timezone: "America/New_York",
      deadlineNudgesEnabled: true,
      celebrationAnimationEnabled: false,
      achievementVisibilityEnabled: true,
    });
  });

  it("rejects unknown tones and invalid timezones", () => {
    expect(() =>
      motivationSettingsSchema.parse({
        tone: "punitive",
        timezone: "Not/AZone",
        deadlineNudgesEnabled: true,
        celebrationAnimationEnabled: true,
        achievementVisibilityEnabled: true,
      }),
    ).toThrow();
  });

  it("requires explicit booleans and rejects unknown fields", () => {
    expect(() =>
      motivationSettingsSchema.parse({
        tone: "friendly",
        timezone: "UTC",
        deadlineNudgesEnabled: "on",
        celebrationAnimationEnabled: true,
        achievementVisibilityEnabled: true,
      }),
    ).toThrow();
    expect(() =>
      motivationSettingsSchema.parse({
        tone: "friendly",
        timezone: "UTC",
        deadlineNudgesEnabled: true,
        celebrationAnimationEnabled: true,
        achievementVisibilityEnabled: true,
        leaderboardEnabled: true,
      }),
    ).toThrow();
  });
});
