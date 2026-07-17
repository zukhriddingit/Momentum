# Slice 4 Demo and Closed-Pilot Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Momentum MVP safely deployable to Vercel and hosted Supabase, reproducibly demonstrable, observable without leaking sensitive data, able to collect isolated authenticated feedback, and visibly celebratory without changing trusted product rules.

**Architecture:** Keep the existing Next.js App Router modular monolith and PostgreSQL transaction boundary. Add narrow server-only environment, observability, feedback, health, and operator modules; keep browser components responsible only for accessible interaction and decorative effects. Provision hosted demo auth identities through the Supabase Admin API, provision application rows transactionally through PostgreSQL, and never expose reset or provisioning as an HTTP endpoint.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, strict TypeScript 6.0.3, Tailwind CSS 4.3.2, shadcn/ui-compatible Radix primitives, Supabase Auth/PostgreSQL/CLI 2.109.1, postgres.js 3.4.9, Zod 4.4.3, Vitest 4.1.10, pgTAP, Playwright 1.61.1, canvas-confetti 1.9.4.

## Global Constraints

- Preserve Small 20, Medium 40, Large 70, and Extra Large 100 base points.
- Preserve timing multipliers 1.20 at least 24 hours early, 1.10 before the deadline, and 1.00 otherwise.
- Preserve `1 + min(0.20, 0.04 * preCompletionStreak)` as the streak multiplier.
- A workday without a Focus selection pauses the streak; an incomplete selected Focus Task breaks it; weekends neither increment nor break it.
- Preserve one Focus Task per user per workday, immutable completion receipts, positive immutable point-ledger rows, and exactly-once completion rewards.
- Reopening and recompleting must create no additional points, streak update, achievement, notification, or animated celebration.
- The guided completion must remain 52 points, streak two to three, Momentum Three plus Ahead of Schedule, 75% project progress, and one completion notification.
- Keep trusted reward, streak, achievement, authorization, message, and notification decisions on the server.
- Use supportive, non-shaming copy; add no negative points, public leaderboard, employee comparison, or AI decision-making.
- Preview/demo and production must use different Supabase projects, credentials, and Vercel variable scopes.
- Never commit or log a service-role key, database credential, demo password, bearer token, email address, phone number, raw error message, query string, task content, or feedback content.
- Do not run migrations, demo resets, or provisioning from `next build` or an ordinary application request.
- The only new production dependency is pinned `canvas-confetti@1.9.4`; add pinned `@types/canvas-confetti@1.9.0` as a development dependency and document the rationale.
- Maintain keyboard access, visible focus, responsive layouts, user animation preferences, and `prefers-reduced-motion` behavior.
- Do not implement email delivery, SMS, phone collection, quiet hours, a production scheduler, invitations, member administration, public feeds, billing, analytics, native mobile apps, or a feedback administration dashboard.

---

## File responsibility map

### Environment and deployment boundary

- Modify `.env.example` to list public, server-only, and operator-only variables with non-secret example values.
- Modify `scripts/with-local-supabase.mjs` to map local Supabase URL, publishable key, service-role key, database URL, local demo identities, and `MOMENTUM_ENVIRONMENT=local` into child processes without printing values.
- Create `src/server/environment.ts` and `src/server/environment.test.ts` for environment classification, release sanitization, and demo-operation refusal.
- Modify `src/app/(auth)/sign-in/page.tsx` so committed local credentials render only in local/test.
- Modify `playwright.config.ts` so the existing browser server explicitly runs as `test`.
- Modify `vitest.config.ts` to discover `src/server/**/*.test.ts` and alias `server-only` to its empty test module.

### Observability, health, and user-safe errors

- Create `src/server/observability/request-id.ts` and its test for bounded request IDs.
- Create `src/server/observability/logger.ts` and its test for allow-listed JSON events.
- Create `src/server/jobs/verify-job-secret.ts` and its test for exact bearer parsing and timing-safe comparison.
- Modify `src/lib/supabase/proxy.ts` and `src/proxy.ts` to preserve request IDs through auth-cookie refresh, redirects, public health, and protected job requests.
- Create `src/server/health/check-health.ts`, its unit test, and `src/app/api/health/route.ts` for sanitized database health.
- Create `src/instrumentation.ts` for Next.js request-error capture.
- Modify `src/features/action-result.ts` to return a safe diagnostic reference and log no raw error.
- Modify `src/app/api/jobs/deadline-nudges/route.ts` to use the shared secret verifier and safe structured outcome logs.
- Create `src/components/ui/skeleton.tsx`, `src/app/(app)/loading.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, and `src/app/global-error.tsx` for accessible safe states.

### Feedback vertical slice

- Create `supabase/migrations/202607170004_demo_pilot_readiness.sql` and `supabase/tests/database/fourth_slice.test.sql` for append-only feedback, RLS, constraints, membership integrity, and idempotency.
- Create `src/server/feedback/types.ts` and `src/server/feedback/submit-feedback.ts` for the trusted transactional service.
- Create `src/features/feedback/schemas.ts`, its unit test, `src/features/feedback/actions.ts`, and `src/features/feedback/feedback-dialog.tsx` for validated authenticated submission.
- Modify `src/app/(app)/layout.tsx` to expose the feedback dialog in the authenticated shell.
- Create `tests/integration/feedback.test.ts` for authorization, membership, RLS, identical retry, and changed-payload conflict behavior.
- Create `docs/feedback-review.sql` for an internal operator query that omits auth email addresses.

### Demo and operator toolchain

- Modify `supabase/seed.sql` to add a demo-owner due-soon task and representative read notification while preserving four tasks, 41 initial points, no current Focus selection, and the 52-point completion.
- Create `scripts/lib/demo-fixture.mjs` for shared semantic IDs, workday-aware dates, transactional application data, and canonical summaries.
- Create `scripts/provision-demo.mjs` for confirmed hosted demo auth users plus transactional fixture provisioning.
- Create `scripts/reset-demo.mjs` for typed, project-reference-bound, non-production linked resets.
- Create `scripts/trigger-deadline-nudges.mjs` for server-side manual bearer calls.
- Create `tests/demo/demo-reproducibility.mjs` for two clean provision cycles with canonical equality.
- Modify `tests/fixtures/demo.ts`, `tests/integration/deadline-nudges.test.ts`, and the existing Playwright expectations to account for the required global due-soon seed candidate without weakening idempotency checks.

### Celebration and guided browser flow

- Create `src/features/tasks/celebration-preset.ts`, its unit test, and `src/features/tasks/completion-celebration-effect.tsx` for finite desktop/mobile/reduced-motion behavior.
- Modify `src/server/projects/get-project-board.ts` and `src/server/types.ts` to carry the user's animation preference to start-task presentation.
- Modify `src/features/tasks/kanban-board.tsx`, `src/features/tasks/task-card.tsx`, `src/features/tasks/celebration-dialog.tsx`, `src/features/settings/motivation-settings-form.tsx`, and `src/app/globals.css` for the success-only pulse, burst, emojis, finite decoration, and static fallback.
- Create `playwright.demo.config.ts` and `tests/demo-e2e/demo-smoke.spec.ts` for the clean guided path and health check.
- Modify all three existing Playwright specs only where deterministic environment, nudge aggregate, effect gating, or reload-suppression assertions require it.

### Operations and validation

- Create `scripts/check-source-secrets.mjs` for tracked-source high-confidence secret patterns with explicit local-test allow-list entries.
- Create `docs/deployment.md`, `docs/demo-script.md`, and `docs/closed-pilot-checklist.md`.
- Modify `README.md` and `package.json`; let dependency and script changes update `pnpm-lock.yaml` mechanically.

## Contributor lanes and sequencing

- Lane A can implement Tasks 1-3: environment, request correlation, logs, health, and safe errors.
- Lane B can implement Tasks 4-6 after Task 1: feedback database, service, and UI.
- Lane C can implement Tasks 7-8 after Task 1: demo fixture and operator commands.
- Lane D can implement Task 9 after Task 1: celebration presentation.
- Task 10 integrates Lane C and Lane D in Playwright; Task 11 owns shared documentation and the final `package.json` script composition; Task 12 is the single release gate.
- Do not run lanes concurrently in the same working tree when they both touch `package.json`, `tests/fixtures/demo.ts`, or the design/plan documents. Use separate branches/worktrees and merge Lane A, B, C, then D before Tasks 10-12.

---

### Task 1: Environment classification and test discovery

**Files:**

- Create: `src/server/environment.ts`
- Create: `src/server/environment.test.ts`
- Modify: `vitest.config.ts`
- Modify: `scripts/with-local-supabase.mjs`
- Modify: `.env.example`
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Modify: `playwright.config.ts`

**Interfaces:**

- Produces: `readRuntimeEnvironment(env?: NodeJS.ProcessEnv): RuntimeEnvironment`
- Produces: `requireDemoOperatorEnvironment(env?: NodeJS.ProcessEnv): "local" | "test" | "preview"`
- Produces: `isLocalCredentialHintVisible(environment: MomentumEnvironment): boolean`
- `RuntimeEnvironment` is `{ name: MomentumEnvironment; release: string | null }`.

- [ ] **Step 1: Expand unit discovery and write failing environment tests**

Replace the Vitest config with server test discovery and the existing `server-only` test alias:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/domain/**/*.test.ts",
      "src/features/**/*.test.ts",
      "src/server/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/**/*.test.ts", "src/domain/**/types.ts"],
    },
  },
});
```

Create `src/server/environment.test.ts` with exact behavior:

```ts
import { describe, expect, it } from "vitest";

import {
  isLocalCredentialHintVisible,
  readRuntimeEnvironment,
  requireDemoOperatorEnvironment,
} from "./environment";

describe("Momentum environment classification", () => {
  it("uses an explicit Momentum environment and sanitizes releases", () => {
    expect(
      readRuntimeEnvironment({
        MOMENTUM_ENVIRONMENT: "preview",
        MOMENTUM_RELEASE: "slice-4.abc_123",
      }),
    ).toEqual({ name: "preview", release: "slice-4.abc_123" });
    expect(
      readRuntimeEnvironment({
        MOMENTUM_ENVIRONMENT: "production",
        MOMENTUM_RELEASE: "unsafe release value",
      }),
    ).toEqual({ name: "production", release: null });
  });

  it("uses Vercel scope, test mode, then local as safe runtime fallbacks", () => {
    expect(readRuntimeEnvironment({ VERCEL_ENV: "preview" }).name).toBe(
      "preview",
    );
    expect(readRuntimeEnvironment({ NODE_ENV: "test" }).name).toBe("test");
    expect(readRuntimeEnvironment({}).name).toBe("local");
  });

  it("refuses production and missing classifications for demo operators", () => {
    expect(
      requireDemoOperatorEnvironment({ MOMENTUM_ENVIRONMENT: "preview" }),
    ).toBe("preview");
    expect(() =>
      requireDemoOperatorEnvironment({ MOMENTUM_ENVIRONMENT: "production" }),
    ).toThrow("Demo operations are forbidden in production.");
    expect(() => requireDemoOperatorEnvironment({})).toThrow(
      "MOMENTUM_ENVIRONMENT is required for demo operations.",
    );
  });

  it("shows committed seed credentials only in local and test", () => {
    expect(isLocalCredentialHintVisible("local")).toBe(true);
    expect(isLocalCredentialHintVisible("test")).toBe(true);
    expect(isLocalCredentialHintVisible("preview")).toBe(false);
    expect(isLocalCredentialHintVisible("production")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/server/environment.test.ts
```

Expected: FAIL because `src/server/environment.ts` does not exist.

- [ ] **Step 3: Implement the environment helper**

Create `src/server/environment.ts`:

```ts
export const MOMENTUM_ENVIRONMENTS = [
  "local",
  "test",
  "preview",
  "production",
] as const;

export type MomentumEnvironment = (typeof MOMENTUM_ENVIRONMENTS)[number];

export interface RuntimeEnvironment {
  name: MomentumEnvironment;
  release: string | null;
}

const RELEASE_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

function isMomentumEnvironment(
  value: string | undefined,
): value is MomentumEnvironment {
  return MOMENTUM_ENVIRONMENTS.some((candidate) => candidate === value);
}

function runtimeName(env: NodeJS.ProcessEnv): MomentumEnvironment {
  if (env.MOMENTUM_ENVIRONMENT !== undefined) {
    if (!isMomentumEnvironment(env.MOMENTUM_ENVIRONMENT)) {
      throw new Error("MOMENTUM_ENVIRONMENT is not recognized.");
    }
    return env.MOMENTUM_ENVIRONMENT;
  }
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    return env.VERCEL_ENV;
  }
  if (env.NODE_ENV === "test") {
    return "test";
  }
  return "local";
}

function safeRelease(env: NodeJS.ProcessEnv): string | null {
  const candidate = env.MOMENTUM_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA;
  return candidate && RELEASE_PATTERN.test(candidate) ? candidate : null;
}

export function readRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeEnvironment {
  return { name: runtimeName(env), release: safeRelease(env) };
}

export function requireDemoOperatorEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): "local" | "test" | "preview" {
  const explicit = env.MOMENTUM_ENVIRONMENT;
  if (!explicit) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (!isMomentumEnvironment(explicit)) {
    throw new Error("MOMENTUM_ENVIRONMENT is not recognized.");
  }
  if (explicit === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  return explicit;
}

export function isLocalCredentialHintVisible(
  environment: MomentumEnvironment,
): boolean {
  return environment === "local" || environment === "test";
}
```

