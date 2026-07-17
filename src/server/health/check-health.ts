import "server-only";

import { database } from "@/server/db/client";

async function databaseProbe(): Promise<unknown> {
  return database()`select 1 as one`;
}

export const HEALTH_PROBE_TIMEOUT_MS = 2_000;

export async function checkHealth(
  probe: () => Promise<unknown> = databaseProbe,
  timeoutMs: number = HEALTH_PROBE_TIMEOUT_MS,
): Promise<{ ok: boolean }> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(probe),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Health probe timed out.")),
          timeoutMs,
        );
      }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
