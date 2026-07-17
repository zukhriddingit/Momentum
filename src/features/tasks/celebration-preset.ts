export interface CelebrationPreset {
  enabled: boolean;
  particleCount: number;
  emojiCount: number;
  spread: number;
  scalar: number;
}

export function getCelebrationPreset(input: {
  enabled: boolean;
  reducedMotion: boolean;
  viewportWidth: number;
}): CelebrationPreset {
  if (!input.enabled || input.reducedMotion) {
    return {
      enabled: false,
      particleCount: 0,
      emojiCount: 0,
      spread: 0,
      scalar: 1,
    };
  }

  return input.viewportWidth < 640
    ? {
        enabled: true,
        particleCount: 84,
        emojiCount: 18,
        spread: 72,
        scalar: 0.85,
      }
    : {
        enabled: true,
        particleCount: 150,
        emojiCount: 36,
        spread: 92,
        scalar: 1.1,
      };
}