- [ ] **Step 4: Wire local/test environment values without exposing secrets**

In `scripts/with-local-supabase.mjs`, extend only the child `env` object:

```js
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY ?? local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY ?? local.SECRET_KEY,
  DATABASE_URL: local.DB_URL,
  MOMENTUM_ENVIRONMENT: process.env.MOMENTUM_ENVIRONMENT ?? "local",
  MOMENTUM_DEMO_EMAIL: process.env.MOMENTUM_DEMO_EMAIL ?? "demo@momentum.local",
  MOMENTUM_DEMO_PASSWORD: process.env.MOMENTUM_DEMO_PASSWORD ?? "momentum-demo",
  MOMENTUM_DEMO_TEAMMATE_EMAIL:
    process.env.MOMENTUM_DEMO_TEAMMATE_EMAIL ?? "teammate@momentum.local",
};
```

Do not print `local` or `env`. Extend `.env.example` with placeholder values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-local-supabase-publishable-key
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
MOMENTUM_ENVIRONMENT=local
MOMENTUM_RELEASE=local-development
MOMENTUM_ALLOW_TEST_CLOCK=false
MOMENTUM_JOB_SECRET=replace-with-a-long-local-development-secret
SUPABASE_SERVICE_ROLE_KEY=replace-with-operator-only-service-role-key
MOMENTUM_DEMO_EMAIL=demo@example.invalid
MOMENTUM_DEMO_PASSWORD=replace-with-runtime-demo-password
MOMENTUM_DEMO_TEAMMATE_EMAIL=teammate@example.invalid
MOMENTUM_SUPABASE_PROJECT_REF=replace-with-dedicated-demo-project-ref
MOMENTUM_DEMO_BASE_URL=http://127.0.0.1:3000
```

- [ ] **Step 5: Hide the local credential hint outside local/test and mark Playwright as test**

In `src/app/(auth)/sign-in/page.tsx`, add these imports and calculate the value as the first statement inside `SignInPage`:

```tsx
import {
  isLocalCredentialHintVisible,
  readRuntimeEnvironment,
} from "@/server/environment";

const showLocalCredentials = isLocalCredentialHintVisible(
  readRuntimeEnvironment().name,
);
```

Replace the existing unconditional seeded-credential paragraph with this complete conditional block; leave the surrounding logo, heading, form, and sign-up link unchanged:

```tsx
{
  showLocalCredentials ? (
    <p className="text-center text-xs text-slate-500">
      Seeded locally: demo@momentum.local / momentum-demo
    </p>
  ) : null;
}
```

In `playwright.config.ts`, add one exact key to `webServer.env`:

```ts
env: {
  ...process.env,
  MOMENTUM_ALLOW_TEST_CLOCK: "true",
  MOMENTUM_ENVIRONMENT: "test",
  MOMENTUM_JOB_SECRET: PLAYWRIGHT_JOB_SECRET,
},
```

- [ ] **Step 6: Run focused and foundational validation**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/server/environment.test.ts
pnpm typecheck
pnpm lint
```

Expected: environment tests PASS, strict type checking PASS, lint PASS.

- [ ] **Step 7: Commit the environment foundation**

```bash
git add .env.example playwright.config.ts scripts/with-local-supabase.mjs src/app/'(auth)'/sign-in/page.tsx src/server/environment.ts src/server/environment.test.ts vitest.config.ts
git commit -m "feat: define safe deployment environments"
```

---

### Task 2: Request IDs, structured logs, and job-secret primitives

**Files:**

- Create: `src/server/observability/request-id.ts`
- Create: `src/server/observability/request-id.test.ts`
- Create: `src/server/observability/logger.ts`
- Create: `src/server/observability/logger.test.ts`
- Create: `src/server/jobs/verify-job-secret.ts`
- Create: `src/server/jobs/verify-job-secret.test.ts`

**Interfaces:**

- Produces: `resolveRequestId(value: string | null | undefined, create?: () => string): string`
- Produces: `REQUEST_ID_HEADER` equal to `x-request-id`.
- Produces: `serializeServerEvent(input: SafeServerEvent, environment?: RuntimeEnvironment, now?: Date): string`
- Produces: `logServerEvent(input: SafeServerEvent): void`
- Produces: `verifyJobSecret(authorization: string | null, expected: string | undefined): boolean`

- [ ] **Step 1: Write failing primitive tests**

Create request-ID tests covering acceptance, replacement, length, and injection characters:

```ts
import { describe, expect, it, vi } from "vitest";

import { resolveRequestId } from "./request-id";

describe("request IDs", () => {
  it("preserves a bounded safe incoming identifier", () => {
    expect(resolveRequestId("pilot-123:abc", vi.fn())).toBe("pilot-123:abc");
  });

  it("replaces missing, oversized, whitespace, and control values", () => {
    const create = vi.fn(() => "generated-id");
    expect(resolveRequestId(null, create)).toBe("generated-id");
    expect(resolveRequestId("a".repeat(65), create)).toBe("generated-id");
    expect(resolveRequestId("unsafe value", create)).toBe("generated-id");
    expect(resolveRequestId("unsafe\nvalue", create)).toBe("generated-id");
    expect(create).toHaveBeenCalledTimes(4);
  });
});
```

Create logger tests that prove only typed fields serialize:

```ts
import { describe, expect, it } from "vitest";

import { serializeServerEvent } from "./logger";

describe("structured server logs", () => {
  it("serializes only the safe event contract", () => {
    const payload = JSON.parse(
      serializeServerEvent(
        {
          level: "info",
          event: "deadline_scan_completed",
          requestId: "request-1",
          route: "/api/jobs/deadline-nudges",
          method: "POST",
          status: 200,
          durationMs: 12,
          scannedCount: 3,
          createdCount: 1,
        },
        { name: "preview", release: "abc123" },
        new Date("2026-07-16T15:00:00.000Z"),
      ),
    );

    expect(payload).toEqual({
      timestamp: "2026-07-16T15:00:00.000Z",
      level: "info",
      event: "deadline_scan_completed",
      environment: "preview",
      release: "abc123",
      requestId: "request-1",
      route: "/api/jobs/deadline-nudges",
      method: "POST",
      status: 200,
      durationMs: 12,
      scannedCount: 3,
      createdCount: 1,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /authorization|email|password|message|stack|query/i,
    );
  });
});
```

Create job-secret tests:

```ts
import { describe, expect, it } from "vitest";

import { verifyJobSecret } from "./verify-job-secret";

describe("deadline job authorization", () => {
  it("accepts only one exact bearer secret", () => {
    expect(verifyJobSecret("Bearer pilot-secret", "pilot-secret")).toBe(true);
    expect(verifyJobSecret("Bearer wrong", "pilot-secret")).toBe(false);
    expect(verifyJobSecret("bearer pilot-secret", "pilot-secret")).toBe(false);
    expect(verifyJobSecret("Bearer pilot-secret extra", "pilot-secret")).toBe(
      false,
    );
    expect(verifyJobSecret(null, "pilot-secret")).toBe(false);
    expect(verifyJobSecret("Bearer pilot-secret", undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the three tests and verify missing-module failures**

```bash
pnpm exec vitest run --config vitest.config.ts src/server/observability/request-id.test.ts src/server/observability/logger.test.ts src/server/jobs/verify-job-secret.test.ts
```

Expected: FAIL because the three implementation modules do not exist.

- [ ] **Step 3: Implement bounded request IDs**

Create `src/server/observability/request-id.ts`:

```ts
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function resolveRequestId(
  value: string | null | undefined,
  create: () => string = crypto.randomUUID,
): string {
  return value && REQUEST_ID_PATTERN.test(value) ? value : create();
}
```

- [ ] **Step 4: Implement the allow-listed logger**

Create `src/server/observability/logger.ts` with no index signature and no arbitrary metadata parameter:

```ts
import {
  readRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/server/environment";

export interface SafeServerEvent {
  level: "info" | "error";
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  routeType?: "render" | "route" | "action" | "proxy";
  status?: number;
  durationMs?: number;
  code?: string;
  digest?: string;
  scannedCount?: number;
  createdCount?: number;
  processedCount?: number;
}

function optional<T>(value: T | undefined): T | undefined {
  return value;
}

export function serializeServerEvent(
  input: SafeServerEvent,
  environment: RuntimeEnvironment = readRuntimeEnvironment(),
  now = new Date(),
): string {
  return JSON.stringify({
    timestamp: now.toISOString(),
    level: input.level,
    event: input.event,
    environment: environment.name,
    release: environment.release ?? undefined,
    requestId: optional(input.requestId),
    route: optional(input.route),
    method: optional(input.method),
    routeType: optional(input.routeType),
    status: optional(input.status),
    durationMs: optional(input.durationMs),
    code: optional(input.code),
    digest: optional(input.digest),
    scannedCount: optional(input.scannedCount),
    createdCount: optional(input.createdCount),
    processedCount: optional(input.processedCount),
  });
}

export function logServerEvent(input: SafeServerEvent): void {
  const serialized = serializeServerEvent(input);
  if (input.level === "error") {
    console.error(serialized);
    return;
  }
  console.info(serialized);
}
```

If JSON output includes keys with `undefined` values, `JSON.stringify` omits them; tests assert the exact result.

- [ ] **Step 5: Implement timing-safe bearer verification**

Create `src/server/jobs/verify-job-secret.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

export function verifyJobSecret(
  authorization: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const supplied = authorization.slice("Bearer ".length);
  if (!supplied || supplied.includes(" ")) {
    return false;
  }
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}
```

- [ ] **Step 6: Run focused tests and type checking**

```bash
pnpm exec vitest run --config vitest.config.ts src/server/observability/request-id.test.ts src/server/observability/logger.test.ts src/server/jobs/verify-job-secret.test.ts
pnpm typecheck
```

Expected: all focused tests PASS and type checking PASS.

- [ ] **Step 7: Commit the observability primitives**

```bash
git add src/server/jobs src/server/observability
git commit -m "feat: add safe request observability primitives"
```

---

### Task 3: Correlated requests, health, safe job logs, and fallback UI

**Files:**

- Create: `src/server/health/check-health.ts`
- Create: `src/server/health/check-health.test.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/instrumentation.ts`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/app/(app)/loading.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/global-error.tsx`
- Modify: `src/lib/supabase/proxy.ts`
- Modify: `src/proxy.ts`
- Modify: `src/features/action-result.ts`
- Modify: `src/app/api/jobs/deadline-nudges/route.ts`

**Interfaces:**

- Consumes: `resolveRequestId`, `REQUEST_ID_HEADER`, `verifyJobSecret`, and `logServerEvent` from Task 2.
- Produces: `checkHealth(probe?: () => Promise<unknown>): Promise<{ ok: boolean }>`.
- Extends failed `ActionResult` with optional `reference?: string`.

- [ ] **Step 1: Write the failing health probe test**

Create `src/server/health/check-health.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "./check-health";

describe("deployment health probe", () => {
  it("reports healthy without returning probe data", async () => {
    const probe = vi.fn().mockResolvedValue([{ one: 1 }]);
    await expect(checkHealth(probe)).resolves.toEqual({ ok: true });
    expect(probe).toHaveBeenCalledOnce();
  });

  it("reports degraded without returning the database error", async () => {
    const probe = vi
      .fn()
      .mockRejectedValue(
        new Error("postgresql://secret-user:secret-password@db.internal/app"),
      );
    await expect(checkHealth(probe)).resolves.toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run the probe test and verify the missing-module failure**

```bash
pnpm exec vitest run --config vitest.config.ts src/server/health/check-health.test.ts
```

Expected: FAIL because `check-health.ts` does not exist.

- [ ] **Step 3: Implement the bounded health probe and route**

Create `src/server/health/check-health.ts`:

```ts
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
```

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";

import { readRuntimeEnvironment } from "@/server/environment";
import { checkHealth } from "@/server/health/check-health";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/server/observability/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const environment = readRuntimeEnvironment();
  const health = await checkHealth();
  const response = NextResponse.json(
    {
      status: health.ok ? "ok" : "degraded",
      environment: environment.name,
      release: environment.release,
      requestId,
    },
    { status: health.ok ? 200 : 503 },
  );
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
```

- [ ] **Step 4: Preserve request IDs through Supabase cookie refresh and proxy decisions**

Change `updateSupabaseSession` to accept cloned request headers and use them every time it constructs a response:

```ts
export async function updateSupabaseSession(
  request: NextRequest,
  requestHeaders = new Headers(request.headers),
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL and publishable key are required.");
  }

  const nextResponse = () =>
    NextResponse.next({ request: { headers: requestHeaders } });
  let response = nextResponse();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = nextResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { response, user };
}
```

In `src/proxy.ts`, calculate the ID first, pass cloned headers downstream, make health public, and attach the ID to every returned response:

```ts
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const finish = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };

  if (pathname === "/api/health" || pathname === "/api/jobs/deadline-nudges") {
    return finish(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const { response, user } = await updateSupabaseSession(
    request,
    requestHeaders,
  );
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const isPublic = pathname === "/" || isAuthPage;

  if (!user && !isPublic) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/sign-in";
    destination.searchParams.set("next", pathname);
    return finish(NextResponse.redirect(destination));
  }
  if (user && isAuthPage) {
    return finish(NextResponse.redirect(new URL("/dashboard", request.url)));
  }
  return finish(response);
}
```

- [ ] **Step 5: Replace raw action errors with a safe reference**

Extend the failure branch of `ActionResult<T>` with `reference?: string`. Replace `actionFailure` with:

```ts
export function actionFailure(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message };
  }

  const reference = crypto.randomUUID();
  logServerEvent({
    level: "error",
    event: "server_action_failed",
    requestId: reference,
    routeType: "action",
    code: "INTERNAL",
  });
  return {
    ok: false,
    code: "INTERNAL",
    message:
      "Something interrupted that update. Your saved work is still safe.",
    reference,
  };
}
```

Import `logServerEvent`; do not pass `error` into the logger.

- [ ] **Step 6: Use shared job authorization and sanitized outcome logging**

Replace the route-local secret comparison in `src/app/api/jobs/deadline-nudges/route.ts` with:

```ts
export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  if (
    !verifyJobSecret(
      request.headers.get("authorization"),
      process.env.MOMENTUM_JOB_SECRET,
    )
  ) {
    logServerEvent({
      level: "info",
      event: "deadline_scan_rejected",
      requestId,
      route: "/api/jobs/deadline-nudges",
      method: "POST",
      status: 401,
      durationMs: Math.round(performance.now() - startedAt),
    });
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const occurredAt = await requestNow();
  const receipt = await scanDeadlineNudges({ occurredAt });
  logServerEvent({
    level: "info",
    event: "deadline_scan_completed",
    requestId,
    route: "/api/jobs/deadline-nudges",
    method: "POST",
    status: 200,
    durationMs: Math.round(performance.now() - startedAt),
    scannedCount: receipt.scannedCount,
    createdCount: receipt.createdCount,
  });
  const response = NextResponse.json(receipt);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
```

- [ ] **Step 7: Register safe framework error capture**

Create `src/instrumentation.ts`:

```ts
import type { Instrumentation } from "next";

import { logServerEvent } from "@/server/observability/logger";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/server/observability/request-id";

export function register(): void {}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const requestId = resolveRequestId(
    Array.isArray(incoming) ? incoming[0] : incoming,
  );
  const digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;
  logServerEvent({
    level: "error",
    event: "request_failed",
    requestId,
    route: context.routePath,
    method: request.method,
    routeType: context.routeType,
    digest,
  });
};
```

Do not read `request.path`, raw error messages, causes, stacks, or other headers.

- [ ] **Step 8: Add accessible loading, not-found, and error states**

Create `src/components/ui/skeleton.tsx`:

```tsx
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
```

Create `src/app/(app)/loading.tsx` with a labelled busy state and deterministic skeletons:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <main
      className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"
      aria-label="Loading Momentum"
      aria-busy="true"
    >
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-72" />
    </main>
  );
}
```

Create the three fallbacks with the exact supportive copy:

```tsx
// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-violet-700">Momentum</p>
        <h1 className="mt-2 text-3xl font-bold">That page is not available</h1>
        <p className="mt-3 text-slate-600">
          It may have moved, or it may not be part of your workspace.
        </p>
        <Link
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          href="/dashboard"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
```

```tsx
// src/app/error.tsx
"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold">That step hit a snag</h1>
        <p className="mt-3 text-slate-600">
          Your saved work is still safe. Try this view again when you are ready.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-slate-500">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
