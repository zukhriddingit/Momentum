import { defineConfig, devices } from "@playwright/test";

import { demoWorkdayInstant } from "./tests/fixtures/demo";
import { PLAYWRIGHT_JOB_SECRET } from "./tests/fixtures/self-service";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "x-momentum-test-now": demoWorkdayInstant().toISOString(),
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/sign-in",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      MOMENTUM_ALLOW_TEST_CLOCK: "true",
      MOMENTUM_ENVIRONMENT: "test",
      MOMENTUM_JOB_SECRET: PLAYWRIGHT_JOB_SECRET,
    },
  },
});
