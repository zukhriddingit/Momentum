import { describe, expect, it } from "vitest";

import { getCelebrationPreset } from "./celebration-preset";

describe("completion celebration presets", () => {
  it("uses the loud desktop preset", () => {
    expect(
      getCelebrationPreset({
        enabled: true,
        reducedMotion: false,
        viewportWidth: 1440,
      }),
    ).toEqual({
      enabled: true,
      particleCount: 150,
      emojiCount: 36,
      spread: 92,
      scalar: 1.1,
    });
  });

  it("bounds mobile particles", () => {
    expect(
      getCelebrationPreset({
        enabled: true,
        reducedMotion: false,
        viewportWidth: 390,
      }),
    ).toEqual({
      enabled: true,
      particleCount: 84,
      emojiCount: 18,
      spread: 72,
      scalar: 0.85,
    });
  });

  it.each([
    { enabled: false, reducedMotion: false },
    { enabled: true, reducedMotion: true },
  ])("disables moving particles for $enabled/$reducedMotion", (input) => {
    expect(
      getCelebrationPreset({ ...input, viewportWidth: 1440 }).enabled,
    ).toBe(false);
  });
});