```

```tsx
// src/app/global-error.tsx
"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-900">
        <main className="max-w-md text-center">
          <h1 className="text-3xl font-bold">Momentum needs a fresh start</h1>
          <p className="mt-3 text-slate-600">
            Your saved work has not been blamed or penalized.
          </p>
          <button
            className="mt-6 rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={reset}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Run unit, type, lint, and build checks**

```bash
pnpm exec vitest run --config vitest.config.ts src/server/health/check-health.test.ts src/server/observability/request-id.test.ts src/server/observability/logger.test.ts src/server/jobs/verify-job-secret.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: focused tests PASS; type checking, lint, and production build PASS.

- [ ] **Step 10: Commit operational visibility and fallbacks**

```bash
git add src/app/'(app)'/loading.tsx src/app/api/health/route.ts src/app/api/jobs/deadline-nudges/route.ts src/app/error.tsx src/app/global-error.tsx src/app/not-found.tsx src/components/ui/skeleton.tsx src/features/action-result.ts src/instrumentation.ts src/lib/supabase/proxy.ts src/proxy.ts src/server/health/check-health.ts src/server/health/check-health.test.ts
git commit -m "feat: add deployment health and safe error visibility"
```

---

### Task 4: Feedback database constraints, RLS, and idempotency

**Files:**

- Create: `supabase/migrations/202607170004_demo_pilot_readiness.sql`
- Create: `supabase/tests/database/fourth_slice.test.sql`

**Interfaces:**

- Produces PostgreSQL enum `public.feedback_category`.
- Produces append-only table `public.feedback_submissions` with unique `(user_id, idempotency_key)`.
- Produces own-row select policy and no browser insert/update/delete grants.

- [ ] **Step 1: Write the failing pgTAP contract**

Create `supabase/tests/database/fourth_slice.test.sql` with a transaction and these exact assertions:

```sql
begin;

select plan(20);

select has_type('public', 'feedback_category', 'feedback categories are typed');
select has_table('public', 'feedback_submissions', 'feedback submissions exist');
select has_column('public', 'feedback_submissions', 'workspace_id', 'feedback may carry workspace context');
select has_column('public', 'feedback_submissions', 'page_context', 'feedback may carry page context');
select has_index('public', 'feedback_submissions', 'feedback_user_idempotency_idx', 'feedback retries are unique per user');
select has_index('public', 'feedback_submissions', 'feedback_review_created_idx', 'feedback review is indexed by time');
select has_trigger('public', 'feedback_submissions', 'feedback_submissions_are_immutable', 'feedback is append-only');
select has_trigger('public', 'feedback_submissions', 'feedback_workspace_membership_is_valid', 'feedback workspace membership is constrained');

select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'DELETE'),
  'authenticated browser cannot mutate feedback'
);

select ok(
  pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'SELECT'),
  'authenticated browser may select through owner RLS'
);

select policies_are(
  'public',
  'feedback_submissions',
  array['users read their feedback'],
  'feedback has only the owner read policy'
);

select results_eq(
  $$ select enumlabel from pg_catalog.pg_enum join pg_catalog.pg_type on pg_type.oid = enumtypid where typname = 'feedback_category' order by enumsortorder $$,
  $$ values ('bug'), ('confusing'), ('motivation_feedback'), ('feature_request'), ('other') $$,
  'all five feedback categories exist'
);

select col_is_fk('public', 'feedback_submissions', 'user_id', 'feedback user is a foreign key');

select * from finish();
rollback;
```

- [ ] **Step 2: Run database tests and verify the missing-schema failure**

```bash
pnpm test:db
```

Expected: FAIL in `fourth_slice.test.sql` because feedback schema objects do not exist.

- [ ] **Step 3: Add the complete additive feedback migration**

Create `supabase/migrations/202607170004_demo_pilot_readiness.sql`:

```sql
create type public.feedback_category as enum (
  'bug',
  'confusing',
  'motivation_feedback',
  'feature_request',
  'other'
);

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  workspace_id uuid references public.workspaces (id),
  page_context text,
  category public.feedback_category not null,
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint feedback_page_context_shape check (
    page_context is null
    or (
      char_length(page_context) between 1 and 200
      and left(page_context, 1) = '/'
      and position('?' in page_context) = 0
      and position('#' in page_context) = 0
    )
  )
);

create unique index feedback_user_idempotency_idx
  on public.feedback_submissions (user_id, idempotency_key);

create index feedback_review_created_idx
  on public.feedback_submissions (created_at desc, id desc);

create index feedback_review_category_idx
  on public.feedback_submissions (category, created_at desc);

create index feedback_review_workspace_idx
  on public.feedback_submissions (workspace_id, created_at desc)
  where workspace_id is not null;

create function public.validate_feedback_workspace_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is not null and not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = new.workspace_id
      and membership.user_id = new.user_id
  ) then
    raise exception 'feedback workspace requires membership' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_feedback_workspace_membership()
from public, anon, authenticated;

create trigger feedback_workspace_membership_is_valid
before insert on public.feedback_submissions
for each row execute function public.validate_feedback_workspace_membership();

create trigger feedback_submissions_are_immutable
before update or delete on public.feedback_submissions
for each row execute function public.prevent_immutable_change();

alter table public.feedback_submissions enable row level security;

create policy "users read their feedback"
on public.feedback_submissions for select to authenticated
using (user_id = auth.uid());

grant select on public.feedback_submissions to authenticated;
revoke insert, update, delete on public.feedback_submissions from anon, authenticated;
```

- [ ] **Step 4: Add exact RLS behavior and constraint fixtures to pgTAP**

Insert this block immediately before `select * from finish()` in the pgTAP file:

```sql
insert into public.feedback_submissions (
  id, user_id, workspace_id, page_context, category, rating,
  message, idempotency_key, created_at
) values
  (
    '93000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '/dashboard',
    'confusing',
    4,
    'The focus action could be clearer.',
    '94000000-0000-4000-8000-000000000001',
    '2026-07-16T15:00:00Z'
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '/dashboard',
    'feature_request',
    5,
    'The teammate has separate feedback.',
    '94000000-0000-4000-8000-000000000002',
    '2026-07-16T15:01:00Z'
  );

insert into public.workspaces (id, name, created_by)
values (
  '22000000-0000-4000-8000-000000000001',
  'Teammate private workspace',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.workspace_memberships (workspace_id, user_id, role)
values (
  '22000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$ select user_id from public.feedback_submissions order by created_at $$,
  $$ values ('10000000-0000-4000-8000-000000000001'::uuid) $$,
  'RLS exposes only the demo user feedback'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

select results_eq(
  $$ select user_id from public.feedback_submissions order by created_at $$,
  $$ values ('10000000-0000-4000-8000-000000000002'::uuid) $$,
  'RLS exposes only the teammate feedback'
);

reset role;

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, workspace_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'confusing', 4, 'A duplicate retry row is rejected.',
      '94000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  null,
  'a user cannot reuse an idempotency key for another row'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'bug', 0, 'A valid-length feedback message.',
      '94000000-0000-4000-8000-000000000003'
    )
  $$,
  '23514',
  null,
  'rating must be between one and five'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'other', 3, 'short',
      '94000000-0000-4000-8000-000000000004'
    )
  $$,
  '23514',
  null,
  'feedback must contain at least ten trimmed characters'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, page_context, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '/dashboard?token=unsafe', 'other', 3,
      'The page context must be path-only.',
      '94000000-0000-4000-8000-000000000005'
    )
  $$,
  '23514',
  null,
  'page context cannot contain a query string'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, workspace_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '22000000-0000-4000-8000-000000000001',
      'other', 3, 'Cross-workspace feedback is rejected.',
      '94000000-0000-4000-8000-000000000006'
    )
  $$,
  '23514',
  'feedback workspace requires membership',
  'feedback workspace context requires membership'
);
```

- [ ] **Step 5: Reset and run all database tests**

```bash
pnpm supabase:reset
pnpm test:db
```

Expected: migration applies cleanly and all four pgTAP files PASS, including all prior immutable reward and notification assertions.

- [ ] **Step 6: Commit the feedback database boundary**

```bash
git add supabase/migrations/202607170004_demo_pilot_readiness.sql supabase/tests/database/fourth_slice.test.sql
git commit -m "feat: add isolated idempotent feedback storage"
```

---

### Task 5: Validated feedback service and isolation integration tests

**Files:**

- Create: `src/server/feedback/types.ts`
- Create: `src/server/feedback/submit-feedback.ts`
- Create: `src/features/feedback/schemas.ts`
- Create: `src/features/feedback/schemas.test.ts`
- Create: `tests/integration/feedback.test.ts`
- Modify: `tests/fixtures/demo.ts`

**Interfaces:**

- Produces: `FEEDBACK_CATEGORIES`, `FeedbackCategory`, `SubmitFeedbackInput`, and `FeedbackSubmissionReceipt`.
- Produces: `feedbackSubmissionSchema` with normalized output.
- Produces: `submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackSubmissionReceipt>`.
- `FeedbackSubmissionReceipt` is `{ id: string; createdAt: string; wasDuplicate: boolean }`.

- [ ] **Step 1: Define feedback types and write failing schema tests**

Create `src/server/feedback/types.ts`:

```ts
export const FEEDBACK_CATEGORIES = [
  "bug",
  "confusing",
  "motivation_feedback",
  "feature_request",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface SubmitFeedbackInput {
  actorId: string;
  workspaceId: string | null;
  pageContext: string | null;
  category: FeedbackCategory;
  rating: number;
  message: string;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface FeedbackSubmissionReceipt {
  id: string;
  createdAt: string;
  wasDuplicate: boolean;
}
```

Create `src/features/feedback/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { feedbackSubmissionSchema } from "./schemas";

const valid = {
  workspaceId: "20000000-0000-4000-8000-000000000001",
  pageContext: "/workspaces/20000000-0000-4000-8000-000000000001",
  category: "confusing",
  rating: "4",
  message: "  The focus action could be clearer.  ",
  idempotencyKey: "90000000-0000-4000-8000-000000000001",
};

describe("feedback submission schema", () => {
  it("normalizes a valid submission", () => {
    expect(feedbackSubmissionSchema.parse(valid)).toEqual({
      ...valid,
      rating: 4,
      message: "The focus action could be clearer.",
    });
  });

  it.each([
    [{ ...valid, rating: "0" }, "rating"],
    [{ ...valid, rating: "6" }, "rating"],
    [{ ...valid, message: "too short" }, "message"],
    [{ ...valid, message: "safe text\u0007unsafe" }, "message"],
    [{ ...valid, pageContext: "/dashboard?secret=value" }, "pageContext"],
    [{ ...valid, pageContext: "https://example.com/dashboard" }, "pageContext"],
    [{ ...valid, category: "performance_review" }, "category"],
  ])("rejects invalid external input for %s", (input, field) => {
    const result = feedbackSubmissionSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(
        true,
      );
    }
  });
});
```

- [ ] **Step 2: Run the schema test and verify the missing-module failure**

```bash
pnpm exec vitest run --config vitest.config.ts src/features/feedback/schemas.test.ts
```

Expected: FAIL because `src/features/feedback/schemas.ts` does not exist.

- [ ] **Step 3: Implement exact external validation**

Create `src/features/feedback/schemas.ts`:

```ts
import { z } from "zod";

import { FEEDBACK_CATEGORIES } from "@/server/feedback/types";

const FORBIDDEN_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const nullableUuid = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.uuid().nullable(),
);

