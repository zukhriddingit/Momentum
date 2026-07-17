import "server-only";

import { headers } from "next/headers";

import {
  readRuntimeEnvironment,
  type MomentumEnvironment,
} from "@/server/environment";

export function resolveRequestNow(input: {
  environment: MomentumEnvironment;
  allowTestClock: boolean;
  testNow: string | null;
  systemNow: Date;
}): Date {
  if (input.environment === "test" && input.allowTestClock && input.testNow) {
    const parsed = new Date(input.testNow);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return input.systemNow;
}

export async function requestNow(): Promise<Date> {
  const environment = readRuntimeEnvironment().name;
  const allowTestClock = process.env.MOMENTUM_ALLOW_TEST_CLOCK === "true";
  const systemNow = new Date();

  if (environment !== "test" || !allowTestClock) {
    return systemNow;
  }

  const headerStore = await headers();
  return resolveRequestNow({
    environment,
    allowTestClock,
    testNow: headerStore.get("x-momentum-test-now"),
    systemNow,
  });
}
