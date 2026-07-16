import "server-only";

import { headers } from "next/headers";

export async function requestNow(): Promise<Date> {
  if (process.env.MOMENTUM_ALLOW_TEST_CLOCK === "true") {
    const headerStore = await headers();
    const testNow = headerStore.get("x-momentum-test-now");
    if (testNow) {
      const parsed = new Date(testNow);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return new Date();
}