const pageContext = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z
    .string()
    .trim()
    .min(1)
    .max(200)
    .startsWith("/")
    .refine((value) => !value.includes("?") && !value.includes("#"), {
      message: "Page context must not include a query or fragment.",
    })
    .nullable(),
);

export const feedbackSubmissionSchema = z
  .object({
    workspaceId: nullableUuid,
    pageContext,
    category: z.enum(FEEDBACK_CATEGORIES),
    rating: z.coerce.number().int().min(1).max(5),
    message: z
      .string()
      .trim()
      .min(10, "Share at least 10 characters.")
      .max(1000, "Keep feedback to 1,000 characters.")
      .refine((value) => !FORBIDDEN_CONTROL_CHARACTERS.test(value), {
        message: "Feedback contains unsupported characters.",
      }),
    idempotencyKey: z.uuid(),
  })
  .strict();
```

- [ ] **Step 4: Write failing service integration tests**

Extend `DEMO` in `tests/fixtures/demo.ts` with:

```ts
teammateId: "10000000-0000-4000-8000-000000000002",
teammateEmail: "teammate@momentum.local",
teammatePassword: "momentum-demo",
```

Create `tests/integration/feedback.test.ts` with four tests:

```ts
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { submitFeedback } from "@/server/feedback/submit-feedback";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { DEMO } from "../fixtures/demo";

const occurredAt = new Date("2026-07-16T15:00:00.000Z");
const base = {
  actorId: DEMO.userId,
  workspaceId: DEMO.workspaceId,
  pageContext: `/workspaces/${DEMO.workspaceId}`,
  category: "confusing" as const,
  rating: 4,
  message: "The focus action could be clearer.",
  idempotencyKey: "91000000-0000-4000-8000-000000000001",
  occurredAt,
};

