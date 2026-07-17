import "server-only";

import { database } from "@/server/db/client";

async function databaseProbe(): Promise<unknown> {
  return database()`select 1 as one`;
}

export async function checkHealth(
  probe: () => Promise<unknown> = databaseProbe,
): Promise<{ ok: boolean }> {
  try {
    await probe();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
