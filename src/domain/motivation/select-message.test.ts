import { describe, expect, it } from "vitest";

import { MESSAGE_CATALOG } from "@/domain/motivation/catalog";
import {
  selectMotivationMessage,
  selectPrimaryCompletionEvent,
} from "@/domain/motivation/select-message";
import { MOTIVATION_EVENTS, MOTIVATION_TONES } from "@/domain/motivation/types";

const prohibited = [
  /\blazy\b/i,
  /\bfail(?:ed|ure)?\b/i,
  /\bpunish(?:ed|ment)?\b/i,
  /\bshould have\b/i,
  /\bdisappoint(?:ed|ment)?\b/i,
  /\bbehind (?:everyone|the team)\b/i,
  /\bworse than\b/i,
  /\bor else\b/i,
];

describe("motivation message catalog", () => {
  it("defines exactly two safe templates for every event and tone", () => {
    expect(MOTIVATION_EVENTS).toHaveLength(7);
    expect(MOTIVATION_TONES).toHaveLength(4);

    for (const event of MOTIVATION_EVENTS) {
      for (const tone of MOTIVATION_TONES) {
        const templates = MESSAGE_CATALOG[event][tone];
        expect(templates).toHaveLength(2);

        for (const template of templates) {
          expect(template.key).toMatch(new RegExp(`^${event}-${tone}-v[12]$`));
          expect(template.title.length).toBeGreaterThan(0);
          expect(template.body.length).toBeGreaterThan(0);
          expect(template.body.length).toBeLessThanOrEqual(140);

          for (const pattern of prohibited) {
            expect(`${template.title} ${template.body}`).not.toMatch(pattern);
          }
        }
      }
    }
  });

  it("selects the same immutable content for the same source identity", () => {
    const input = {
      event: "focus_task_completed" as const,
      tone: "friendly" as const,
      sourceId: "60000000-0000-4000-8000-000000000001",
    };

    const first = selectMotivationMessage(input);
    expect(selectMotivationMessage(input)).toEqual(first);
    expect(selectMotivationMessage(input)).toEqual(first);
    expect(first).toMatchObject({
      event: input.event,
      tone: input.tone,
    });
  });
});

describe("selectPrimaryCompletionEvent", () => {
  const baseline = {
    newAchievementCodes: [] as const,
    achievementVisibilityEnabled: true,
    streakIncremented: false,
    completedFocusTask: false,
    timingMultiplier: 1 as const,
  };

  it("prioritizes a visible achievement over every other completion event", () => {
    expect(
      selectPrimaryCompletionEvent({
        ...baseline,
        newAchievementCodes: ["momentum_three"],
        streakIncremented: true,
        completedFocusTask: true,
        timingMultiplier: 1.2,
      }),
    ).toBe("achievement_unlocked");
  });

  it("skips achievement messaging when achievement visibility is disabled", () => {
    expect(
      selectPrimaryCompletionEvent({
        ...baseline,
        newAchievementCodes: ["momentum_three"],
        achievementVisibilityEnabled: false,
        streakIncremented: true,
        completedFocusTask: true,
        timingMultiplier: 1.2,
      }),
    ).toBe("streak_extended");
  });

  it.each([
    [{ ...baseline, streakIncremented: true }, "streak_extended"],
    [{ ...baseline, completedFocusTask: true }, "focus_task_completed"],
    [{ ...baseline, timingMultiplier: 1.2 as const }, "completed_early"],
    [{ ...baseline, timingMultiplier: 1.1 as const }, "task_completed"],
  ] as const)("selects the next completion priority for %#", (input, event) => {
    expect(selectPrimaryCompletionEvent(input)).toBe(event);
  });
});