describe("authenticated feedback submission", () => {
  afterAll(async () => closeDatabase());

  it("stores the authenticated actor and returns one row for identical retries", async () => {
    const first = await submitFeedback(base);
    const retry = await submitFeedback(base);
    expect(first.wasDuplicate).toBe(false);
    expect(retry).toEqual({ ...first, wasDuplicate: true });
    const [count] = await database()<Array<{ count: number }>>`
      select count(*)::integer as count
      from public.feedback_submissions
      where user_id = ${DEMO.userId}
        and idempotency_key = ${base.idempotencyKey}
    `;
    expect(count?.count).toBe(1);
  });

  it("rejects changed content for the same key", async () => {
    await expect(
      submitFeedback({
        ...base,
        message: "Changed content must not overwrite.",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("makes an outsider workspace indistinguishable from a missing workspace", async () => {
    const outsiderWorkspace = await createWorkspace({
      actorId: DEMO.teammateId,
      name: "Teammate private workspace",
    });
    for (const workspaceId of [
      outsiderWorkspace.id,
      "92000000-0000-4000-8000-000000000001",
    ]) {
      await expect(
        submitFeedback({
          ...base,
          workspaceId,
          idempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }
  });

  it("exposes only the signed-in user's rows through Supabase RLS", async () => {
    await submitFeedback({
      ...base,
      actorId: DEMO.teammateId,
      idempotencyKey: "91000000-0000-4000-8000-000000000002",
      workspaceId: DEMO.workspaceId,
      message: "The teammate has separate feedback.",
    });
    const createBrowserClient = () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
    const demoClient = createBrowserClient();
    const teammateClient = createBrowserClient();
    await demoClient.auth.signInWithPassword({
      email: DEMO.email,
      password: DEMO.password,
    });
    await teammateClient.auth.signInWithPassword({
      email: DEMO.teammateEmail,
      password: DEMO.teammatePassword,
    });
    const demoRows = await demoClient
      .from("feedback_submissions")
      .select("user_id");
    const teammateRows = await teammateClient
      .from("feedback_submissions")
      .select("user_id");
    expect(demoRows.error).toBeNull();
    expect(teammateRows.error).toBeNull();
    expect(demoRows.data).toHaveLength(1);
    expect(teammateRows.data).toHaveLength(1);
    expect(demoRows.data?.every((row) => row.user_id === DEMO.userId)).toBe(
      true,
    );
    expect(
      teammateRows.data?.every((row) => row.user_id === DEMO.teammateId),
    ).toBe(true);
  });
});
```

- [ ] **Step 5: Run the focused integration test and verify the missing-service failure**

```bash
pnpm supabase:reset
node scripts/with-local-supabase.mjs pnpm exec vitest run --config vitest.integration.config.ts tests/integration/feedback.test.ts
```

Expected: FAIL because `submit-feedback.ts` does not exist.

- [ ] **Step 6: Implement the transactional idempotent feedback service**

Create `src/server/feedback/submit-feedback.ts`. Validate typed service input defensively, verify membership before insert, insert with conflict avoidance, and compare every normalized stored field on retry:

```ts
import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackSubmissionReceipt,
  type SubmitFeedbackInput,
} from "@/server/feedback/types";

interface FeedbackRow {
  id: string;
  workspace_id: string | null;
  page_context: string | null;
  category: string;
  rating: number;
  message: string;
  created_at: Date;
}

function assertServiceInput(input: SubmitFeedbackInput): void {
  if (
    !FEEDBACK_CATEGORIES.includes(input.category) ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5 ||
    input.message.length < 10 ||
    input.message.length > 1000 ||
    Number.isNaN(input.occurredAt.getTime())
  ) {
    throw new TypeError("Valid normalized feedback is required.");
  }
}

function samePayload(row: FeedbackRow, input: SubmitFeedbackInput): boolean {
  return (
    row.workspace_id === input.workspaceId &&
    row.page_context === input.pageContext &&
    row.category === input.category &&
    row.rating === input.rating &&
    row.message === input.message
  );
}

function receipt(
  row: FeedbackRow,
  wasDuplicate: boolean,
): FeedbackSubmissionReceipt {
  return { id: row.id, createdAt: row.created_at.toISOString(), wasDuplicate };
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<FeedbackSubmissionReceipt> {
  assertServiceInput(input);
  return database().begin(async (sql) => {
    if (input.workspaceId) {
      const membership = await sql<Array<{ exists: boolean }>>`
        select exists (
          select 1 from public.workspace_memberships
          where workspace_id = ${input.workspaceId}
            and user_id = ${input.actorId}
        ) as exists
      `;
      if (!membership[0]?.exists) {
        throw new AppError("NOT_FOUND", "Workspace not found.");
      }
    }

    const inserted = await sql<FeedbackRow[]>`
      insert into public.feedback_submissions (
        user_id, workspace_id, page_context, category, rating,
        message, idempotency_key, created_at
      ) values (
        ${input.actorId}, ${input.workspaceId}, ${input.pageContext},
        ${input.category}, ${input.rating}, ${input.message},
        ${input.idempotencyKey}, ${input.occurredAt}
      )
      on conflict (user_id, idempotency_key) do nothing
      returning id, workspace_id, page_context, category::text,
        rating::integer, message, created_at
    `;
    if (inserted[0]) {
      return receipt(inserted[0], false);
    }

    const existing = await sql<FeedbackRow[]>`
      select id, workspace_id, page_context, category::text,
        rating::integer, message, created_at
      from public.feedback_submissions
      where user_id = ${input.actorId}
        and idempotency_key = ${input.idempotencyKey}
    `;
    if (existing[0] && samePayload(existing[0], input)) {
      return receipt(existing[0], true);
    }
    throw new AppError(
      "CONFLICT",
      "That feedback retry did not match the original submission.",
    );
  });
}
```

- [ ] **Step 7: Run schema and integration tests**

```bash
pnpm exec vitest run --config vitest.config.ts src/features/feedback/schemas.test.ts
pnpm supabase:reset
node scripts/with-local-supabase.mjs pnpm exec vitest run --config vitest.integration.config.ts tests/integration/feedback.test.ts
pnpm typecheck
```

Expected: schema tests PASS, four feedback integration tests PASS, type checking PASS.

- [ ] **Step 8: Commit feedback validation and service**

```bash
git add src/features/feedback/schemas.ts src/features/feedback/schemas.test.ts src/server/feedback tests/fixtures/demo.ts tests/integration/feedback.test.ts
git commit -m "feat: submit authenticated feedback exactly once"
```

---

### Task 6: Accessible authenticated feedback dialog

**Files:**

- Create: `src/features/feedback/actions.ts`
- Create: `src/features/feedback/feedback-dialog.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**

- Consumes: `feedbackSubmissionSchema` and `submitFeedback` from Task 5.
- Produces: `submitFeedbackAction(previousState, formData): Promise<FeedbackActionState>`.
- Produces: `FeedbackDialog` with pathname/workspace context derived from the authenticated route.

- [ ] **Step 1: Implement the authenticated Server Action**

Create `src/features/feedback/actions.ts`:

```ts
"use server";

import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { feedbackSubmissionSchema } from "@/features/feedback/schemas";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { submitFeedback } from "@/server/feedback/submit-feedback";
import type { FeedbackSubmissionReceipt } from "@/server/feedback/types";

export type FeedbackActionState =
  ActionResult<FeedbackSubmissionReceipt> | null;

export async function submitFeedbackAction(
  _previousState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const parsed = feedbackSubmissionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    pageContext: formData.get("pageContext"),
    category: formData.get("category"),
    rating: formData.get("rating"),
    message: formData.get("message"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the highlighted feedback, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
    const result = await submitFeedback({
      actorId: user.id,
      ...parsed.data,
      occurredAt,
    });
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error);
  }
}
```

- [ ] **Step 2: Build the dialog with retry-stable idempotency**

Create `src/features/feedback/feedback-dialog.tsx` with the complete accessible form and retry-stable idempotency state:

```tsx
"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  submitFeedbackAction,
  type FeedbackActionState,
} from "@/features/feedback/actions";

function workspaceFromPath(pathname: string): string {
  const match = pathname.match(
    /^\/workspaces\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i,
  );
  return match?.[1] ?? "";
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  return errors?.[0] ? (
    <p id={id} className="text-sm text-rose-700">
      {errors[0]}
    </p>
  ) : null;
}

export function FeedbackDialog() {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [state, action, pending] = useActionState<
    FeedbackActionState,
    FormData
  >(submitFeedbackAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Feedback">
          <MessageSquare className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            Feedback
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Help shape Momentum</DialogTitle>
          <DialogDescription>
            Share what helped or what made the next step harder to see.
          </DialogDescription>
        </DialogHeader>
        <form action={action} ref={formRef} className="mt-5 space-y-4">
          <input
            type="hidden"
            name="workspaceId"
            value={workspaceFromPath(pathname)}
          />
          <input type="hidden" name="pageContext" value={pathname} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="space-y-2">
            <Label htmlFor="feedback-category">
              What kind of feedback is this?
            </Label>
            <Select
              id="feedback-category"
              name="category"
              defaultValue="confusing"
              disabled={pending}
              aria-invalid={fieldErrors?.category ? true : undefined}
              aria-describedby={
                fieldErrors?.category ? "feedback-category-error" : undefined
              }
            >
              <option value="bug">Bug</option>
              <option value="confusing">Something is confusing</option>
              <option value="motivation_feedback">Motivation experience</option>
              <option value="feature_request">Feature request</option>
              <option value="other">Other</option>
            </Select>
            <FieldError
              id="feedback-category-error"
              errors={fieldErrors?.category}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-rating">Overall experience</Label>
            <Select
              id="feedback-rating"
              name="rating"
              defaultValue="4"
              disabled={pending}
              aria-invalid={fieldErrors?.rating ? true : undefined}
              aria-describedby={
                fieldErrors?.rating ? "feedback-rating-error" : undefined
              }
            >
              <option value="1">1 — Needs attention</option>
              <option value="2">2</option>
              <option value="3">3 — Okay</option>
              <option value="4">4</option>
              <option value="5">5 — Great</option>
            </Select>
            <FieldError
              id="feedback-rating-error"
              errors={fieldErrors?.rating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-message">What would help?</Label>
            <textarea
              id="feedback-message"
              name="message"
              minLength={10}
              maxLength={1000}
              required
              disabled={pending}
              aria-invalid={fieldErrors?.message ? true : undefined}
              aria-describedby={`feedback-message-help${
                fieldErrors?.message ? " feedback-message-error" : ""
              }`}
              className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            />
            <p id="feedback-message-help" className="text-xs text-slate-500">
              10–1,000 characters. Page context: {pathname}
            </p>
            <FieldError
              id="feedback-message-error"
              errors={fieldErrors?.message}
            />
          </div>
          {state ? (
            <p
              role={state.ok ? "status" : "alert"}
              className={
                state.ok
                  ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
                  : "rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
              }
            >
              {state.ok ? "Thanks — your feedback is saved." : state.message}
              {!state.ok && state.reference
                ? ` Reference: ${state.reference}`
                : ""}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Sending feedback…" : "Send feedback"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add feedback to the authenticated shell**

Import `FeedbackDialog` in `src/app/(app)/layout.tsx` and place `<FeedbackDialog />` between Settings and `NotificationBell`. Keep the existing navigation label and all auth loading unchanged.

- [ ] **Step 4: Run static validation and the feedback integration test**

```bash
pnpm typecheck
pnpm lint
pnpm exec vitest run --config vitest.config.ts src/features/feedback/schemas.test.ts
pnpm supabase:reset
node scripts/with-local-supabase.mjs pnpm exec vitest run --config vitest.integration.config.ts tests/integration/feedback.test.ts
```

Expected: all commands PASS.

- [ ] **Step 5: Commit the authenticated feedback experience**

```bash
git add src/app/'(app)'/layout.tsx src/features/feedback/actions.ts src/features/feedback/feedback-dialog.tsx
git commit -m "feat: add authenticated pilot feedback dialog"
```

---

### Task 7: Reproducible demo fixture and local seeded parity

**Files:**

- Create: `scripts/lib/demo-fixture.mjs`
- Create: `scripts/provision-demo.mjs`
- Create: `tests/demo/demo-reproducibility.mjs`
- Modify: `supabase/seed.sql`
- Modify: `tests/fixtures/demo.ts`
- Modify: `tests/integration/deadline-nudges.test.ts`
- Modify: `tests/e2e/motivation-experience.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `DEMO_FIXTURE_IDS`, `demoFixtureDates(now)`, `provisionDemoData(input)`, and `readDemoFixtureSummary(input)` from `scripts/lib/demo-fixture.mjs`.
- Produces: `provisionDemo(options?): Promise<DemoFixtureSummary>` from `scripts/provision-demo.mjs`.
- `DemoFixtureSummary` contains only counts/statuses, work dates, expected points/streak/progress, and stable application IDs; it contains no email, password, name, task title, or notification body.

- [ ] **Step 1: Write the failing reproducibility test**

Create `tests/demo/demo-reproducibility.mjs`:

```js
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { provisionDemo } from "../../scripts/provision-demo.mjs";

function resetLocalWithoutSeed() {
  const result = spawnSync(
    "pnpm",
    ["exec", "supabase", "db", "reset", "--local", "--no-seed"],
    { stdio: "inherit", shell: false },
  );
  assert.equal(result.status, 0, "local Supabase reset must succeed");
}

const summaries = [];
for (let attempt = 0; attempt < 2; attempt += 1) {
  resetLocalWithoutSeed();
  summaries.push(await provisionDemo({ allowLocal: true }));
}

assert.deepEqual(summaries[1], summaries[0]);
assert.deepEqual(summaries[0], {
  userCount: 2,
  membershipRoles: ["member", "owner"],
  workspaceCount: 1,
  projectCount: 1,
  taskStatuses: { todo: 1, inProgress: 1, done: 2 },
  currentStreak: 2,
  longestStreak: 2,
  hasCurrentFocus: false,
  initialPoints: 41,
  achievementCodes: ["first_step", "focused_finish"],
  notificationCount: 1,
  dueSoonCount: 1,
  expectedCompletionPoints: 52,
  expectedPostCompletionStreak: 3,
  expectedProgressPercent: 75,
});
```

- [ ] **Step 2: Add the direct test script and verify the missing-module failure**

Add to `package.json`:

```json
"test:demo": "node scripts/with-local-supabase.mjs node tests/demo/demo-reproducibility.mjs"
```

Run:

```bash
pnpm test:demo
```

Expected: FAIL because `scripts/provision-demo.mjs` does not exist.

- [ ] **Step 3: Define stable fixture IDs and workday-aware dates**

Create `scripts/lib/demo-fixture.mjs` with these stable application IDs:

```js
export const DEMO_FIXTURE_IDS = Object.freeze({
  workspace: "20000000-0000-4000-8000-000000000001",
  project: "30000000-0000-4000-8000-000000000001",
  candidateTask: "40000000-0000-4000-8000-000000000001",
  dueSoonTask: "40000000-0000-4000-8000-000000000002",
  firstHistoryTask: "40000000-0000-4000-8000-000000000003",
  secondHistoryTask: "40000000-0000-4000-8000-000000000004",
  firstFocus: "50000000-0000-4000-8000-000000000001",
  secondFocus: "50000000-0000-4000-8000-000000000002",
  firstCompletion: "60000000-0000-4000-8000-000000000001",
  secondCompletion: "60000000-0000-4000-8000-000000000002",
  firstLedger: "70000000-0000-4000-8000-000000000001",
  secondLedger: "70000000-0000-4000-8000-000000000002",
  streakLedger: "70000000-0000-4000-8000-000000000003",
  firstStepGrant: "80000000-0000-4000-8000-000000000001",
  focusedFinishGrant: "80000000-0000-4000-8000-000000000002",
  representativeNotification: "90000000-0000-4000-8000-000000000001",
});
```

Implement `demoFixtureDates(now)` with this complete workday logic:

```js
const DEMO_TIMEZONE = "America/New_York";

function localDateParts(instant) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function isWeekend(cursor) {
  return cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6;
}

function previousWorkday(cursor) {
  const result = new Date(cursor);
  do {
    result.setUTCDate(result.getUTCDate() - 1);
  } while (isWeekend(result));
  return result;
}

function workDate(cursor) {
  return cursor.toISOString().slice(0, 10);
}

export function demoFixtureDates(now = new Date()) {
  const parts = localDateParts(now);
  const current = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 17),
  );
  while (isWeekend(current)) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  const second = previousWorkday(current);
  const first = previousWorkday(second);
  const demoNow = new Date(`${workDate(current)}T17:00:00.000Z`);
  const firstCompletedAt = new Date(`${workDate(first)}T20:00:00.000Z`);
  const secondCompletedAt = new Date(`${workDate(second)}T20:00:00.000Z`);
  return {
    currentWorkDate: workDate(current),
    firstWorkDate: workDate(first),
    secondWorkDate: workDate(second),
    demoNow,
    firstCompletedAt,
    secondCompletedAt,
    candidateDueAt: new Date(demoNow.getTime() + 10 * 24 * 60 * 60 * 1000),
    dueSoonAt: new Date(demoNow.getTime() + 12 * 60 * 60 * 1000),
  };
}
```

- [ ] **Step 4: Implement transactional application fixture inserts**

In `provisionDemoData({ databaseUrl, ownerId, teammateId, now })`, open `postgres(databaseUrl, { max: 1, prepare: false })`, begin one transaction, and fail with `Demo fixture already exists; reset the dedicated demo database first.` if the stable workspace ID exists.

Insert these exact semantic rows:

```js
const taskRows = [
  {
    id: DEMO_FIXTURE_IDS.candidateTask,
    title: "Prepare launch brief",
    assigneeId: ownerId,
    status: "todo",
    effort: "medium",
    dueAt: dates.candidateDueAt,
  },
  {
    id: DEMO_FIXTURE_IDS.dueSoonTask,
    title: "Review onboarding copy",
    assigneeId: ownerId,
    status: "in_progress",
    effort: "small",
    dueAt: dates.dueSoonAt,
  },
  {
    id: DEMO_FIXTURE_IDS.firstHistoryTask,
    title: "Outline launch goals",
    assigneeId: ownerId,
    status: "done",
    effort: "small",
    dueAt: null,
    firstCompletedAt: dates.firstCompletedAt,
  },
  {
    id: DEMO_FIXTURE_IDS.secondHistoryTask,
    title: "Collect customer quotes",
    assigneeId: ownerId,
    status: "done",
    effort: "small",
    dueAt: null,
    firstCompletedAt: dates.secondCompletedAt,
  },
];
```

Define the remaining rows explicitly before inserting them with parameterized postgres.js template calls:

```js
const focusRows = [
  {
    id: DEMO_FIXTURE_IDS.firstFocus,
    taskId: DEMO_FIXTURE_IDS.firstHistoryTask,
    workDate: dates.firstWorkDate,
    selectedAt: new Date(dates.firstCompletedAt.getTime() - 3 * 60 * 60 * 1000),
    completedAt: dates.firstCompletedAt,
  },
  {
    id: DEMO_FIXTURE_IDS.secondFocus,
    taskId: DEMO_FIXTURE_IDS.secondHistoryTask,
    workDate: dates.secondWorkDate,
    selectedAt: new Date(
      dates.secondCompletedAt.getTime() - 3 * 60 * 60 * 1000,
    ),
    completedAt: dates.secondCompletedAt,
  },
];

const completionRows = [
  {
    id: DEMO_FIXTURE_IDS.firstCompletion,
    taskId: DEMO_FIXTURE_IDS.firstHistoryTask,
    focusId: DEMO_FIXTURE_IDS.firstFocus,
    completedAt: dates.firstCompletedAt,
    basePoints: 20,
    timingMultiplier: 1,
    streakMultiplier: 1,
    preStreak: 0,
    postStreak: 1,
    finalPoints: 20,
    taskTitle: "Outline launch goals",
  },
  {
    id: DEMO_FIXTURE_IDS.secondCompletion,
    taskId: DEMO_FIXTURE_IDS.secondHistoryTask,
    focusId: DEMO_FIXTURE_IDS.secondFocus,
    completedAt: dates.secondCompletedAt,
    basePoints: 20,
    timingMultiplier: 1,
    streakMultiplier: 1.04,
    preStreak: 1,
    postStreak: 2,
    finalPoints: 21,
    taskTitle: "Collect customer quotes",
  },
];

const ledgerRows = [
  {
    id: DEMO_FIXTURE_IDS.firstLedger,
    completionId: DEMO_FIXTURE_IDS.firstCompletion,
    kind: "base",
    points: 20,
    createdAt: dates.firstCompletedAt,
  },
  {
    id: DEMO_FIXTURE_IDS.secondLedger,
    completionId: DEMO_FIXTURE_IDS.secondCompletion,
    kind: "base",
    points: 20,
    createdAt: dates.secondCompletedAt,
  },
  {
    id: DEMO_FIXTURE_IDS.streakLedger,
    completionId: DEMO_FIXTURE_IDS.secondCompletion,
    kind: "streak_bonus",
    points: 1,
    createdAt: dates.secondCompletedAt,
  },
];

const grantRows = [
  {
    id: DEMO_FIXTURE_IDS.firstStepGrant,
    code: "first_step",
  },
  {
    id: DEMO_FIXTURE_IDS.focusedFinishGrant,
    code: "focused_finish",
  },
];
```

Insert/update the two profiles, insert default motivation preferences, owner/member memberships, the Launch Week project, the four task rows, both Focus rows, streak `(2, 2, secondWorkDate)`, both completion rows with message event `focus_task_completed`, tone `friendly`, template `seed-history-v1`, title `Focus task complete`, body `A focused step moved the project forward.`, all ledger/grant rows, and one read `focus_task_completed` notification sourced from the second completion. Use this complete task insert loop; use the same direct-column pattern for each declared array:

```js
for (const task of taskRows) {
  await sql`
    insert into public.tasks (
      id, project_id, title, description, assignee_id, status,
      effort, due_at, first_completed_at, created_by
    ) values (
      ${task.id}, ${DEMO_FIXTURE_IDS.project}, ${task.title}, null,
      ${task.assigneeId}, ${task.status}, ${task.effort},
      ${task.dueAt}, ${task.firstCompletedAt ?? null}, ${ownerId}
    )
  `;
}
```

Insert no Focus selection for `dates.currentWorkDate` and no notification for `DEMO_FIXTURE_IDS.dueSoonTask`.

Implement `readDemoFixtureSummary({ databaseUrl, ownerId, teammateId, now })` with the following aggregate query and exact mapping; close the postgres client in `finally`:

```js
const dates = demoFixtureDates(now);
const [row] = await sql`
  select
    (select count(*)::integer from public.profiles where id in (${ownerId}, ${teammateId})) as user_count,
    (select array_agg(role::text order by role::text) from public.workspace_memberships where workspace_id = ${DEMO_FIXTURE_IDS.workspace}) as membership_roles,
    (select count(*)::integer from public.workspaces where id = ${DEMO_FIXTURE_IDS.workspace}) as workspace_count,
    (select count(*)::integer from public.projects where id = ${DEMO_FIXTURE_IDS.project}) as project_count,
    (select count(*)::integer from public.tasks where project_id = ${DEMO_FIXTURE_IDS.project} and status = 'todo') as todo_count,
    (select count(*)::integer from public.tasks where project_id = ${DEMO_FIXTURE_IDS.project} and status = 'in_progress') as in_progress_count,
    (select count(*)::integer from public.tasks where project_id = ${DEMO_FIXTURE_IDS.project} and status = 'done') as done_count,
    (select current_count from public.focus_streaks where user_id = ${ownerId}) as current_streak,
    (select longest_count from public.focus_streaks where user_id = ${ownerId}) as longest_streak,
    exists(select 1 from public.focus_selections where user_id = ${ownerId} and work_date = ${dates.currentWorkDate}) as has_current_focus,
    (select coalesce(sum(points), 0)::integer from public.point_ledger where user_id = ${ownerId}) as initial_points,
    (select array_agg(achievement_code order by achievement_code) from public.achievement_grants where user_id = ${ownerId}) as achievement_codes,
    (select count(*)::integer from public.notifications where user_id = ${ownerId}) as notification_count,
    (select count(*)::integer from public.tasks where assignee_id = ${ownerId} and status <> 'done' and due_at > ${dates.demoNow} and due_at <= ${dates.demoNow} + interval '24 hours') as due_soon_count
`;

return {
  userCount: row.user_count,
  membershipRoles: row.membership_roles,
  workspaceCount: row.workspace_count,
  projectCount: row.project_count,
  taskStatuses: {
    todo: row.todo_count,
    inProgress: row.in_progress_count,
    done: row.done_count,
  },
  currentStreak: row.current_streak,
  longestStreak: row.longest_streak,
  hasCurrentFocus: row.has_current_focus,
  initialPoints: row.initial_points,
  achievementCodes: row.achievement_codes,
  notificationCount: row.notification_count,
  dueSoonCount: row.due_soon_count,
  expectedCompletionPoints: 52,
  expectedPostCompletionStreak: 3,
  expectedProgressPercent: 75,
};
```

- [ ] **Step 5: Implement hosted/local auth provisioning without logging credentials**

Create `scripts/provision-demo.mjs` using `createClient` from `@supabase/supabase-js`, `randomBytes(32).toString("base64url")` for the teammate password, and the exported fixture builder. Export `provisionDemo({ allowLocal = false } = {})` and execute it only when `import.meta.url === pathToFileURL(process.argv[1]).href`.

The environment guard and required-variable read are exact:

```js
export function requireDemoEnvironment(env, { allowLocal }) {
  const value = env.MOMENTUM_ENVIRONMENT;
  if (!value) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (value === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  if (value === "local" && allowLocal) {
    return value;
  }
  if (value !== "preview" && value !== "test") {
    throw new Error("Demo provisioning requires preview or test.");
  }
  return value;
}

requireDemoEnvironment(process.env, { allowLocal });
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "MOMENTUM_DEMO_EMAIL",
  "MOMENTUM_DEMO_PASSWORD",
  "MOMENTUM_DEMO_TEAMMATE_EMAIL",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required.`);
  }
}
```

For each missing variable, throw one safe error naming only the variable. Find users by paginating `auth.admin.listUsers`; create missing users with `email_confirm: true` and metadata `{ display_name, timezone }`; update an existing demo owner's password/metadata and existing teammate metadata. Never print emails or passwords. Call `provisionDemoData`, print only the safe summary JSON, and return it.

Because `.mjs` cannot import the TypeScript environment module directly, define the same three allowed operator values in the script and test them through the script's exported `requireDemoEnvironment`; keep production refusal text identical to Task 1.

Use these exact auth helpers and entry point around the guard:

```js
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { provisionDemoData } from "./lib/demo-fixture.mjs";

function requiredValue(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error("Could not inspect demo auth users.");
    }
    const match = data.users.find((user) => user.email === email);
    if (match) {
      return match;
    }
    if (data.users.length < 200) {
      return null;
    }
  }
}

async function ensureUser(admin, input) {
  const existing = await findUserByEmail(admin, input.email);
  if (existing) {
    const { data, error } = await admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: input.metadata,
    });
    if (error || !data.user) {
      throw new Error("Could not update a demo auth user.");
    }
    return data.user;
  }
  const { data, error } = await admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.metadata,
  });
  if (error || !data.user) {
    throw new Error("Could not create a demo auth user.");
  }
  return data.user;
}

