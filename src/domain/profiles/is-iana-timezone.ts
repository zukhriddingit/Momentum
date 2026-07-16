export function normalizeIanaTimezone(value: string): string | null {
  try {
    const timezone = new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).resolvedOptions().timeZone;

    return timezone.includes("/") || timezone === "UTC" ? timezone : null;
  } catch {
    return null;
  }
}

export function isIanaTimezone(value: string): boolean {
  return normalizeIanaTimezone(value) !== null;
}