export async function provisionDemo({ allowLocal = false } = {}) {
  requireDemoEnvironment(process.env, { allowLocal });
  for (const name of required) {
    requiredValue(name);
  }
  const client = createClient(
    requiredValue("NEXT_PUBLIC_SUPABASE_URL"),
    requiredValue("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const metadata = (displayName) => ({
    display_name: displayName,
    timezone: "America/New_York",
  });
  const owner = await ensureUser(client.auth.admin, {
    email: requiredValue("MOMENTUM_DEMO_EMAIL"),
    password: requiredValue("MOMENTUM_DEMO_PASSWORD"),
    metadata: metadata("Maya Chen"),
  });
  const teammate = await ensureUser(client.auth.admin, {
    email: requiredValue("MOMENTUM_DEMO_TEAMMATE_EMAIL"),
    password: randomBytes(32).toString("base64url"),
    metadata: metadata("Alex Rivera"),
  });
  const summary = await provisionDemoData({
    databaseUrl: requiredValue("DATABASE_URL"),
    ownerId: owner.id,
    teammateId: teammate.id,
    now: new Date(),
  });
  console.info(JSON.stringify(summary));
  return summary;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const cliArguments = process.argv.slice(2);
  const allowedArguments = cliArguments.every(
    (value) => value === "--allow-local",
  );
  if (!allowedArguments || cliArguments.length > 1) {
    throw new Error("Only --allow-local is supported.");
  }
  await provisionDemo({ allowLocal: cliArguments[0] === "--allow-local" });
}
```

- [ ] **Step 6: Bring the committed local seed to semantic parity**

Modify `supabase/seed.sql` without changing the number of tasks:

- rename `in_progress_task_id` conceptually to the due-soon task ID;
- assign that task to `demo_user_id` instead of the teammate;
- set its deadline to `demo_now + interval '12 hours'`;
- retain the candidate at Medium, To Do, due ten days later;
- retain two prior workday Focus completions, 41 ledger points, streak 2, and no current Focus selection;
- insert one read representative completion notification after ledger rows:

```sql
insert into public.notifications (
  id, user_id, workspace_id, project_id, task_id, event_type,
  source_id, tone, template_key, title, body, read_at, created_at
) values (
  '90000000-0000-4000-8000-000000000001',
  demo_user_id,
  workspace_id,
  project_id,
  second_history_task_id,
  'focus_task_completed',
  second_completion_id,
  'friendly',
  'seed-history-v1',
  'Focus task complete',
  'A focused step moved the project forward.',
  second_completed_at,
  second_completed_at
);
```

- [ ] **Step 7: Update scanner aggregate expectations without weakening identity assertions**

In `tests/integration/deadline-nudges.test.ts`, update only global receipt expectations because the seed now contributes one eligible task:

```ts
expect(first).toEqual({ scannedCount: 3, createdCount: 3 });
expect(retry).toEqual({ scannedCount: 3, createdCount: 0 });
expect(await scanDeadlineNudges({ occurredAt })).toEqual({
  scannedCount: 3,
  createdCount: 1,
});
expect(await scanDeadlineNudges({ occurredAt })).toEqual({
  scannedCount: 2,
  createdCount: 0,
});
```

Keep all per-user notification identity, preference, status, and non-reward-mutation assertions unchanged. In `tests/e2e/motivation-experience.spec.ts`, update the first/retry route receipts to `{ scannedCount: 2, createdCount: 2 }` and `{ scannedCount: 2, createdCount: 0 }`; keep the signed-in user's single visible nudge assertion unchanged.

- [ ] **Step 8: Run reproducibility and regression suites**

```bash
pnpm test:demo
pnpm test:db
pnpm test:integration
```

Expected: two canonical demo summaries are equal; all pgTAP and integration tests PASS; the exactly-once completion remains 52 points and 75% progress.

- [ ] **Step 9: Commit the reproducible demo fixture**

```bash
git add package.json scripts/lib/demo-fixture.mjs scripts/provision-demo.mjs supabase/seed.sql tests/demo/demo-reproducibility.mjs tests/e2e/motivation-experience.spec.ts tests/fixtures/demo.ts tests/integration/deadline-nudges.test.ts
git commit -m "feat: add reproducible guided demo data"
```

---

### Task 8: Guarded demo reset and manual nudge operator commands

**Files:**

- Create: `scripts/reset-demo.mjs`
- Create: `scripts/trigger-deadline-nudges.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `provisionDemo` from Task 7.
- Produces operator commands `pnpm demo:provision`, `pnpm demo:reset`, and `pnpm demo:nudges`.
- `demo:reset` is interactive, linked-project-only, and refuses production.

- [ ] **Step 1: Implement the destructive reset guard before invoking Supabase**

Create `scripts/reset-demo.mjs` with the complete guard, confirmation, reset, and verification flow:

```js
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { provisionDemo } from "./provision-demo.mjs";

async function main() {
  const environment = process.env.MOMENTUM_ENVIRONMENT;
  if (!environment) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (environment === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  if (environment !== "preview") {
    throw new Error("Linked demo reset requires MOMENTUM_ENVIRONMENT=preview.");
  }
  const expectedRef = process.env.MOMENTUM_SUPABASE_PROJECT_REF;
  if (!expectedRef) {
    throw new Error("MOMENTUM_SUPABASE_PROJECT_REF is required.");
  }
  const linkedRef = (
    await readFile(
      new URL("../supabase/.temp/project-ref", import.meta.url),
      "utf8",
    )
  ).trim();
  if (linkedRef !== expectedRef) {
    throw new Error(
      "Linked Supabase project does not match the confirmed demo project.",
    );
  }

  const prompt = createInterface({ input, output });
  let confirmation;
  try {
    confirmation = await prompt.question(
      `Type RESET ${expectedRef} to continue: `,
    );
  } finally {
    prompt.close();
  }
  if (confirmation !== `RESET ${expectedRef}`) {
    console.info("Demo reset cancelled; no database command ran.");
    return;
  }

  const reset = spawnSync(
    "pnpm",
    ["exec", "supabase", "db", "reset", "--linked", "--no-seed"],
    { stdio: "inherit", shell: false },
  );
  if (reset.status !== 0) {
    throw new Error("Linked demo reset failed before provisioning.");
  }

  await provisionDemo();
  console.info(`Demo reset verified for project ${expectedRef}.`);
}

await main();
```

Do not pass service-role, database, demo-password, or job secrets as command arguments.

- [ ] **Step 2: Implement the server-side nudge trigger**

Create `scripts/trigger-deadline-nudges.mjs`:

```js
const baseUrl = process.env.MOMENTUM_DEMO_BASE_URL;
const secret = process.env.MOMENTUM_JOB_SECRET;
if (!baseUrl) {
  throw new Error("MOMENTUM_DEMO_BASE_URL is required.");
}
if (!secret) {
  throw new Error("MOMENTUM_JOB_SECRET is required.");
}

const response = await fetch(new URL("/api/jobs/deadline-nudges", baseUrl), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const requestId = response.headers.get("x-request-id");
const body = await response.json();
if (!response.ok) {
  throw new Error(
    `Deadline scan failed with status ${response.status}; request ${requestId ?? "unavailable"}.`,
  );
}
console.info(
  JSON.stringify({
    requestId,
    scannedCount: body.scannedCount,
    createdCount: body.createdCount,
  }),
);
```

The script must never print `secret`, response headers, task data, or notification content.

- [ ] **Step 3: Add operator package commands**

Add:

```json
"demo:provision": "node scripts/provision-demo.mjs",
"demo:reset": "node scripts/reset-demo.mjs",
"demo:nudges": "node scripts/trigger-deadline-nudges.mjs"
```

- [ ] **Step 4: Verify refusal paths without destructive execution**

Run these with placeholder-free local process values only:

```bash
MOMENTUM_ENVIRONMENT=production node scripts/reset-demo.mjs
MOMENTUM_ENVIRONMENT=preview node scripts/reset-demo.mjs
node scripts/trigger-deadline-nudges.mjs
```

Expected respectively: production refusal before file/CLI access; missing project-ref refusal; missing base-URL refusal. Do not run `demo:reset` against any linked project during this task.

- [ ] **Step 5: Run static checks and commit operator tooling**

```bash
pnpm lint
pnpm typecheck
git add package.json scripts/reset-demo.mjs scripts/trigger-deadline-nudges.mjs
git commit -m "feat: add guarded demo operator commands"
```

---

### Task 9: Loud finite celebration and success-only start pulse

**Files:**

- Create: `src/features/tasks/celebration-preset.ts`
- Create: `src/features/tasks/celebration-preset.test.ts`
- Create: `src/features/tasks/completion-celebration-effect.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/server/types.ts`
- Modify: `src/server/projects/get-project-board.ts`
- Modify: `src/features/tasks/kanban-board.tsx`
- Modify: `src/features/tasks/task-card.tsx`
- Modify: `src/features/tasks/celebration-dialog.tsx`
- Modify: `src/features/settings/motivation-settings-form.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**

- Produces: `getCelebrationPreset(input): CelebrationPreset`.
- `CelebrationPreset` is `{ enabled: boolean; particleCount: number; emojiCount: number; spread: number; scalar: number }`.
- Produces: `CompletionCelebrationEffect({ completionId, enabled })` with `data-celebration-state` values `idle`, `fired`, `seen`, `reduced`, `disabled`, or `failed`.
- Extends `ProjectBoardView` with `celebrationAnimationEnabled: boolean`.

- [ ] **Step 1: Write failing deterministic preset tests**

Create `src/features/tasks/celebration-preset.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the preset test and verify the missing-module failure**

```bash
pnpm exec vitest run --config vitest.config.ts src/features/tasks/celebration-preset.test.ts
```

Expected: FAIL because `celebration-preset.ts` does not exist.

- [ ] **Step 3: Implement presets and install the documented dependency**

Create `src/features/tasks/celebration-preset.ts`:

```ts
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
```

Install exact versions:

```bash
pnpm add canvas-confetti@1.9.4
pnpm add -D @types/canvas-confetti@1.9.0
```

- [ ] **Step 4: Implement finite burst, emoji waves, replay suppression, and cleanup**

Create `src/features/tasks/completion-celebration-effect.tsx` with the complete finite effect:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { getCelebrationPreset } from "@/features/tasks/celebration-preset";

const MOMENTUM_COLORS = ["#7c3aed", "#8b5cf6", "#f59e0b", "#10b981", "#38bdf8"];

type CelebrationState =
  "idle" | "fired" | "seen" | "reduced" | "disabled" | "failed";

export function CompletionCelebrationEffect({
  completionId,
  enabled,
}: {
  completionId: string;
  enabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<CelebrationState>("idle");

  useEffect(() => {
    const timers: number[] = [];
    let cancelled = false;
    let reset: (() => void) | undefined;

    if (!enabled) {
      setState("disabled");
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      setState("reduced");
      return;
    }

    const storageKey = `momentum:celebrated:${completionId}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) {
        setState("seen");
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage availability must never block persisted celebration content.
    }

    async function run() {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          setState("failed");
          return;
        }
        const { default: confetti } = await import("canvas-confetti");
        if (cancelled) {
          return;
        }
        const preset = getCelebrationPreset({
          enabled,
          reducedMotion: false,
          viewportWidth: window.innerWidth,
        });
        const fire = confetti.create(canvas, {
          resize: true,
          useWorker: false,
        });
        reset = () => fire.reset();

        fire({
          particleCount: preset.particleCount,
          spread: preset.spread,
          startVelocity: 52,
          origin: { x: 0.5, y: 0.58 },
          scalar: preset.scalar,
          colors: MOMENTUM_COLORS,
          zIndex: 55,
          disableForReducedMotion: true,
        });

        const emojiShapes = ["🎉", "✨", "⚡"].map((text) =>
          confetti.shapeFromText({ text, scalar: 2 }),
        );
        const origins = [0.2, 0.5, 0.8];
        for (const [index, shape] of emojiShapes.entries()) {
          const timer = window.setTimeout(
            () => {
              if (!cancelled) {
                fire({
                  particleCount: Math.ceil(preset.emojiCount / 3),
                  shapes: [shape],
                  angle: 90,
                  spread: 46,
                  startVelocity: 38,
                  gravity: 0.72,
                  ticks: 180,
                  origin: { x: origins[index] ?? 0.5, y: 0.88 },
                  scalar: preset.scalar * 1.35,
                  zIndex: 55,
                  disableForReducedMotion: true,
                });
              }
            },
            140 + index * 160,
          );
          timers.push(timer);
        }

        timers.push(
          window.setTimeout(() => {
            if (!cancelled) {
              fire({
                particleCount: Math.ceil(preset.particleCount * 0.35),
                spread: preset.spread + 16,
                startVelocity: 34,
                origin: { x: 0.5, y: 0.64 },
                scalar: preset.scalar * 0.75,
                colors: MOMENTUM_COLORS,
                zIndex: 55,
                disableForReducedMotion: true,
              });
            }
          }, 620),
        );
        setState("fired");
      } catch {
        if (!cancelled) {
          setState("failed");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      reset?.();
    };
  }, [completionId, enabled]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[55] size-full"
      data-testid="completion-celebration-effect"
      data-celebration-state={state}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 5: Carry animation preference to the board and gate the start pulse**

Add `celebrationAnimationEnabled: boolean` to `ProjectBoardView`. In `getProjectBoard`, select:

```sql
coalesce(preference.celebration_animation_enabled, true)
  as celebration_animation_enabled
```

using a left join from the actor profile to `motivation_preferences`, add the field to `ProjectRow`, and return it.

In `KanbanBoard`, extend the React import with `useEffect` and `useRef`, then add this state and cleanup next to the existing state:

```ts
const [startedTaskId, setStartedTaskId] = useState<string | null>(null);
const startPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(
  () => () => {
    if (startPulseTimer.current) {
      clearTimeout(startPulseTimer.current);
    }
  },
  [],
);

function beginStartPulse(taskId: string): void {
  if (startPulseTimer.current) {
    clearTimeout(startPulseTimer.current);
  }
  setStartedTaskId(taskId);
  startPulseTimer.current = setTimeout(() => {
    setStartedTaskId(null);
    startPulseTimer.current = null;
  }, 1_000);
}
```

Before a move, calculate:

```ts
const shouldPulse =
  status === "in_progress" &&
  board.tasks.some((task) => task.id === taskId && task.status === "todo");
```

Only after `result.ok`, call `beginStartPulse(taskId)` when `shouldPulse && board.celebrationAnimationEnabled`. Pass `startPulse={startedTaskId === task.id}` to `TaskCard`.

In `TaskCard`, add `startPulse: boolean` to the props, import `cn`, and replace the Card class expression with:

```tsx
className={cn(
  "transition-shadow motion-reduce:transition-none",
  task.isFocusTask && "border-violet-400 ring-2 ring-violet-100",
  startPulse && "momentum-task-started",
)}
data-start-pulse={startPulse ? "active" : "idle"}
```

- [ ] **Step 6: Place the canvas behind the persisted dialog and add static fallback**

In `CelebrationDialog`, render:

```tsx
<CompletionCelebrationEffect
  completionId={celebration.completionId}
  enabled={celebration.celebrationAnimationEnabled}
/>
```

before `DialogContent`, set the content class to include `z-[60]`, and keep the static sparkle/emoji decoration visible for every preference. Keep exact point, streak, achievement, message, and progress content unchanged.

In settings, replace `Use restrained motion when a new completion celebration opens.` with `Celebrate a new completion with a brief burst and playful emojis.`

- [ ] **Step 7: Add finite CSS and reduced-motion overrides**

In `src/app/globals.css`, keep the existing decoration keyframe but change the enabled declaration to two iterations. Add:

```css
@keyframes momentum-task-started {
  0% {
    box-shadow: 0 0 0 0 rgba(124, 58, 237, 0);
  }
  40% {
    box-shadow: 0 0 0 0.45rem rgba(124, 58, 237, 0.2);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(124, 58, 237, 0);
  }
}

.momentum-task-started {
  animation: momentum-task-started 1s ease-out both;
}

[data-animate="enabled"] [data-completion-decoration] {
  animation: momentum-celebration-float 1.8s ease-in-out 2;
}

@media (prefers-reduced-motion: reduce) {
  .momentum-task-started,
  [data-completion-decoration] {
    animation: none !important;
    transform: none !important;
  }
}
```

- [ ] **Step 8: Run focused tests and static validation**

```bash
pnpm exec vitest run --config vitest.config.ts src/features/tasks/celebration-preset.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: preset tests PASS; type checking, lint, and build PASS.

- [ ] **Step 9: Commit the approved loud celebration**

```bash
git add package.json pnpm-lock.yaml src/app/globals.css src/features/settings/motivation-settings-form.tsx src/features/tasks src/server/projects/get-project-board.ts src/server/types.ts
git commit -m "feat: add accessible completion burst and emojis"
```

---

### Task 10: Clean demo Playwright flow and existing browser regressions

**Files:**

- Create: `playwright.demo.config.ts`
- Create: `tests/demo-e2e/demo-smoke.spec.ts`
- Modify: `tests/e2e/momentum-happy-path.spec.ts`
- Modify: `tests/e2e/motivation-experience.spec.ts`
- Modify: `tests/e2e/new-user-self-service.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: clean provision command from Task 7 and effect states from Task 9.
- Produces: `pnpm test:e2e:demo` using port 3100, a clean local no-seed reset, runtime auth provisioning, and one Chromium worker.

- [ ] **Step 1: Create the dedicated demo Playwright configuration**

Create `playwright.demo.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

import { demoWorkdayInstant } from "./tests/fixtures/demo";
import { PLAYWRIGHT_JOB_SECRET } from "./tests/fixtures/self-service";

export default defineConfig({
  testDir: "./tests/demo-e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "x-momentum-test-now": demoWorkdayInstant().toISOString(),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
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
```

- [ ] **Step 2: Write the guided demo smoke before adding its package command**

Create `tests/demo-e2e/demo-smoke.spec.ts` with the complete clean guided flow:

```ts
import { expect, test } from "@playwright/test";

import { PLAYWRIGHT_JOB_SECRET } from "../fixtures/self-service";

const CANDIDATE_ID = "40000000-0000-4000-8000-000000000001";
const SUPPORTIVE_MESSAGE =
  /Nice work — your progress earned a new milestone\.|You reached an achievement through work you completed\./;

function required(name: "MOMENTUM_DEMO_EMAIL" | "MOMENTUM_DEMO_PASSWORD") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

test("clean guided demo persists momentum and stays idempotent", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    environment: "test",
  });
  expect(health.headers()["x-request-id"]).toBeTruthy();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(required("MOMENTUM_DEMO_EMAIL"));
  await page.getByLabel("Password").fill(required("MOMENTUM_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Continue to Momentum" }).click();
  await page.getByRole("link", { name: /Launch Week/ }).click();
  const projectUrl = page.url();

  const todoTask = page.getByTestId(`task-${CANDIDATE_ID}`);
  await todoTask.getByRole("button", { name: "Choose as Focus" }).click();
  await expect(todoTask.getByText("Today's Focus")).toBeVisible();
  await todoTask.getByRole("button", { name: "Start task" }).click();

  const inProgressTask = page.getByTestId(`task-${CANDIDATE_ID}`);
  await expect(inProgressTask).toHaveAttribute("data-start-pulse", "active");
  await inProgressTask.getByRole("button", { name: "Complete task" }).click();

  const celebration = page.getByTestId("completion-celebration");
  await expect(
    celebration.getByRole("heading", { name: "52 points earned" }),
  ).toBeVisible();
  await expect(celebration.getByText("40", { exact: true })).toBeVisible();
  await expect(celebration.getByText("+8", { exact: true })).toBeVisible();
  await expect(celebration.getByText("+4", { exact: true })).toBeVisible();
  await expect(celebration.getByText("2 → 3")).toBeVisible();
  await expect(celebration.getByText("Momentum Three")).toBeVisible();
  await expect(celebration.getByText("Ahead of Schedule")).toBeVisible();
  await expect(celebration.getByText(SUPPORTIVE_MESSAGE)).toBeVisible();
  await expect(
    page.getByTestId("completion-celebration-effect"),
  ).toHaveAttribute("data-celebration-state", "fired");

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toBeVisible();
  await expect(
    page.getByTestId("completion-celebration-effect"),
  ).toHaveAttribute("data-celebration-state", "seen");
  await page.getByRole("button", { name: "Keep the momentum going" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByText("3 of 4 tasks complete")).toBeVisible();
  await expect(page.getByText("75%", { exact: true })).toBeVisible();
  await expect(page.getByTestId("unread-notification-count")).toHaveText("1");
  await expect(
    page.getByTestId("dashboard-achievements").getByText("Momentum Three"),
  ).toBeVisible();
  await expect(
    page.getByTestId("dashboard-achievements").getByText("Ahead of Schedule"),
  ).toBeVisible();
  await expect(
    page.getByTestId("point-activity").getByText("52 points"),
  ).toBeVisible();
  await expect(page.getByText(SUPPORTIVE_MESSAGE)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByText("3 of 4 tasks complete")).toBeVisible();

  const jobHeaders = {
    authorization: `Bearer ${PLAYWRIGHT_JOB_SECRET}`,
  };
  const firstScan = await request.post("/api/jobs/deadline-nudges", {
    headers: jobHeaders,
  });
  const retryScan = await request.post("/api/jobs/deadline-nudges", {
    headers: jobHeaders,
  });
  expect(await firstScan.json()).toEqual({ scannedCount: 1, createdCount: 1 });
  expect(await retryScan.json()).toEqual({ scannedCount: 1, createdCount: 0 });
  await page.goto("/notifications");
  await expect(
    page.getByRole("link", { name: /Due soon|Deadline approaching/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible();

  await page.goto(projectUrl);
  const doneTask = page.getByTestId(`task-${CANDIDATE_ID}`);
  await doneTask.getByRole("button", { name: "Reopen task" }).click();
  await page
    .getByTestId(`task-${CANDIDATE_ID}`)
    .getByRole("button", { name: "Complete task" })
    .click();
  await expect(page).not.toHaveURL(/[?&]celebration=/);
  await expect(page.getByTestId("completion-celebration")).toHaveCount(0);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByTestId("unread-notification-count")).toHaveText("2");
});
```

- [ ] **Step 3: Add the clean reset/provision/browser script and verify the test initially fails on missing effect or setup defects**

Add:

```json
"test:e2e:demo": "pnpm exec supabase db reset --local --no-seed && node scripts/with-local-supabase.mjs node scripts/provision-demo.mjs --allow-local && node scripts/with-local-supabase.mjs pnpm exec playwright test --config playwright.demo.config.ts"
```

Run:

```bash
pnpm test:e2e:demo
```

Expected on the first run: any failure must point to a concrete setup or UI contract; fix the implementation rather than weakening exact points, streak, grant, notification, progress, idempotency, or health assertions.

- [ ] **Step 4: Add effect-gating assertions to existing flows**

In `momentum-happy-path.spec.ts`, assert first completion effect state `fired`, then after the existing reload assert `seen`. Keep the persisted dialog expectation.

In `new-user-self-service.spec.ts`, after `page.emulateMedia({ reducedMotion: "reduce" })`, assert state `reduced` and that the dialog remains complete and mobile-width-safe.

In `motivation-experience.spec.ts`, retain the Task 7 aggregate count adjustment and all current message/notification/settings assertions.

- [ ] **Step 5: Run both browser suites**

```bash
pnpm test:e2e
pnpm test:e2e:demo
```

Expected: all three existing Playwright flows PASS and the clean demo smoke PASS.

- [ ] **Step 6: Commit demo browser coverage**

```bash
git add package.json playwright.demo.config.ts scripts/provision-demo.mjs tests/demo-e2e/demo-smoke.spec.ts tests/e2e/momentum-happy-path.spec.ts tests/e2e/motivation-experience.spec.ts tests/e2e/new-user-self-service.spec.ts
git commit -m "test: cover the clean guided Momentum demo"
```

---

### Task 11: Deployment, pilot, feedback-review, and secret-scan documentation

**Files:**

- Create: `scripts/check-source-secrets.mjs`
- Create: `docs/deployment.md`
- Create: `docs/demo-script.md`
- Create: `docs/closed-pilot-checklist.md`
- Create: `docs/feedback-review.sql`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**

- Produces `pnpm check:secrets` and the final composed `pnpm validate`.
- Documents exact local/test/preview/production variables and operator actions without usable credentials.

- [ ] **Step 1: Implement a tracked-source high-confidence secret check**

Create `scripts/check-source-secrets.mjs` with the complete tracked-file scanner:

```js
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";

const rules = [
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  {
    name: "JWT-like service credential",
    pattern:
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  { name: "Resend live key", pattern: /\bre_[A-Za-z0-9_-]{20,}\b/g },
  { name: "Twilio live key", pattern: /\bSK[0-9a-fA-F]{32}\b/g },
  {
    name: "Private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
];

const listed = spawnSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  shell: false,
});
if (listed.status !== 0) {
  throw new Error("Could not list tracked files for the secret scan.");
}

const findings = [];
const files = listed.stdout.split("\0").filter(Boolean);
for (const file of files) {
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size > 2 * 1024 * 1024) {
    continue;
  }
  const buffer = await readFile(file);
  if (buffer.includes(0)) {
    continue;
  }
  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) {
    continue;
  }
  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ file, line, rule: rule.name });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}: ${finding.rule}`);
  }
  process.exitCode = 1;
} else {
  console.info("Tracked-source secret scan passed.");
}
```

The rule set intentionally does not treat the committed local-only passwords in `.env.example`, `supabase/seed.sql`, `tests/fixtures/demo.ts`, and `tests/fixtures/self-service.ts` as production credentials. It reports only file, line, and rule name—never the matched value.

- [ ] **Step 2: Add the script and run it before documentation**

Add:

```json
"check:secrets": "node scripts/check-source-secrets.mjs"
```

Run:

```bash
pnpm check:secrets
```

Expected: PASS with the one-line success message. If the scanner flags its own regex literals, skip only `scripts/check-source-secrets.mjs`; do not weaken the actual patterns.

- [ ] **Step 3: Write exact deployment documentation**

Create `docs/deployment.md` with:

1. the four-row environment table from the design;
2. public vs server/operator variable table;
3. separate Preview/demo and Production Supabase/Vercel scopes;
4. Supabase Site URL examples and restricted redirect patterns;
5. explicit statement that password auth has no callback route and email/OAuth remains disabled until a route exists;
6. migration commands:

```bash
pnpm exec supabase link --project-ref "your-reviewed-project-ref"
pnpm exec supabase db push --linked --dry-run
pnpm exec supabase db push --linked
```

7. Vercel deploy steps using normal Next.js build with no migration hook;
8. health verification using `curl -i https://your-domain.example/api/health` and expected sanitized keys;
9. rollback guidance: roll application back first; never reverse immutable ledger/completion data; write a forward migration for schema correction;
10. hosted checks that require real credentials and therefore cannot be claimed locally.

- [ ] **Step 4: Write the guided demo and pilot checklist**

Create `docs/demo-script.md` with this exact order: sign in; dashboard; open Launch Week; select Prepare launch brief; start and observe pulse; complete and explain 40 base + 8 early + 4 streak = 52; explain 2 → 3; show Momentum Three/Ahead of Schedule; read supportive message; dismiss; dashboard 93/3/75%; notification center; run `pnpm demo:nudges`; show due-soon notification; reload and verify persistence; optionally reopen/recomplete and show no new reward.

Create `docs/closed-pilot-checklist.md` with unchecked operator boxes for environment separation, Auth Site URL/redirects, dry-run migration review, secret setup, demo reset confirmation, health, desktop/mobile/keyboard/reduced-motion smoke, tenant isolation, recompletion, feedback test/review, nudge idempotency, source secret scan, known exclusions, incident request-ID capture, and rollback owner.

- [ ] **Step 5: Add the internal feedback review query**

Create `docs/feedback-review.sql`:

```sql
select
  feedback.id,
  feedback.created_at,
  feedback.category,
  feedback.rating,
  feedback.workspace_id,
  workspace.name as workspace_name,
  feedback.page_context,
  feedback.message
from public.feedback_submissions as feedback
left join public.workspaces as workspace on workspace.id = feedback.workspace_id
where feedback.created_at >= :'since'::timestamptz
order by feedback.created_at desc, feedback.id desc
limit 200;
```

State above the query that it runs only from an authorized operator database session and intentionally omits auth email addresses.

- [ ] **Step 6: Update README and compose the final validation command**

README must contain concise local setup, `pnpm validate`, environment summary, hosted setup link, migration warning, Vercel link, demo provision/reset commands, manual nudge command, credential-sharing rule, health endpoint, canvas-confetti dependency rationale, known exclusions, and links to the demo/pilot/review docs.

Set final scripts to include:

```json
"validate": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:db && pnpm test:integration && pnpm test:e2e && pnpm test:demo && pnpm test:e2e:demo && pnpm check:secrets && pnpm build"
```

- [ ] **Step 7: Format and validate documentation/scripts**

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm check:secrets
```

Expected: formatting, lint, and secret scan PASS.

- [ ] **Step 8: Commit operations documentation**

```bash
git add README.md docs/closed-pilot-checklist.md docs/demo-script.md docs/deployment.md docs/feedback-review.sql package.json scripts/check-source-secrets.mjs
git commit -m "docs: add deployment and closed-pilot operations"
```

---

### Task 12: Full validation, manual demo review, and completion report

**Files:**

- Modify only files required to fix concrete validation failures within the approved scope.
- Do not create a deployment credential, mutate a hosted database, push a deployment, or claim a hosted result without explicit real-environment authorization.

**Interfaces:**

- Consumes every prior task.
- Produces a clean branch, complete validation evidence, manual review notes, and an exact changed-file/deviation/deferred-functionality handoff.

- [ ] **Step 1: Run every individual automated validation command**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:integration
pnpm test:e2e
pnpm test:demo
pnpm test:e2e:demo
pnpm check:secrets
pnpm build
```

Expected: every command exits 0. Record exact test/assertion counts from actual output. Fix failures and rerun the failed command plus any affected neighboring suite.

- [ ] **Step 2: Run the composed release gate**

```bash
pnpm validate
```

Expected: exit 0 across formatting, lint, strict types, unit, pgTAP, integration, existing E2E, reproducibility, demo E2E, tracked-source secret scan, and production build.

- [ ] **Step 3: Start the clean demo locally for human review**

```bash
pnpm exec supabase db reset --local --no-seed
node scripts/with-local-supabase.mjs node scripts/provision-demo.mjs --allow-local
node scripts/with-local-supabase.mjs pnpm exec next dev --hostname 127.0.0.1 --port 3000
```

Expected: provision summary matches the canonical fixture and Next.js reports ready at `http://127.0.0.1:3000`.

- [ ] **Step 4: Manually exercise desktop, mobile, keyboard, and motion behavior**

At desktop width, execute the exact demo script and verify pulse, full burst, emoji waves, exact 52-point explanation, streak 3, both achievements, message, notification, and reload persistence. Reopen/recomplete and verify no additional award, notification, or effect.

At 390×844, verify no horizontal overflow, header controls remain reachable, feedback and celebration dialogs fit the viewport, and all close/submit controls remain visible.

Using keyboard only, verify navigation, Focus selection, Start, Complete, dialog focus trap/return, feedback categories/rating/message/submit, notification navigation, and visible focus.

With OS/browser reduced motion, verify effect state `reduced`, no pulse/canvas movement, and full static celebration content. Disable Celebration animation in Settings and verify state `disabled` independently of OS preference.

- [ ] **Step 5: Manually verify system and security states**

- Request `/api/health` and verify only status/environment/release/requestId.
- Request an unknown route and an inaccessible other-workspace UUID and verify indistinguishable safe not-found treatment.
- Submit valid feedback, repeat the identical request through a controlled retry, and verify one database row; submit the same key with changed content and verify safe conflict.
- Sign in as the teammate locally and verify the demo owner feedback does not appear through an authenticated Supabase select.
- Call the deadline route without a secret and with a wrong secret and verify 401; call twice with the correct local test secret and verify the second call creates zero.
- Inspect structured logs and confirm they contain request IDs/counts but no emails, passwords, auth headers, task titles, feedback text, raw URLs, or database errors.
- Do not run `pnpm demo:reset` against a linked project during local review.

- [ ] **Step 6: Inspect repository state and exact file list**

```bash
git status --short
git diff --check
git diff --name-status main...HEAD
git log --oneline main..HEAD
```

Expected: no unstaged formatting errors or unrelated files; only approved or explicitly documented validation-driven paths appear.

- [ ] **Step 7: Commit validation-driven fixes if any**

If Step 1-6 required tracked fixes, stage only those named files and commit:

```bash
git commit -m "fix: complete Slice 4 validation"
```

If no files changed, do not create an empty commit.

- [ ] **Step 8: Prepare the final handoff without overstating deployment**

Report:

- outcome first;
- every created and modified file grouped by responsibility;
- every command actually run with exact pass counts;
- manual desktop/mobile/keyboard/reduced-motion/security results;
- new dependency and rationale;
- environment, migration, health, demo reset, nudge, logging, feedback, and celebration changes;
- the three plan-discovered scope corrections: sign-in credential gating, server test discovery/health test, and deadline aggregate/Playwright environment expectations;
- all deliberate exclusions;
- any live hosted Vercel/Supabase action not performed.

Do not write that Production, Preview, hosted migrations, hosted redirects, or hosted health were verified unless those exact actions were performed successfully against the named hosted environment.
