# Cohort Assignment and GitHub OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace owner or admin add any Hult cohort participant by GitHub handle, assign a pending To Do task before registration, and let the verified GitHub owner claim and complete that work through Momentum's existing trusted reward flow.

**Architecture:** Keep the Next.js App Router modular monolith and PostgreSQL transaction boundary. Represent unregistered participants as workspace-scoped cohort seats keyed by GitHub's stable numeric user ID, keep pending tasks outside Focus and reward operations, and convert seats plus tasks atomically after Supabase GitHub OAuth verifies the identity. Read the public cohort directory through a server-only GitHub adapter with a 15-minute cache and a committed snapshot; retain email/password authentication and all existing reward rules.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, strict TypeScript 6.0.3, Tailwind CSS 4.3.2, shadcn/ui-compatible primitives, Supabase Auth/PostgreSQL/CLI 2.109.1, `@supabase/supabase-js` 2.110.6, Zod 4.4.3, postgres.js 3.4.9, Vitest 4.1.10, pgTAP, Playwright 1.61.1.

## Global Constraints

- Email/password authentication remains available; GitHub OAuth is optional and additive.
- GitHub's verified stable numeric user ID is the claim key; a submitted handle is never proof of identity.
- Only workspace owners and admins may add cohort participants. Members may assign tasks only to people already present in their workspace.
- A pending cohort task remains To Do and cannot become Focus, start, complete, award points, update streaks, grant achievements, or create completion notifications.
- Existing tasks, completion receipts, immutable point-ledger entries, reward formulas, streak rules, achievements, motivation messages, and exactly-once completion behavior remain unchanged.
- Reopening and recompleting a claimed task must not award points twice.
- Keep trusted authorization, membership, identity-claim, assignment, completion, and reward decisions on the server and inside database transactions where multiple rows change.
- Validate every GitHub response, OAuth identity, route parameter, form field, and cross-workspace identifier.
- Return safe not-found results for unknown and unauthorized workspace resources.
- Keep GitHub tokens, OAuth client secrets, service-role keys, and database credentials out of browser code, logs, source files, screenshots, and pull-request text.
- Use supportive copy such as `Waiting for @handle to join`; do not shame unregistered participants or add repeated nudges.
- Maintain keyboard access, visible focus, labeled controls, responsive layouts, and existing reduced-motion behavior.
- Add no production dependency for this slice; use the platform `fetch`, Next.js caching, existing Zod, and existing Supabase packages.
- Defer role editing, member removal, email/SMS invitations, manual identity linking, GitHub organization enforcement, public leaderboards, billing, analytics, and changes to trusted reward rules.

---

## Scope and file responsibility map

This remains one vertical-slice plan. Directory discovery, pending seats, verified claiming, and task assignment are interdependent parts of the single staff-review path; splitting them into separately shipped sub-projects would leave intermediate releases unable to satisfy the baseline.

### Cohort identity and directory

- Create `src/domain/cohort/github-handle.ts` and `src/domain/cohort/github-handle.test.ts` for lowercase normalization and GitHub handle validation.
- Create `src/server/cohort/types.ts` for directory, seat, and claim contracts.
- Create `src/server/cohort/parse-project-pulls.ts` and its test for validated Project 1 PR filtering and stable-ID deduplication.
- Create `src/server/cohort/cohort-snapshot.json` as the committed public fallback captured on July 18, 2026.
- Create `src/server/cohort/github-directory.ts` and its test for server-only live fetch, 15-minute cache, fallback, and exact-handle lookup.

### Database and identity claim boundary

- Create `supabase/migrations/202607180005_cohort_assignment_github_oauth.sql` for profile GitHub identity, workspace cohort seats, pending task assignment, trigger updates, RLS, and OAuth-safe profile initialization.
- Create `supabase/tests/database/fifth_slice.test.sql` for schema constraints, task invariants, trigger behavior, profile initialization, and browser-role privileges.
- Create `src/server/auth/github-identity.ts` and its test for extracting only a verified Supabase GitHub identity.
- Create `src/server/cohort/add-cohort-seat.ts` for owner/admin addition and immediate activation of already-linked profiles.
- Create `src/server/cohort/claim-cohort-seats.ts` for the atomic, idempotent OAuth claim transaction.
- Create `tests/integration/cohort-assignment.test.ts` for authorization, pending restrictions, atomic activation, and idempotency.

### OAuth web flow

- Create `src/server/auth/application-origin.ts` and its test for a trusted callback origin.
- Create `src/app/auth/callback/route.ts` for code exchange, verified identity extraction, transactional claim, safe logging, and redirect.
- Create `src/features/auth/github-oauth-button.tsx` and `src/features/auth/auth-error-notice.tsx` for the additive GitHub path and supportive errors.
- Modify `src/features/auth/actions.ts`, both auth pages, `src/proxy.ts`, and `.env.example` for OAuth initiation and callback access.

### Workspace team and pending task assignment

- Create `src/features/cohort/schemas.ts`, its unit test, `src/features/cohort/actions.ts`, `src/features/cohort/add-cohort-member-dialog.tsx`, and `src/features/cohort/team-section.tsx` for authorized team discovery and addition.
- Create `src/server/workspaces/require-workspace-manager.ts` so the action checks owner/admin authorization before making an external GitHub lookup; the write transaction repeats the check under lock.
- Modify `src/server/workspaces/get-workspace-overview.ts`, `src/server/types.ts`, and the workspace page to return and render active members plus pending cohort seats.
- Create `src/server/tasks/resolve-task-assignee.ts` for one trusted active-or-pending assignee resolver.
- Modify task schemas, actions, services, permission logic, and existing integration callers to use a discriminated assignee reference.
- Create `src/features/tasks/assignee-filter.ts` and its unit test for deterministic board filtering.
- Modify the project-board query, task dialog, task card, and Kanban board for pending presentation and the assignee filter.

### Verification and operations

- Create `tests/e2e/cohort-assignment.spec.ts` for the deterministic owner-side browser path using the committed snapshot.
- Modify `README.md`, `docs/deployment.md`, `docs/demo-script.md`, and `docs/closed-pilot-checklist.md` for GitHub OAuth setup, staff testing, and honest limitations.
- Do not change `package.json` or `pnpm-lock.yaml`; this feature needs no dependency.

## Contributor lanes and merge order

- Lane A may implement Task 1 independently: domain normalization and the read-only directory adapter.
- Lane B may implement Task 2 independently: migration and pgTAP coverage.
- After Tasks 1 and 2 merge, Lane C may implement Task 3: seat and claim services.
- After Task 3, Lane D may implement Task 4: OAuth route and auth UI.
- Task 5 owns workspace types and workspace-page UI; Task 6 owns task-service types and task mutations. They may run in separate worktrees only if Task 5 does not edit `src/server/types.ts` until Task 6's type commit is merged, or vice versa.
- Task 7 owns board presentation after Task 6. Task 8 owns cross-layer tests after Tasks 4-7. Task 9 owns shared documentation, and Task 10 is the single release gate.
- Never run concurrent contributors in the same working tree when both touch `src/server/types.ts`, `src/features/tasks/*`, the migration, or shared test fixtures.

---

### Task 1: Validated cohort directory with committed fallback

**Files:**

- Create: `src/domain/cohort/github-handle.ts`
- Create: `src/domain/cohort/github-handle.test.ts`
- Create: `src/server/cohort/types.ts`
- Create: `src/server/cohort/parse-project-pulls.ts`
- Create: `src/server/cohort/parse-project-pulls.test.ts`
- Create: `src/server/cohort/cohort-snapshot.json`
- Create: `src/server/cohort/github-directory.ts`
- Create: `src/server/cohort/github-directory.test.ts`

**Interfaces:**

- Produces: `normalizeGitHubHandle(value: string): string | null`.
- Produces: `CohortDirectoryEntry`, `CohortDirectoryView`, `CohortSeatView`, and `CohortClaimReceipt` from `src/server/cohort/types.ts`.
- Produces: `parseProjectOnePulls(payload: unknown): CohortDirectoryEntry[]`.
- Produces: `getCohortDirectory(): Promise<CohortDirectoryView>` and `resolveCohortParticipant(handle: string): Promise<CohortDirectoryEntry>`.
- The rest of the application consumes normalized lowercase handles and decimal GitHub IDs represented as strings so PostgreSQL `bigint` values never lose precision in JavaScript.

- [ ] **Step 1: Write the failing handle and pull-parser tests**

Create `src/domain/cohort/github-handle.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { normalizeGitHubHandle } from "./github-handle";

describe("normalizeGitHubHandle", () => {
  it.each([
    [" KPerpignant ", "kperpignant"],
    ["RAVEN-dubgub", "raven-dubgub"],
    ["a", "a"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeGitHubHandle(input)).toBe(expected);
  });

  it.each([
    "",
    "-starts",
    "ends-",
    "two--hyphens",
    "has space",
    "x".repeat(40),
  ])("rejects %s", (input) => expect(normalizeGitHubHandle(input)).toBeNull());
});
```

Create `src/server/cohort/parse-project-pulls.test.ts` with open, merged, closed-unmerged, wrong-branch, author/branch mismatch, and duplicate cases:

```ts
import { describe, expect, it } from "vitest";

import { parseProjectOnePulls } from "./parse-project-pulls";

const pull = (overrides: Record<string, unknown> = {}) => ({
  html_url:
    "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
  state: "open",
  merged_at: null,
  head: { ref: "participants/summer26/phase-1-project-1/kperpignant" },
  user: {
    id: 227412781,
    login: "kperpignant",
    html_url: "https://github.com/kperpignant",
  },
  ...overrides,
});

describe("parseProjectOnePulls", () => {
  it("keeps open and merged participant submissions and deduplicates stable IDs", () => {
    const entries = parseProjectOnePulls([
      pull(),
      pull({ state: "closed", merged_at: "2026-07-18T12:23:12Z" }),
      pull({ state: "closed", merged_at: null }),
      pull({
        head: { ref: "participants/summer26/phase-1-project-2/kperpignant" },
      }),
      pull({
        head: { ref: "participants/summer26/phase-1-project-1/someone-else" },
      }),
    ]);

    expect(entries).toEqual([
      {
        githubUserId: "227412781",
        githubHandle: "kperpignant",
        profileUrl: "https://github.com/kperpignant",
        sourcePullRequestUrl:
          "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
        displayName: null,
      },
    ]);
  });

  it("rejects malformed upstream payloads", () => {
    expect(() => parseProjectOnePulls({ message: "rate limited" })).toThrow(
      "GitHub pull-request payload was invalid.",
    );
  });
});
```

- [ ] **Step 2: Run the focused tests and verify missing-module failures**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/domain/cohort/github-handle.test.ts \
  src/server/cohort/parse-project-pulls.test.ts
```

Expected: FAIL because the two implementation modules do not exist.

- [ ] **Step 3: Implement normalization, contracts, and validated PR parsing**

Create `src/domain/cohort/github-handle.ts`:

```ts
const GITHUB_HANDLE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/;

export function normalizeGitHubHandle(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return GITHUB_HANDLE.test(normalized) ? normalized : null;
}
```

Create `src/server/cohort/types.ts`:

```ts
export interface CohortDirectoryEntry {
  githubUserId: string;
  githubHandle: string;
  profileUrl: string;
  sourcePullRequestUrl: string | null;
  displayName: string | null;
}

export interface CohortDirectoryView {
  entries: CohortDirectoryEntry[];
  source: "github" | "snapshot";
  synchronizedAt: string;
}

export interface CohortSeatView {
  id: string;
  workspaceId: string;
  githubUserId: string;
  githubHandle: string;
  profileUrl: string;
  userId: string | null;
  claimedAt: string | null;
}

export interface CohortClaimReceipt {
  workspaceIds: string[];
  claimedSeatCount: number;
  activatedTaskCount: number;
}
```

Create `src/server/cohort/parse-project-pulls.ts` using Zod to validate the full array before filtering:

```ts
import { z } from "zod";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import type { CohortDirectoryEntry } from "@/server/cohort/types";

const PROJECT_BRANCH = "participants/summer26/phase-1-project-1/";
const pullSchema = z.array(
  z.object({
    html_url: z.url(),
    state: z.enum(["open", "closed"]),
    merged_at: z.iso.datetime().nullable(),
    head: z.object({ ref: z.string() }),
    user: z
      .object({
        id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        login: z.string(),
        html_url: z.url(),
      })
      .nullable(),
  }),
);

export function parseProjectOnePulls(payload: unknown): CohortDirectoryEntry[] {
  const parsed = pullSchema.safeParse(payload);
  if (!parsed.success)
    throw new TypeError("GitHub pull-request payload was invalid.");

  const byId = new Map<string, CohortDirectoryEntry>();
  for (const pull of parsed.data) {
    if (pull.state === "closed" && pull.merged_at === null) continue;
    if (!pull.head.ref.startsWith(PROJECT_BRANCH) || !pull.user) continue;
    const branchHandle = normalizeGitHubHandle(
      pull.head.ref.slice(PROJECT_BRANCH.length),
    );
    const authorHandle = normalizeGitHubHandle(pull.user.login);
    if (!branchHandle || branchHandle !== authorHandle) continue;
    const githubUserId = String(pull.user.id);
    if (!byId.has(githubUserId)) {
      byId.set(githubUserId, {
        githubUserId,
        githubHandle: authorHandle,
        profileUrl: pull.user.html_url,
        sourcePullRequestUrl: pull.html_url,
        displayName: null,
      });
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.githubHandle.localeCompare(b.githubHandle),
  );
}
```

- [ ] **Step 4: Add the exact committed snapshot**

Create `src/server/cohort/cohort-snapshot.json` with this exact, deduplicated public snapshot:

```json
{
  "synchronizedAt": "2026-07-18T18:08:40Z",
  "entries": [
    {
      "githubUserId": "21232614",
      "githubHandle": "artira",
      "profileUrl": "https://github.com/artira",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/53",
      "displayName": null
    },
    {
      "githubUserId": "200448977",
      "githubHandle": "codingwcal",
      "profileUrl": "https://github.com/CodingWCal",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/45",
      "displayName": null
    },
    {
      "githubUserId": "171474297",
      "githubHandle": "divyaprakash04",
      "profileUrl": "https://github.com/DivyaPrakash04",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/55",
      "displayName": null
    },
    {
      "githubUserId": "78661719",
      "githubHandle": "frankgomezdev",
      "profileUrl": "https://github.com/frankgomezdev",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/54",
      "displayName": null
    },
    {
      "githubUserId": "175843767",
      "githubHandle": "gge513",
      "profileUrl": "https://github.com/gge513",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/59",
      "displayName": null
    },
    {
      "githubUserId": "296315793",
      "githubHandle": "jayyyw34",
      "profileUrl": "https://github.com/jayyyW34",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/31",
      "displayName": null
    },
    {
      "githubUserId": "46075221",
      "githubHandle": "joes9987",
      "profileUrl": "https://github.com/joes9987",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/56",
      "displayName": null
    },
    {
      "githubUserId": "227412781",
      "githubHandle": "kperpignant",
      "profileUrl": "https://github.com/kperpignant",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
      "displayName": null
    },
    {
      "githubUserId": "295988929",
      "githubHandle": "kureen-cyber",
      "profileUrl": "https://github.com/kureen-cyber",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/42",
      "displayName": null
    },
    {
      "githubUserId": "216057099",
      "githubHandle": "lorra-v",
      "profileUrl": "https://github.com/Lorra-V",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/46",
      "displayName": null
    },
    {
      "githubUserId": "222322612",
      "githubHandle": "mitchelldante99-create",
      "profileUrl": "https://github.com/mitchelldante99-create",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/39",
      "displayName": null
    },
    {
      "githubUserId": "161231855",
      "githubHandle": "nikjain15",
      "profileUrl": "https://github.com/nikjain15",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/48",
      "displayName": null
    },
    {
      "githubUserId": "181403125",
      "githubHandle": "paramjeet-singh-neu",
      "profileUrl": "https://github.com/Paramjeet-singh-neu",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/50",
      "displayName": null
    },
    {
      "githubUserId": "57016501",
      "githubHandle": "ramyatolety",
      "profileUrl": "https://github.com/RamyaTolety",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/49",
      "displayName": null
    },
    {
      "githubUserId": "297017555",
      "githubHandle": "r3s0lv343vr",
      "profileUrl": "https://github.com/r3s0lv343vr",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/44",
      "displayName": null
    },
    {
      "githubUserId": "181426915",
      "githubHandle": "raven-dubgub",
      "profileUrl": "https://github.com/RAVEN-dubgub",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/57",
      "displayName": null
    },
    {
      "githubUserId": "294016067",
      "githubHandle": "studmuffin01",
      "profileUrl": "https://github.com/Studmuffin01",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/58",
      "displayName": null
    },
    {
      "githubUserId": "60740313",
      "githubHandle": "zukhriddingit",
      "profileUrl": "https://github.com/zukhriddingit",
      "sourcePullRequestUrl": "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/43",
      "displayName": null
    }
  ]
}
```

- [ ] **Step 5: Write failing live/fallback/exact-lookup tests**

Create `src/server/cohort/github-directory.test.ts` around an injected `fetcher`:

```ts
import { describe, expect, it, vi } from "vitest";

import {
  loadCohortDirectory,
  resolveCohortParticipantWith,
} from "./github-directory";

describe("GitHub cohort directory", () => {
  it("returns validated live entries", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            html_url:
              "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
            state: "open",
            merged_at: null,
            head: {
              ref: "participants/summer26/phase-1-project-1/kperpignant",
            },
            user: {
              id: 227412781,
              login: "kperpignant",
              html_url: "https://github.com/kperpignant",
            },
          },
        ]),
        { status: 200 },
      ),
    );
    const result = await loadCohortDirectory({ fetcher, forceSnapshot: false });
    expect(result.source).toBe("github");
    expect(result.entries[0]?.githubUserId).toBe("227412781");
  });

  it("uses the committed snapshot after an upstream failure", async () => {
    const result = await loadCohortDirectory({
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
      forceSnapshot: false,
    });
    expect(result.source).toBe("snapshot");
    expect(
      result.entries.some((entry) => entry.githubHandle === "kperpignant"),
    ).toBe(true);
  });

  it("resolves a real exact handle when it is absent from the directory", async () => {
    const entry = await resolveCohortParticipantWith("octocat", {
      directory: {
        entries: [],
        source: "snapshot",
        synchronizedAt: "2026-07-18T18:08:40Z",
      },
      fetcher: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 583231,
            login: "octocat",
            html_url: "https://github.com/octocat",
            name: "The Octocat",
          }),
          { status: 200 },
        ),
      ),
    });
    expect(entry).toMatchObject({
      githubUserId: "583231",
      githubHandle: "octocat",
    });
  });
});
```

- [ ] **Step 6: Implement the server-only adapter and cache**

Create `src/server/cohort/github-directory.ts` with these exact public and test seams:

```ts
import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import snapshotJson from "@/server/cohort/cohort-snapshot.json";
import { parseProjectOnePulls } from "@/server/cohort/parse-project-pulls";
import type {
  CohortDirectoryEntry,
  CohortDirectoryView,
} from "@/server/cohort/types";

type Fetcher = typeof fetch;
const PULLS_URL =
  "https://api.github.com/repos/rogerSuperBuilderAlpha/hult-cohort-program/pulls?state=all&per_page=100";
const entrySchema = z.object({
  githubUserId: z.string().regex(/^\d+$/),
  githubHandle: z
    .string()
    .refine((value) => normalizeGitHubHandle(value) === value),
  profileUrl: z.url(),
  sourcePullRequestUrl: z.url().nullable(),
  displayName: z.string().nullable(),
});
const snapshotSchema = z.object({
  synchronizedAt: z.iso.datetime(),
  entries: z.array(entrySchema),
});
const userSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  login: z.string(),
  html_url: z.url(),
  name: z.string().nullable(),
});

function headers(): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_DIRECTORY_TOKEN)
    result.Authorization = `Bearer ${process.env.GITHUB_DIRECTORY_TOKEN}`;
  return result;
}

function snapshot(): CohortDirectoryView {
  const parsed = snapshotSchema.parse(snapshotJson);
  return {
    entries: parsed.entries,
    source: "snapshot",
    synchronizedAt: parsed.synchronizedAt,
  };
}

export async function loadCohortDirectory(input: {
  fetcher: Fetcher;
  forceSnapshot: boolean;
}): Promise<CohortDirectoryView> {
  if (input.forceSnapshot) return snapshot();
  try {
    const response = await input.fetcher(PULLS_URL, { headers: headers() });
    if (!response.ok) throw new Error("GitHub directory request failed.");
    const entries = parseProjectOnePulls(await response.json());
    if (entries.length === 0) throw new Error("GitHub directory was empty.");
    return {
      entries,
      source: "github",
      synchronizedAt: new Date().toISOString(),
    };
  } catch {
    return snapshot();
  }
}

const cachedDirectory = unstable_cache(
  () =>
    loadCohortDirectory({
      fetcher: fetch,
      forceSnapshot: process.env.MOMENTUM_ENVIRONMENT === "test",
    }),
  ["hult-project-one-cohort-directory"],
  { revalidate: 900 },
);

export function getCohortDirectory(): Promise<CohortDirectoryView> {
  return cachedDirectory();
}

export async function resolveCohortParticipantWith(
  value: string,
  dependencies: { directory: CohortDirectoryView; fetcher: Fetcher },
): Promise<CohortDirectoryEntry> {
  const handle = normalizeGitHubHandle(value);
  if (!handle) throw new TypeError("GitHub handle is invalid.");
  const known = dependencies.directory.entries.find(
    (entry) => entry.githubHandle === handle,
  );
  if (known) return known;
  const response = await dependencies.fetcher(
    `https://api.github.com/users/${encodeURIComponent(handle)}`,
    { headers: headers() },
  );
  if (response.status === 404)
    throw new TypeError("GitHub account was not found.");
  if (!response.ok)
    throw new Error("GitHub account lookup is temporarily unavailable.");
  const user = userSchema.parse(await response.json());
  const verifiedHandle = normalizeGitHubHandle(user.login);
  if (!verifiedHandle)
    throw new TypeError("GitHub account response was invalid.");
  return {
    githubUserId: String(user.id),
    githubHandle: verifiedHandle,
    profileUrl: user.html_url,
    sourcePullRequestUrl: null,
    displayName: user.name,
  };
}

export async function resolveCohortParticipant(
  value: string,
): Promise<CohortDirectoryEntry> {
  return resolveCohortParticipantWith(value, {
    directory: await getCohortDirectory(),
    fetcher: fetch,
  });
}
```

Convert the two public lookup failures into supportive `AppError` values at the server-action boundary in Task 5; do not expose upstream response bodies.

- [ ] **Step 7: Run unit validation and commit**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/domain/cohort/github-handle.test.ts \
  src/server/cohort/parse-project-pulls.test.ts \
  src/server/cohort/github-directory.test.ts
pnpm typecheck
```

Expected: all focused tests PASS and strict type checking exits 0.

Commit:

```bash
git add src/domain/cohort src/server/cohort
git commit -m "feat: add validated Hult cohort directory"
```

---

### Task 2: Pending-seat database invariants and OAuth-safe profiles

**Files:**

- Create: `supabase/migrations/202607180005_cohort_assignment_github_oauth.sql`
- Create: `supabase/tests/database/fifth_slice.test.sql`

**Interfaces:**

- Produces nullable `profiles.github_user_id bigint` and `profiles.github_handle text` with unique partial indexes.
- Produces `workspace_cohort_seats` keyed by `(workspace_id, github_user_id)`.
- Changes `tasks` so exactly one of `assignee_id` or `cohort_seat_id` is set.
- Preserves the existing `validate_task_workspace_assignee()` and `protect_task_first_completion()` function names so existing operational checks remain valid.
- Browser `authenticated` may read same-workspace seats but may not insert, update, or delete them.

- [ ] **Step 1: Write the failing pgTAP contract**

Create `supabase/tests/database/fifth_slice.test.sql` with this deterministic fixture and assertion structure:

```sql
begin;
select plan(20);

select has_column('public', 'profiles', 'github_user_id', 'profiles store stable GitHub IDs');
select has_column('public', 'profiles', 'github_handle', 'profiles store normalized GitHub handles');
select has_table('public', 'workspace_cohort_seats', 'workspace cohort seats exist');
select has_column('public', 'tasks', 'cohort_seat_id', 'tasks can reference a pending cohort seat');
select has_trigger('public', 'tasks', 'tasks_require_workspace_assignee', 'task assignment trigger remains installed');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated',
    'cohort-db-owner@momentum.local',
    extensions.crypt('momentum-test', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Cohort DB Owner","timezone":"America/New_York"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated',
    'cohort-db-outsider@momentum.local',
    extensions.crypt('momentum-test', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Cohort DB Outsider","timezone":"UTC"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated',
    'cohort-db-github@momentum.local',
    extensions.crypt('momentum-test', extensions.gen_salt('bf')), now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"full_name":"GitHub Cohort Member","user_name":"kperpignant"}'::jsonb,
    now(), now(), '', '', '', ''
  );

select results_eq(
  $$
    select display_name, timezone, motivation_tone::text
    from public.profiles
    where id = '81000000-0000-4000-8000-000000000103'
  $$,
  $$ values ('GitHub Cohort Member'::text, 'UTC'::text, 'friendly'::text) $$,
  'GitHub auth metadata creates a valid UTC profile without email-signup metadata'
);

insert into public.workspaces (id, name, created_by)
values
  ('82000000-0000-4000-8000-000000000101', 'Cohort DB Workspace', '81000000-0000-4000-8000-000000000101'),
  ('82000000-0000-4000-8000-000000000102', 'Cohort DB Outsider Workspace', '81000000-0000-4000-8000-000000000102');

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  ('82000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000101', 'owner'),
  ('82000000-0000-4000-8000-000000000102', '81000000-0000-4000-8000-000000000102', 'owner');

insert into public.projects (id, workspace_id, name, created_by)
values
  ('83000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', 'Cohort DB Project', '81000000-0000-4000-8000-000000000101'),
  ('83000000-0000-4000-8000-000000000102', '82000000-0000-4000-8000-000000000102', 'Cohort DB Outsider Project', '81000000-0000-4000-8000-000000000102');

insert into public.workspace_cohort_seats (
  id, workspace_id, github_user_id, github_handle, created_by
)
values
  ('84000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', 227412781, 'kperpignant', '81000000-0000-4000-8000-000000000101'),
  ('84000000-0000-4000-8000-000000000102', '82000000-0000-4000-8000-000000000102', 60740313, 'zukhriddingit', '81000000-0000-4000-8000-000000000102');

select throws_ok(
  $$
    insert into public.workspace_cohort_seats (
      id, workspace_id, github_user_id, github_handle, user_id, created_by, claimed_at
    ) values (
      '84000000-0000-4000-8000-000000000103',
      '82000000-0000-4000-8000-000000000101', 583231, 'octocat',
      '81000000-0000-4000-8000-000000000103',
      '81000000-0000-4000-8000-000000000101', null
    )
  $$,
  '23514', null,
  'claimed seat identity and claimed_at must be set together'
);

select throws_ok(
  $$ insert into public.tasks (id, project_id, title, assignee_id, cohort_seat_id, status, effort, created_by)
     values (gen_random_uuid(), '83000000-0000-4000-8000-000000000101', 'Two assignees', '81000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000101', 'todo', 'small', '81000000-0000-4000-8000-000000000101') $$,
  '23514', 'task must have exactly one assignee representation',
  'a task cannot reference both an active member and pending seat'
);

select throws_ok(
  $$ insert into public.tasks (id, project_id, title, assignee_id, cohort_seat_id, status, effort, created_by)
     values (gen_random_uuid(), '83000000-0000-4000-8000-000000000101', 'No assignee', null, null, 'todo', 'small', '81000000-0000-4000-8000-000000000101') $$,
  '23514', 'task must have exactly one assignee representation',
  'a task cannot omit both assignee representations'
);

select throws_ok(
  $$ insert into public.tasks (id, project_id, title, assignee_id, status, effort, created_by)
     values (gen_random_uuid(), '83000000-0000-4000-8000-000000000101', 'Foreign member', '81000000-0000-4000-8000-000000000102', 'todo', 'small', '81000000-0000-4000-8000-000000000101') $$,
  '23514', 'task assignee must belong to the project workspace',
  'active assignees must belong to the project workspace'
);

select throws_ok(
  $$ insert into public.tasks (id, project_id, title, cohort_seat_id, status, effort, created_by)
     values (gen_random_uuid(), '83000000-0000-4000-8000-000000000101', 'Foreign pending member', '84000000-0000-4000-8000-000000000102', 'todo', 'small', '81000000-0000-4000-8000-000000000101') $$,
  '23514', 'pending task seat must belong to the project workspace',
  'pending assignees must belong to the project workspace'
);

select throws_ok(
  $$ insert into public.tasks (id, project_id, title, assignee_id, cohort_seat_id, status, effort, created_by)
     values (gen_random_uuid(), '83000000-0000-4000-8000-000000000101', 'Pending started', null, '84000000-0000-4000-8000-000000000101', 'in_progress', 'small', '81000000-0000-4000-8000-000000000101') $$,
  '23514', 'pending cohort tasks must remain todo',
  'a pending task cannot start'
);

insert into public.tasks (
  id, project_id, title, cohort_seat_id, status, effort, created_by
)
values (
  '85000000-0000-4000-8000-000000000101',
  '83000000-0000-4000-8000-000000000101', 'Valid pending task',
  '84000000-0000-4000-8000-000000000101', 'todo', 'small',
  '81000000-0000-4000-8000-000000000101'
);

select throws_ok(
  $$ update public.workspace_cohort_seats
     set user_id = '81000000-0000-4000-8000-000000000103', claimed_at = now()
     where id = '84000000-0000-4000-8000-000000000101' $$,
  '55000', 'pending tasks must be activated before claiming a cohort seat',
  'a seat cannot be marked claimed while tasks still reference it'
);

insert into public.tasks (
  id, project_id, title, assignee_id, status, effort, first_completed_at, created_by
)
values (
  '85000000-0000-4000-8000-000000000102',
  '83000000-0000-4000-8000-000000000101', 'Completed active task',
  '81000000-0000-4000-8000-000000000101', 'done', 'small', now(),
  '81000000-0000-4000-8000-000000000101'
);

select throws_ok(
  $$ update public.tasks
     set assignee_id = null, cohort_seat_id = '84000000-0000-4000-8000-000000000101'
     where id = '85000000-0000-4000-8000-000000000102' $$,
  '55000', 'tasks.assignee_id is immutable after first completion',
  'a completed task cannot change assignee representation'
);

select throws_ok(
  $$ insert into public.workspace_cohort_seats (
       id, workspace_id, github_user_id, github_handle, created_by
     ) values (
       '84000000-0000-4000-8000-000000000104',
       '82000000-0000-4000-8000-000000000101', 227412781,
       'kperpignant', '81000000-0000-4000-8000-000000000101'
     ) $$,
  '23505', null,
  'one workspace has at most one seat for a stable GitHub user'
);

select throws_ok(
  $$ insert into public.workspace_cohort_seats (
       id, workspace_id, github_user_id, github_handle, created_by
     ) values (
       '84000000-0000-4000-8000-000000000105',
       '82000000-0000-4000-8000-000000000101', 999999999,
       'two--hyphens', '81000000-0000-4000-8000-000000000101'
     ) $$,
  '23514', null,
  'seat handles must be normalized valid GitHub handles'
);

update public.profiles
set github_user_id = 227412781, github_handle = 'kperpignant'
where id = '81000000-0000-4000-8000-000000000103';

select throws_ok(
  $$ update public.profiles
     set github_user_id = 227412781, github_handle = 'another-handle'
     where id = '81000000-0000-4000-8000-000000000102' $$,
  '23505', null,
  'a stable GitHub user can link to only one profile'
);

select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.workspace_cohort_seats', 'INSERT,UPDATE,DELETE'),
  'authenticated cannot mutate cohort seats directly'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
set local role authenticated;

select results_eq(
  $$ select github_handle from public.workspace_cohort_seats order by github_handle $$,
  $$ values ('kperpignant'::text) $$,
  'a member can read pending seats in their workspace'
);

reset role;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000102', true);
set local role authenticated;

select is_empty(
  $$ select id from public.workspace_cohort_seats where workspace_id = '82000000-0000-4000-8000-000000000101' $$,
  'an outsider cannot read another workspace cohort seats'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test and verify the missing migration failure**

Run:

```bash
pnpm supabase:start
pnpm test:db
```

Expected: FAIL in `fifth_slice.test.sql` because the GitHub columns and cohort-seat table do not exist.

- [ ] **Step 3: Create the migration with exact constraints**

Create `supabase/migrations/202607180005_cohort_assignment_github_oauth.sql` with these statements in order:

```sql
alter table public.profiles
  add column github_user_id bigint,
  add column github_handle text;

alter table public.profiles
  add constraint profiles_github_user_id_positive check (github_user_id is null or github_user_id > 0),
  add constraint profiles_github_handle_valid check (
    github_handle is null or (
      github_handle = lower(github_handle)
      and char_length(github_handle) between 1 and 39
      and github_handle ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'
      and github_handle !~ '--'
    )
  );

create unique index profiles_github_user_id_uq
  on public.profiles (github_user_id) where github_user_id is not null;
create unique index profiles_github_handle_uq
  on public.profiles (github_handle) where github_handle is not null;

create table public.workspace_cohort_seats (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  github_user_id bigint not null check (github_user_id > 0),
  github_handle text not null,
  user_id uuid references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint workspace_cohort_seats_handle_valid check (
    github_handle = lower(github_handle)
    and char_length(github_handle) between 1 and 39
    and github_handle ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'
    and github_handle !~ '--'
  ),
  constraint workspace_cohort_seats_claim_consistent check (
    (user_id is null) = (claimed_at is null)
  ),
  unique (workspace_id, github_user_id)
);

create unique index workspace_cohort_seats_workspace_user_uq
  on public.workspace_cohort_seats (workspace_id, user_id)
  where user_id is not null;
create index workspace_cohort_seats_github_user_idx
  on public.workspace_cohort_seats (github_user_id);

alter table public.workspace_cohort_seats enable row level security;
create policy "members read workspace cohort seats"
on public.workspace_cohort_seats for select to authenticated
using (public.is_workspace_member(workspace_id));
grant select on public.workspace_cohort_seats to authenticated;

alter table public.tasks alter column assignee_id drop not null;
alter table public.tasks
  add column cohort_seat_id uuid references public.workspace_cohort_seats (id) on delete restrict,
  add constraint tasks_exactly_one_assignee check (
    (assignee_id is not null)::integer + (cohort_seat_id is not null)::integer = 1
  );
create index tasks_cohort_seat_idx on public.tasks (cohort_seat_id)
  where cohort_seat_id is not null;
```

Replace the task validator and add the claim-order guard:

```sql
create or replace function public.validate_task_workspace_assignee()
returns trigger language plpgsql set search_path = '' as $$
declare target_workspace_id uuid;
begin
  if (new.assignee_id is null) = (new.cohort_seat_id is null) then
    raise exception 'task must have exactly one assignee representation' using errcode = '23514';
  end if;
  select project.workspace_id into target_workspace_id
  from public.projects as project where project.id = new.project_id;
  if new.assignee_id is not null and not exists (
    select 1 from public.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id and membership.user_id = new.assignee_id
  ) then
    raise exception 'task assignee must belong to the project workspace' using errcode = '23514';
  end if;
  if new.cohort_seat_id is not null and not exists (
    select 1 from public.workspace_cohort_seats as seat
    where seat.id = new.cohort_seat_id and seat.workspace_id = target_workspace_id and seat.user_id is null
  ) then
    raise exception 'pending task seat must belong to the project workspace' using errcode = '23514';
  end if;
  if new.cohort_seat_id is not null and new.status <> 'todo' then
    raise exception 'pending cohort tasks must remain todo' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger tasks_require_workspace_assignee on public.tasks;
create trigger tasks_require_workspace_assignee
before insert or update of project_id, assignee_id, cohort_seat_id, status on public.tasks
for each row execute function public.validate_task_workspace_assignee();

create function public.protect_cohort_seat_claim_order()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.user_id is null and new.user_id is not null and exists (
    select 1 from public.tasks as task where task.cohort_seat_id = old.id
  ) then
    raise exception 'pending tasks must be activated before claiming a cohort seat' using errcode = '55000';
  end if;
  if old.user_id is not null and (new.user_id is distinct from old.user_id or new.claimed_at is distinct from old.claimed_at) then
    raise exception 'claimed cohort seat identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger workspace_cohort_seat_claim_is_ordered
before update of user_id, claimed_at on public.workspace_cohort_seats
for each row execute function public.protect_cohort_seat_claim_order();
```

Replace the completion and auth-profile functions with these exact guards and fallbacks:

```sql
create or replace function public.protect_task_first_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.first_completed_at is not null then
    if new.first_completed_at is distinct from old.first_completed_at then
      raise exception 'tasks.first_completed_at is immutable once set' using errcode = '55000';
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      raise exception 'tasks.assignee_id is immutable after first completion' using errcode = '55000';
    end if;
    if new.cohort_seat_id is distinct from old.cohort_seat_id then
      raise exception 'tasks.cohort_seat_id is immutable after first completion' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.initialize_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_name text;
  requested_timezone text := nullif(metadata ->> 'timezone', '');
begin
  requested_name := left(
    trim(coalesce(
      nullif(metadata ->> 'display_name', ''),
      nullif(metadata ->> 'full_name', ''),
      nullif(metadata ->> 'name', ''),
      nullif(metadata ->> 'user_name', ''),
      nullif(metadata ->> 'preferred_username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Momentum member'
    )),
    80
  );

  if char_length(requested_name) not between 1 and 80 then
    raise exception 'valid display_name metadata is required' using errcode = '22023';
  end if;

  if requested_timezone is null then
    requested_timezone := 'UTC';
  elsif not exists (
    select 1 from pg_catalog.pg_timezone_names where name = requested_timezone
  ) then
    raise exception 'valid timezone metadata is required' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, timezone, motivation_tone)
  values (new.id, requested_name, requested_timezone, 'friendly')
  on conflict (id) do nothing;

  insert into public.motivation_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.initialize_auth_profile()
from public, anon, authenticated;
```

- [ ] **Step 4: Run database and existing integration regression tests**

Run:

```bash
pnpm test:db
pnpm test:integration
```

Expected: all pgTAP and current integration tests PASS. Existing inserts with `assignee_id` continue to satisfy exactly-one-assignee without data rewrites.

- [ ] **Step 5: Commit the schema boundary**

```bash
git add supabase/migrations/202607180005_cohort_assignment_github_oauth.sql \
  supabase/tests/database/fifth_slice.test.sql
git commit -m "feat: add pending cohort assignment schema"
```

---

### Task 3: Verified identity extraction and atomic seat claiming

**Files:**

- Create: `src/server/auth/github-identity.ts`
- Create: `src/server/auth/github-identity.test.ts`
- Create: `src/server/cohort/add-cohort-seat.ts`
- Create: `src/server/cohort/claim-cohort-seats.ts`
- Create: `tests/integration/cohort-assignment.test.ts`

**Interfaces:**

- Produces: `VerifiedGitHubIdentity` with `{ githubUserId: string; githubHandle: string; displayName: string }`.
- Produces: `extractVerifiedGitHubIdentity(identities: readonly UserIdentity[] | undefined): VerifiedGitHubIdentity`.
- Consumes: `CohortDirectoryEntry` from Task 1.
- Produces: `addCohortSeat(input): Promise<CohortSeatView>`.
- Produces: `claimCohortSeats(input): Promise<CohortClaimReceipt>`.

- [ ] **Step 1: Write failing verified-identity tests**

Create `src/server/auth/github-identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { extractVerifiedGitHubIdentity } from "./github-identity";

describe("extractVerifiedGitHubIdentity", () => {
  it("extracts the stable provider ID and normalized verified handle", () => {
    expect(
      extractVerifiedGitHubIdentity([
        {
          provider: "github",
          id: "227412781",
          identity_id: crypto.randomUUID(),
          user_id: crypto.randomUUID(),
          identity_data: {
            user_name: "KPerpignant",
            full_name: "Kim Perpignant",
          },
        },
      ]),
    ).toEqual({
      githubUserId: "227412781",
      githubHandle: "kperpignant",
      displayName: "Kim Perpignant",
    });
  });

  it.each([
    undefined,
    [],
    [{ provider: "email", id: "x", identity_id: "x", user_id: "x" }],
  ])("rejects identities without verified GitHub data", (identities) =>
    expect(() => extractVerifiedGitHubIdentity(identities)).toThrow(
      "A verified GitHub identity is required.",
    ),
  );
});
```

- [ ] **Step 2: Implement verified extraction**

Create `src/server/auth/github-identity.ts`:

```ts
import type { UserIdentity } from "@supabase/supabase-js";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import { AppError } from "@/server/errors";

export interface VerifiedGitHubIdentity {
  githubUserId: string;
  githubHandle: string;
  displayName: string;
}

export function extractVerifiedGitHubIdentity(
  identities: readonly UserIdentity[] | undefined,
): VerifiedGitHubIdentity {
  const identity = identities?.find(
    (candidate) => candidate.provider === "github",
  );
  const githubUserId = identity?.id;
  const data = identity?.identity_data;
  const handle = normalizeGitHubHandle(
    typeof data?.user_name === "string"
      ? data.user_name
      : typeof data?.preferred_username === "string"
        ? data.preferred_username
        : "",
  );
  if (!identity || !githubUserId || !/^\d+$/.test(githubUserId) || !handle) {
    throw new AppError(
      "UNAUTHORIZED",
      "A verified GitHub identity is required.",
    );
  }
  const candidateName = [data?.full_name, data?.name, handle].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  return {
    githubUserId,
    githubHandle: handle,
    displayName: (candidateName ?? handle).trim().slice(0, 80),
  };
}
```

- [ ] **Step 3: Write the failing seat/claim integration cases**

Create `tests/integration/cohort-assignment.test.ts` using fixed fixture UUIDs and `insertAuthUser`. Cover:

```ts
const occurredAt = new Date("2026-07-18T15:00:00.000Z");
const ownerId = selfServiceUuid(800);
const adminId = selfServiceUuid(801);
const memberId = selfServiceUuid(802);
const outsiderId = selfServiceUuid(803);
const claimantId = selfServiceUuid(804);
const participant = {
  githubUserId: "227412781",
  githubHandle: "kperpignant",
  profileUrl: "https://github.com/kperpignant",
  sourcePullRequestUrl:
    "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
  displayName: null,
} satisfies CohortDirectoryEntry;

let workspaceId: string;
let projectId: string;

beforeAll(async () => {
  await Promise.all([
    insertAuthUser({
      id: ownerId,
      email: "cohort-owner@momentum.local",
      displayName: "Cohort Owner",
      timezone: "UTC",
    }),
    insertAuthUser({
      id: adminId,
      email: "cohort-admin@momentum.local",
      displayName: "Cohort Admin",
      timezone: "UTC",
    }),
    insertAuthUser({
      id: memberId,
      email: "cohort-member@momentum.local",
      displayName: "Cohort Member",
      timezone: "UTC",
    }),
    insertAuthUser({
      id: outsiderId,
      email: "cohort-outsider@momentum.local",
      displayName: "Cohort Outsider",
      timezone: "UTC",
    }),
    insertAuthUser({
      id: claimantId,
      email: "cohort-claimant@momentum.local",
      displayName: "Claimant",
      timezone: "UTC",
    }),
  ]);
  const workspace = await createWorkspace({
    actorId: ownerId,
    name: "Cohort Integration Workspace",
  });
  const project = await createProject({
    actorId: ownerId,
    workspaceId: workspace.id,
    name: "Cohort Integration Project",
    description: null,
  });
  workspaceId = workspace.id;
  projectId = project.id;
  await database()`
    insert into public.workspace_memberships (workspace_id, user_id, role)
    values (${workspaceId}, ${adminId}, 'admin'), (${workspaceId}, ${memberId}, 'member')
  `;
});

function seatInput(actorId: string) {
  return { actorId, workspaceId, participant, occurredAt };
}

it("allows an owner and admin, but not a member or outsider, to add a cohort seat", async () => {
  await expect(addCohortSeat(seatInput(ownerId))).resolves.toMatchObject({
    userId: null,
  });
  await expect(addCohortSeat(seatInput(adminId))).resolves.toMatchObject({
    githubHandle: "kperpignant",
  });
  await expect(addCohortSeat(seatInput(memberId))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(addCohortSeat(seatInput(outsiderId))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

it("claims matching seats, activates tasks, and remains idempotent", async () => {
  const sql = database();
  const seat = await addCohortSeat(seatInput(ownerId));
  const taskId = selfServiceUuid(805);
  await sql`
    insert into public.tasks (
      id, project_id, title, cohort_seat_id, status, effort, created_by
    ) values (
      ${taskId}, ${projectId}, 'Claim this cohort task', ${seat.id},
      'todo', 'medium', ${ownerId}
    )
  `;
  const first = await claimCohortSeats({
    actorId: claimantId,
    identity: {
      githubUserId: "227412781",
      githubHandle: "kperpignant",
      displayName: "Kim Perpignant",
    },
    occurredAt,
  });
  expect(first).toMatchObject({ claimedSeatCount: 1, activatedTaskCount: 1 });
  const second = await claimCohortSeats({
    actorId: claimantId,
    identity: {
      githubUserId: "227412781",
      githubHandle: "kperpignant",
      displayName: "Kim Perpignant",
    },
    occurredAt,
  });
  expect(second).toMatchObject({ claimedSeatCount: 0, activatedTaskCount: 0 });
  expect(
    await sql`select count(*)::integer as count from public.workspace_memberships where workspace_id = ${workspaceId} and user_id = ${claimantId}`,
  ).toEqual([{ count: 1 }]);
});
```

Also assert that conflicting profile identity fails atomically and that adding a participant whose `profiles.github_user_id` is already linked immediately creates a normal membership without a pending task state.

- [ ] **Step 4: Implement owner/admin seat addition**

Create `src/server/cohort/add-cohort-seat.ts` with this signature and transaction order:

```ts
export async function addCohortSeat(input: {
  actorId: string;
  workspaceId: string;
  participant: CohortDirectoryEntry;
  occurredAt: Date;
}): Promise<CohortSeatView>;
```

Inside one `database().begin` transaction: lock the actor's membership and require role `owner` or `admin`; return `NOT_FOUND / Workspace not found.` for every missing or unauthorized case; lock an existing `(workspace_id, github_user_id)` seat; find a profile linked by `github_user_id`; insert a new seat with `user_id` and `claimed_at` only when that profile exists; insert membership role `member` with `on conflict do nothing` without downgrading an owner/admin; if an existing pending seat now has a linked profile, update tasks to the active profile before marking the seat claimed; return a `CohortSeatView` whose profile URL is derived as `https://github.com/${github_handle}`. Repeated additions return the same seat ID.

- [ ] **Step 5: Implement the idempotent claim transaction**

Create `src/server/cohort/claim-cohort-seats.ts`. The implementation must execute this order inside one `database().begin` callback:

```ts
await sql`
  insert into public.profiles (id, display_name, timezone, motivation_tone)
  values (${input.actorId}, ${input.identity.displayName}, 'UTC', 'friendly')
  on conflict (id) do nothing
`;
await sql`insert into public.motivation_preferences (user_id) values (${input.actorId}) on conflict do nothing`;

const [profile] = await sql<Array<{ github_user_id: string | null }>>`
  select github_user_id::text from public.profiles where id = ${input.actorId} for update
`;
if (
  !profile ||
  (profile.github_user_id !== null &&
    profile.github_user_id !== input.identity.githubUserId)
) {
  throw new AppError(
    "CONFLICT",
    "That Momentum profile is linked to a different GitHub identity.",
  );
}

const [conflictingProfile] = await sql<Array<{ id: string }>>`
  select id from public.profiles
  where github_user_id = ${input.identity.githubUserId}::bigint
    and id <> ${input.actorId}
  for update
`;
if (conflictingProfile) {
  throw new AppError(
    "CONFLICT",
    "That GitHub identity is already linked to another Momentum profile.",
  );
}

await sql`
  update public.profiles set
    github_user_id = ${input.identity.githubUserId}::bigint,
    github_handle = ${input.identity.githubHandle},
    updated_at = ${input.occurredAt}
  where id = ${input.actorId}
`;
```

Then lock all seats for the stable GitHub ID; reject any claimed seat tied to another profile; gather pending seat IDs; insert missing memberships without changing existing roles; update every task referencing those pending seat IDs to set `assignee_id = actorId` and `cohort_seat_id = null`; only then mark the seats with `user_id` and `claimed_at`; return sorted unique workspace IDs and counts based on `returning` arrays. A repeat call sees no pending seat IDs and returns zero mutation counts.

- [ ] **Step 6: Run focused unit and integration tests, then commit**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/server/auth/github-identity.test.ts
pnpm test:integration -- tests/integration/cohort-assignment.test.ts
pnpm typecheck
```

Expected: identity tests and cohort integration tests PASS; type checking exits 0.

Commit:

```bash
git add src/server/auth/github-identity.ts src/server/auth/github-identity.test.ts \
  src/server/cohort/add-cohort-seat.ts src/server/cohort/claim-cohort-seats.ts \
  tests/integration/cohort-assignment.test.ts
git commit -m "feat: claim cohort assignments through verified identity"
```

---

### Task 4: Additive GitHub OAuth initiation and callback

**Files:**

- Create: `src/server/auth/application-origin.ts`
- Create: `src/server/auth/application-origin.test.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/features/auth/github-oauth-button.tsx`
- Create: `src/features/auth/auth-error-notice.tsx`
- Modify: `src/features/auth/actions.ts`
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Modify: `src/app/(auth)/sign-up/page.tsx`
- Modify: `src/proxy.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `readApplicationOrigin(env?: NodeJS.ProcessEnv): string`.
- Produces: `startGitHubOAuthAction(): Promise<never>`.
- Consumes: `extractVerifiedGitHubIdentity` and `claimCohortSeats` from Task 3.
- `/auth/callback` is public only for code exchange; every protected application route remains behind the current proxy session check.

- [ ] **Step 1: Write and run failing origin tests**

Create `src/server/auth/application-origin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readApplicationOrigin } from "./application-origin";

describe("readApplicationOrigin", () => {
  it("returns an origin without paths or query strings", () => {
    expect(
      readApplicationOrigin({
        NEXT_PUBLIC_APP_URL: "https://momentum.example/path?q=1",
      }),
    ).toBe("https://momentum.example");
  });
  it("allows HTTP only for loopback development", () => {
    expect(
      readApplicationOrigin({ NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" }),
    ).toBe("http://127.0.0.1:3000");
    expect(() =>
      readApplicationOrigin({ NEXT_PUBLIC_APP_URL: "http://momentum.example" }),
    ).toThrow("NEXT_PUBLIC_APP_URL must use HTTPS outside local development.");
  });
  it("requires an explicit application URL", () => {
    expect(() => readApplicationOrigin({})).toThrow(
      "NEXT_PUBLIC_APP_URL is required.",
    );
  });
});
```

Run `pnpm exec vitest run --config vitest.config.ts src/server/auth/application-origin.test.ts`; expect a missing-module failure.

- [ ] **Step 2: Implement the trusted origin and OAuth start action**

Create the origin helper using `new URL`, returning `url.origin`, accepting HTTP only for `localhost`, `127.0.0.1`, or `[::1]`. Add `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000` and optional blank `GITHUB_DIRECTORY_TOKEN=` to `.env.example`; document that neither value is an OAuth client secret.

Create `src/server/auth/application-origin.ts`:

```ts
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function readApplicationOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL is required.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be an absolute URL.");
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))
  ) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must use HTTPS outside local development.",
    );
  }
  return url.origin;
}
```

Append to `src/features/auth/actions.ts`:

```ts
export async function startGitHubOAuthAction(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  const redirectTo = `${readApplicationOrigin()}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo, scopes: "read:user user:email" },
  });
  if (error || !data.url) redirect("/sign-in?authError=github-start");
  redirect(data.url);
}
```

Import `readApplicationOrigin`; keep current password actions unchanged.

- [ ] **Step 3: Implement the callback with safe failure codes**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractVerifiedGitHubIdentity } from "@/server/auth/github-identity";
import { readApplicationOrigin } from "@/server/auth/application-origin";
import { requestNow } from "@/server/clock";
import { claimCohortSeats } from "@/server/cohort/claim-cohort-seats";
import { logServerEvent } from "@/server/observability/logger";

function destination(path: string): URL {
  return new URL(path, readApplicationOrigin());
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  if (!code)
    return NextResponse.redirect(destination("/sign-in?authError=github-code"));
  const supabase = await createServerSupabaseClient();
  try {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
    const authenticated = await supabase.auth.getUser();
    if (authenticated.error || !authenticated.data.user)
      throw authenticated.error;
    const identity = extractVerifiedGitHubIdentity(
      authenticated.data.user.identities,
    );
    await claimCohortSeats({
      actorId: authenticated.data.user.id,
      identity,
      occurredAt: await requestNow(),
    });
    return NextResponse.redirect(destination("/dashboard"));
  } catch {
    await supabase.auth.signOut();
    logServerEvent({
      level: "warn",
      event: "github_oauth_failed",
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
      routeType: "route",
      code: "UNAUTHORIZED",
    });
    return NextResponse.redirect(
      destination("/sign-in?authError=github-claim"),
    );
  }
}
```

Do not log the OAuth code, raw error, GitHub handle, email, or task data.

- [ ] **Step 4: Add the OAuth button and supportive error presentation**

Create `GitHubOAuthButton` as a server-rendered `<form action={startGitHubOAuthAction}>` containing the existing `Button` with `type="submit"`, `variant="outline"`, full width, and label `Continue with GitHub`. Create `AuthErrorNotice` with a fixed map:

```ts
// src/features/auth/github-oauth-button.tsx
import { Button } from "@/components/ui/button";
import { startGitHubOAuthAction } from "@/features/auth/actions";

export function GitHubOAuthButton() {
  return (
    <form action={startGitHubOAuthAction}>
      <Button type="submit" variant="outline" className="w-full" size="lg">
        Continue with GitHub
      </Button>
    </form>
  );
}

// src/features/auth/auth-error-notice.tsx
const AUTH_ERRORS = {
  "github-start": "GitHub sign-in could not start. Please try again.",
  "github-code": "GitHub did not return a usable sign-in. Please try again.",
  "github-claim":
    "We signed you in, but could not connect your pending work yet. Please try GitHub again.",
} as const;

export function AuthErrorNotice({ code }: { code?: string }) {
  const message =
    code && Object.hasOwn(AUTH_ERRORS, code)
      ? AUTH_ERRORS[code as keyof typeof AUTH_ERRORS]
      : null;
  return message ? (
    <p
      className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
      role="alert"
    >
      {message}
    </p>
  ) : null;
}
```

Change each auth page to accept `searchParams: Promise<{ authError?: string }>`; render the OAuth button above an accessible `or continue with email` divider and render `AuthErrorNotice` only for a recognized code. Keep the existing email/password forms and links.

- [ ] **Step 5: Make only the callback public and run auth regression tests**

In `src/proxy.ts`, change the public predicate to include `pathname === "/auth/callback"`; do not treat any other `/auth/*` path as public.

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/server/auth/application-origin.test.ts \
  src/server/auth/github-identity.test.ts \
  src/server/auth/proxy-cookies.test.ts
pnpm lint
pnpm typecheck
```

Expected: all focused tests PASS, lint and strict type checking exit 0.

- [ ] **Step 6: Commit the OAuth web boundary**

```bash
git add .env.example src/app/auth/callback src/app/'(auth)' \
  src/features/auth src/server/auth/application-origin.ts \
  src/server/auth/application-origin.test.ts src/proxy.ts
git commit -m "feat: add GitHub OAuth sign-in and claim callback"
```

---

### Task 5: Workspace Team section and authorized cohort addition

**Files:**

- Create: `src/features/cohort/schemas.ts`
- Create: `src/features/cohort/schemas.test.ts`
- Create: `src/features/cohort/actions.ts`
- Create: `src/features/cohort/add-cohort-member-dialog.tsx`
- Create: `src/features/cohort/team-section.tsx`
- Create: `src/server/workspaces/require-workspace-manager.ts`
- Modify: `src/server/types.ts`
- Modify: `src/server/workspaces/get-workspace-overview.ts`
- Modify: `src/app/(app)/workspaces/[workspaceId]/page.tsx`

**Interfaces:**

- Extends `WorkspaceOverview` with `members: WorkspaceMemberView[]` and `pendingCohortSeats: PendingCohortSeatView[]`.
- Produces: `addCohortSeatAction(previous, formData): Promise<ActionResult<CohortSeatView> | null>`.
- Produces: `requireWorkspaceManager(input: { actorId: string; workspaceId: string }): Promise<void>`.
- Consumes: `getCohortDirectory`, `resolveCohortParticipant`, and `addCohortSeat`.

- [ ] **Step 1: Write the failing form-schema test**

Create `src/features/cohort/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addCohortSeatSchema } from "./schemas";

describe("addCohortSeatSchema", () => {
  it("normalizes a valid handle", () => {
    expect(
      addCohortSeatSchema.parse({
        workspaceId: crypto.randomUUID(),
        githubHandle: " KPerpignant ",
      }).githubHandle,
    ).toBe("kperpignant");
  });
  it("rejects invalid handles and workspace IDs", () => {
    expect(
      addCohortSeatSchema.safeParse({
        workspaceId: "wrong",
        githubHandle: "two--hyphens",
      }).success,
    ).toBe(false);
  });
});
```

Implement the schema with `z.uuid()` and a `z.string().transform` that calls `normalizeGitHubHandle` and emits a custom issue when it returns null.

- [ ] **Step 2: Extend workspace view types and query**

Add these contracts to `src/server/types.ts`:

```ts
export interface WorkspaceMemberView {
  id: string;
  displayName: string;
  role: MembershipRole;
  githubHandle: string | null;
}

export interface PendingCohortSeatView {
  id: string;
  workspaceId: string;
  githubUserId: string;
  githubHandle: string;
  profileUrl: string;
  userId: null;
  claimedAt: null;
}
```

Extend `WorkspaceOverview` with `members` and `pendingCohortSeats`. In `getWorkspaceOverview`, after authorization, load projects, active memberships/profiles, and `workspace_cohort_seats where user_id is null` in one `Promise.all`. Map `github_user_id::text`, normalized handle, role, and `https://github.com/${handle}`. All queries join the actor membership or reuse the already-authorized workspace ID; outsiders continue receiving the existing safe not-found error.

- [ ] **Step 3: Implement the server action**

Create `src/server/workspaces/require-workspace-manager.ts` as a server-only read check. Query `workspace_memberships` for the exact workspace and actor with `role in ('owner', 'admin')`; otherwise throw `AppError("NOT_FOUND", "Workspace not found.")`. This check intentionally runs before the external lookup for abuse resistance. The `addCohortSeat` transaction from Task 3 repeats and locks the same authorization so a role change between read and write cannot authorize a stale request.

Create `src/features/cohort/actions.ts`:

```ts
"use server";

export type AddCohortSeatState = ActionResult<CohortSeatView> | null;

export async function addCohortSeatAction(
  _previous: AddCohortSeatState,
  formData: FormData,
): Promise<AddCohortSeatState> {
  const parsed = addCohortSeatSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    githubHandle: formData.get("githubHandle"),
  });
  if (!parsed.success)
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the GitHub username, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    const user = await requireUser();
    await requireWorkspaceManager({
      actorId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    const [participant, occurredAt] = await Promise.all([
      resolveCohortParticipant(parsed.data.githubHandle),
      requestNow(),
    ]);
    const seat = await addCohortSeat({
      actorId: user.id,
      workspaceId: parsed.data.workspaceId,
      participant,
      occurredAt,
    });
    revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
    return { ok: true, data: seat };
  } catch (error) {
    if (error instanceof TypeError)
      return {
        ok: false,
        code: "NOT_FOUND",
        message:
          "We could not verify that GitHub account yet. Check the username or try again.",
      };
    return actionFailure(error);
  }
}
```

- [ ] **Step 4: Build the accessible Team UI**

`AddCohortMemberDialog` receives `{ workspaceId, directory }`, searches `displayName` and `githubHandle` client-side with a labeled input, shows at most eight matching buttons, allows the normalized exact typed handle, and submits only `workspaceId` plus `githubHandle`. It closes after success, refreshes the router, announces `@handle is ready for assignments.`, disables controls while pending, and displays the action's safe error.

`TeamSection` renders an accessible section heading, active rows with display name/role/optional `@handle`, and pending rows with the exact copy `Waiting for @handle to join`. Pending profile links open the public GitHub URL. Show Add cohort member only for owner/admin. Show the directory source timestamp when the snapshot is in use.

In the workspace page, call `getCohortDirectory()` only when `actorRole` is owner/admin, render `TeamSection` before projects, and keep project creation behavior unchanged.

- [ ] **Step 5: Run focused and integration tests, then commit**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/cohort/schemas.test.ts
pnpm test:integration -- tests/integration/cohort-assignment.test.ts
pnpm lint
pnpm typecheck
```

Expected: focused unit and cohort integration tests PASS; lint and type checking exit 0.

Commit:

```bash
git add src/features/cohort src/server/types.ts \
  src/server/workspaces/require-workspace-manager.ts \
  src/server/workspaces/get-workspace-overview.ts \
  src/app/'(app)'/workspaces/'[workspaceId]'/page.tsx
git commit -m "feat: add cohort participants from workspace Team"
```

---

### Task 6: Discriminated active-or-pending task assignment services

**Files:**

- Create: `src/server/tasks/resolve-task-assignee.ts`
- Modify: `src/server/types.ts`
- Modify: `src/domain/tasks/task-permissions.ts`
- Modify: `src/domain/tasks/task-permissions.test.ts`
- Modify: `src/features/tasks/schemas.ts`
- Modify: `src/features/tasks/schemas.test.ts`
- Modify: `src/features/tasks/actions.ts`
- Modify: `src/server/tasks/create-task.ts`
- Modify: `src/server/tasks/update-task.ts`
- Modify: `tests/integration/achievements-and-motivation.test.ts`
- Modify: `tests/integration/deadline-nudges.test.ts`
- Modify: `tests/integration/notifications.test.ts`
- Modify: `tests/integration/project-and-task-authorization.test.ts`
- Modify: `tests/integration/cohort-assignment.test.ts`

**Interfaces:**

- Produces: `TaskAssigneeRef = { kind: "member"; userId: string } | { kind: "cohort"; seatId: string }`.
- Produces: `resolveTaskAssignee(sql, workspaceId, ref): Promise<ResolvedTaskAssignee>` where the result has nullable `assigneeId`, nullable `cohortSeatId`, and `pending`.
- Changes `createTask` and `updateTask` inputs from `assigneeId: string` to `assignee: TaskAssigneeRef`.
- Changes `TaskPermissionInput.assigneeId` to `string | null`; null means no movement or completion controls.

- [ ] **Step 1: Extend failing permission and schema tests**

Add to `task-permissions.test.ts`:

```ts
it("lets a creator edit but not move or complete a pending cohort task", () => {
  expect(
    getTaskPermissions({
      actorId: "creator",
      role: "member",
      createdBy: "creator",
      assigneeId: null,
      firstCompletedAt: null,
    }),
  ).toEqual({
    canEdit: true,
    canReassign: true,
    canMove: false,
    canComplete: false,
  });
});
```

Change task schema tests so valid member and cohort inputs parse to these exact values:

```ts
{ kind: "member", userId: crypto.randomUUID() }
{ kind: "cohort", seatId: crypto.randomUUID() }
```

Reject mismatched keys, unknown kinds, and non-UUID IDs.

- [ ] **Step 2: Define assignee contracts and resolver**

Add to `src/server/types.ts`:

```ts
export type TaskAssigneeRef =
  { kind: "member"; userId: string } | { kind: "cohort"; seatId: string };
```

Create `resolve-task-assignee.ts` with `postgres.TransactionSql`. For `member`, lock and require the `(workspace_id, user_id)` membership and return `{ assigneeId: userId, cohortSeatId: null, pending: false }`. For `cohort`, lock and require a seat in the same workspace with `user_id is null`, then return `{ assigneeId: null, cohortSeatId: seatId, pending: true }`. Every failed lookup throws `AppError("NOT_FOUND", "Task not found.")`.

Use this exact result type in that module:

```ts
import "server-only";

import type postgres from "postgres";

import { AppError } from "@/server/errors";
import type { TaskAssigneeRef } from "@/server/types";

export type ResolvedTaskAssignee =
  | { assigneeId: string; cohortSeatId: null; pending: false }
  | { assigneeId: null; cohortSeatId: string; pending: true };

export async function resolveTaskAssignee(
  sql: postgres.TransactionSql,
  workspaceId: string,
  assignee: TaskAssigneeRef,
): Promise<ResolvedTaskAssignee> {
  if (assignee.kind === "member") {
    const [membership] = await sql<Array<{ user_id: string }>>`
      select user_id from public.workspace_memberships
      where workspace_id = ${workspaceId} and user_id = ${assignee.userId}
      for key share
    `;
    if (!membership) throw new AppError("NOT_FOUND", "Task not found.");
    return {
      assigneeId: membership.user_id,
      cohortSeatId: null,
      pending: false,
    };
  }

  const [seat] = await sql<Array<{ id: string }>>`
    select id from public.workspace_cohort_seats
    where id = ${assignee.seatId}
      and workspace_id = ${workspaceId}
      and user_id is null
    for key share
  `;
  if (!seat) throw new AppError("NOT_FOUND", "Task not found.");
  return { assigneeId: null, cohortSeatId: seat.id, pending: true };
}
```

- [ ] **Step 3: Change validated form input to the discriminated reference**

In `features/tasks/schemas.ts`, replace `assigneeId` with:

```ts
assignee: z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("member"), userId: z.uuid() }),
  z.object({ kind: z.literal("cohort"), seatId: z.uuid() }),
]),
```

In actions, read `assigneeKind` and `assigneeId`, build the matching object before `safeParse`, and pass `assignee: parsed.data.assignee` to both services. Return the assignee validation message under `fieldErrors.assigneeId` so the existing dialog has one accessible error target.

- [ ] **Step 4: Update task creation and update transactions**

In `createTask`, resolve the assignee after locking the project. Use `initialStatus = resolved.pending ? "todo" : input.status === "done" ? "todo" : input.status`; require active self-assignment for a requested initial completion; insert both nullable IDs; delegate an active requested completion to the unchanged `completeTaskInTransaction`.

In `updateTask`, select both IDs, pass nullable `assignee_id` to permissions, compare assignee references structurally, reject reassignment after first completion, resolve the new assignee inside the same transaction, force pending status to `todo`, update both columns together, and invoke completion only for an active assignee matching the actor. The existing complete service, Focus service, and move service already require `task.assignee_id = actorId`, so pending tasks remain excluded by query as well as constraints.

Update permission logic to:

```ts
const active = input.assigneeId !== null;
const assignee = input.assigneeId === input.actorId;
return {
  canEdit,
  canReassign: canEdit && input.firstCompletedAt === null,
  canMove: active && (canEdit || assignee),
  canComplete: active && assignee,
};
```

- [ ] **Step 5: Update all existing service callers mechanically**

In the four existing integration files, replace each `assigneeId: value` passed to `createTask` or `updateTask` with:

```ts
assignee: { kind: "member", userId: value },
```

Do not alter expected rewards, authorization outcomes, dates, statuses, or idempotency assertions. Add cohort integration assertions that a pending task is returned as To Do even when creation requests In Progress, and that `selectFocusTask`, `moveTask`, and `completeTask` reject it without creating focus, completion, ledger, streak, achievement, or notification rows.

- [ ] **Step 6: Run task unit and all integration tests, then commit**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/domain/tasks/task-permissions.test.ts \
  src/features/tasks/schemas.test.ts
pnpm test:integration
pnpm typecheck
```

Expected: focused unit tests and all integration suites PASS; type checking exits 0.

Commit:

```bash
git add src/domain/tasks src/features/tasks/actions.ts src/features/tasks/schemas.ts \
  src/features/tasks/schemas.test.ts src/server/tasks src/server/types.ts \
  tests/integration
git commit -m "feat: support pending cohort task assignees"
```

---

### Task 7: Pending task presentation and assignee board filter

**Files:**

- Create: `src/features/tasks/assignee-filter.ts`
- Create: `src/features/tasks/assignee-filter.test.ts`
- Modify: `src/server/types.ts`
- Modify: `src/server/projects/get-project-board.ts`
- Modify: `src/features/tasks/task-form-dialog.tsx`
- Modify: `src/features/tasks/task-card.tsx`
- Modify: `src/features/tasks/kanban-board.tsx`

**Interfaces:**

- Produces discriminated `TaskAssigneeView` and `TaskAssigneeOption` view types.
- Produces `AssigneeFilter` for all, self, member-key, and cohort-key values, plus `filterTasksByAssignee(tasks, filter, actorId): TaskView[]`.
- Board options use encoded browser-only keys `member:<uuid>` and `cohort:<uuid>`; server actions still receive separate validated kind and UUID fields.

- [ ] **Step 1: Write the failing filter test**

Create `src/features/tasks/assignee-filter.test.ts` with one active self task, one other active task, and one pending seat task. Assert `all`, `me`, `member:<id>`, and `cohort:<id>` results, plus an invalid filter falling back to all tasks. Keep the objects typed as `TaskView` so view-contract drift fails compilation.

- [ ] **Step 2: Add the discriminated board view types**

Replace flat assignee fields in `TaskView` with:

```ts
export type TaskAssigneeView =
  | { kind: "member"; userId: string; displayName: string }
  | {
      kind: "cohort";
      seatId: string;
      githubHandle: string;
      profileUrl: string;
    };

export type TaskAssigneeOption =
  | { kind: "member"; userId: string; label: string }
  | { kind: "cohort"; seatId: string; label: string; githubHandle: string };
```

`TaskView` keeps `isCurrentUsersTask`, but derives it from the member variant. `ProjectBoardView` replaces `members` with `assignees: TaskAssigneeOption[]`.

- [ ] **Step 3: Update the authorized board query**

In `getProjectBoard`, left join `profiles` on `task.assignee_id` and `workspace_cohort_seats` on `task.cohort_seat_id`. Select both nullable IDs, profile display name, seat handle, and first-completion fields. Load active members plus pending seats for the workspace and map them to `board.assignees`. Map each task to the correct discriminated assignee; throw an internal error if neither valid variant can be constructed. Pass nullable active ID to `getTaskPermissions`; pending tasks therefore receive edit/reassign only and no movement/completion controls.

- [ ] **Step 4: Update the task dialog and cards**

In `TaskFormDialog`, track one encoded select value. Decode it into hidden `assigneeKind` and `assigneeId` fields. Render active options as their display name and pending options as `@handle — awaiting GitHub sign-in`. When pending is selected, immediately set status to `todo`, render only the To Do status option, and set `canChooseDone` false. Completed tasks keep the assignee control frozen.

In `TaskCard`, render active display names normally. For the cohort variant, render a linked `@handle` plus the exact badge/copy `Waiting for GitHub sign-in`. Do not render Focus, Start, Complete, Reopen, or movement controls for a cohort variant even if a future permission regression occurs; owners/admins/creators may still receive the edit control.

- [ ] **Step 5: Add the labeled board filter and empty state**

Implement `filterTasksByAssignee` as a pure function. In `KanbanBoard`, add a labeled native select above the columns with All assignees, Me, every active member, and every pending handle. Filter before splitting into status columns. When the entire filtered result is empty, show `No tasks match this assignee. Show all assignees to reset the board.` with a reset button. Keep column counts based on filtered tasks and retain the existing three columns.

The pure module exports this exact signature:

```ts
import type { TaskView } from "@/server/types";

export type AssigneeFilter =
  "all" | "me" | `member:${string}` | `cohort:${string}`;

export function filterTasksByAssignee(
  tasks: readonly TaskView[],
  filter: AssigneeFilter,
  actorId: string,
): TaskView[] {
  if (filter === "all") return [...tasks];
  if (filter === "me") {
    return tasks.filter(
      (task) =>
        task.assignee.kind === "member" && task.assignee.userId === actorId,
    );
  }
  const separator = filter.indexOf(":");
  const kind = filter.slice(0, separator);
  const id = filter.slice(separator + 1);
  if (!id || (kind !== "member" && kind !== "cohort")) return [...tasks];
  return tasks.filter((task) =>
    kind === "member"
      ? task.assignee.kind === "member" && task.assignee.userId === id
      : task.assignee.kind === "cohort" && task.assignee.seatId === id,
  );
}
```

- [ ] **Step 6: Run UI-domain regression tests and commit**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/features/tasks/assignee-filter.test.ts \
  src/domain/tasks/task-permissions.test.ts \
  src/features/tasks/schemas.test.ts
pnpm test:integration
pnpm lint
pnpm typecheck
```

Expected: focused tests and integrations PASS; lint and strict type checking exit 0.

Commit:

```bash
git add src/features/tasks src/server/projects/get-project-board.ts src/server/types.ts
git commit -m "feat: show and filter cohort task assignments"
```

---

### Task 8: Cross-layer exactly-once and owner browser flow

**Files:**

- Modify: `tests/integration/cohort-assignment.test.ts`
- Create: `tests/e2e/cohort-assignment.spec.ts`

**Interfaces:**

- Consumes all prior services and UI.
- Local Playwright exercises owner directory search, pending seat creation, task assignment, pending restrictions, and assignee filtering without external OAuth.
- Integration exercises verified claim and the normal completion flow without mocking trusted reward code.

- [ ] **Step 1: Complete the post-claim integration happy path**

After the first successful claim, assert the task now has `assignee_id = claimant`, `cohort_seat_id = null`, the seat is claimed, and membership exists. Then call the real services to select Focus, move to In Progress, complete, reopen, and recomplete. Assert one `task_completions` row, the expected positive ledger rows for that one completion, one streak transition, no duplicate achievement grant, and no duplicate completion notification. Do not assert a hard-coded point total unless the fixture fixes effort, deadline, and pre-completion streak; when fixed, calculate the expected value through the existing domain function.

- [ ] **Step 2: Write the deterministic owner-side Playwright test**

Create `tests/e2e/cohort-assignment.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("owner assigns a pending cohort participant and filters the board", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill("Cohort Demo Owner");
  await page.getByLabel("Email").fill(`cohort-owner-${suffix}@example.com`);
  await page.getByLabel("Password").fill("momentum-test-password");
  await page.getByLabel("Timezone").fill("America/New_York");
  await page
    .getByRole("button", { name: "Create my Momentum account" })
    .click();
  await page.getByLabel("Workspace name").fill("Cohort Assignment Workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByLabel("Project name").fill("Peer Demo Project");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("link", { name: "Cohort Assignment Workspace" }).click();
  await page.getByRole("button", { name: "Add cohort member" }).click();
  await page.getByLabel("GitHub username").fill("kperpignant");
  await page
    .getByRole("button", { name: /kperpignant/i })
    .first()
    .click();
  await page.getByRole("button", { name: "Add to workspace" }).click();
  await expect(
    page.getByText("Waiting for @kperpignant to join"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Peer Demo Project" }).click();
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill("Review the demo story");
  await page
    .getByLabel("Assignee")
    .selectOption({ label: "@kperpignant — awaiting GitHub sign-in" });
  await expect(page.getByLabel("Status")).toHaveValue("todo");
  await page.getByRole("button", { name: "Create task" }).click();

  const card = page
    .getByTestId(/task-/)
    .filter({ hasText: "Review the demo story" });
  await expect(card.getByText("Waiting for GitHub sign-in")).toBeVisible();
  await expect(
    card.getByRole("button", {
      name: /Choose as Focus|Start task|Complete task/,
    }),
  ).toHaveCount(0);
  await page
    .getByLabel("Assignee filter")
    .selectOption({ label: "@kperpignant" });
  await expect(card).toBeVisible();
  await page.getByLabel("Assignee filter").selectOption({ label: "Me" });
  await expect(card).toHaveCount(0);
});
```

If the workspace navigation link has a different accessible name, use the existing switcher behavior rather than introducing a test-only route.

- [ ] **Step 3: Run the focused integration and Playwright suites**

Run:

```bash
pnpm test:integration -- tests/integration/cohort-assignment.test.ts
pnpm test:e2e -- tests/e2e/cohort-assignment.spec.ts
```

Expected: both suites PASS. Playwright uses `MOMENTUM_ENVIRONMENT=test`, so the directory adapter uses the committed snapshot and performs no GitHub network call.

- [ ] **Step 4: Commit cross-layer coverage**

```bash
git add tests/integration/cohort-assignment.test.ts tests/e2e/cohort-assignment.spec.ts
git commit -m "test: cover cohort assignment and claim flow"
```

---

### Task 9: OAuth deployment and staff-review documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/demo-script.md`
- Modify: `docs/closed-pilot-checklist.md`

**Interfaces:**

- Documents the exact hosted GitHub/Supabase/Vercel configuration without recording secrets.
- Documents what automated tests cover and that real OAuth requires a two-account manual smoke test.
- Keeps the public production URL and current known limitations honest.

- [ ] **Step 1: Update local setup and architecture documentation**

In README, add `NEXT_PUBLIC_APP_URL`, optional `GITHUB_DIRECTORY_TOKEN`, the server-only directory/snapshot boundary, pending cohort seats, verified claim transaction, and the command `pnpm test:e2e -- tests/e2e/cohort-assignment.spec.ts`. State that local CI does not contact GitHub OAuth and that email/password remains available.

- [ ] **Step 2: Add exact production OAuth provisioning steps**

In `docs/deployment.md`, add this sequence:

1. Create a GitHub OAuth App with homepage `https://momentum-bay-two.vercel.app` and authorization callback `https://mggneeapcgozymqnsjlk.supabase.co/auth/v1/callback`.
2. Enter the GitHub client ID and secret only in Supabase Dashboard → Authentication → Providers → GitHub.
3. Add `https://momentum-bay-two.vercel.app/auth/callback` to Supabase Authentication redirect URLs.
4. Set `NEXT_PUBLIC_APP_URL=https://momentum-bay-two.vercel.app` in Vercel Production and Preview with the correct preview URL policy; optionally set server-only `GITHUB_DIRECTORY_TOKEN` for rate limits.
5. Apply migration `202607180005_cohort_assignment_github_oauth.sql` manually to the production Supabase project before deploying the new application build.
6. Never paste either OAuth secret or directory token into GitHub source, Vercel public variables, PR text, logs, or screenshots.

- [ ] **Step 3: Update the five-minute demo and checklist**

Document the owner add/assign/filter path, a second real GitHub account signing in and auto-claiming, normal Focus/start/complete behavior, reload persistence, and reopen/recomplete exactly-once verification. Add mobile-width, outsider URL, open self-service signup, public repository access, `/api/health`, and secret scan checks. List manual identity linking, removal/roles UI, invitation delivery, and GitHub organization enforcement as deliberate exclusions.

- [ ] **Step 4: Validate documentation and commit**

Run:

```bash
CI=true pnpm exec prettier --check README.md docs .env.example
git diff --check
```

Expected: Prettier reports all matched files use its style and diff check exits 0.

Commit:

```bash
git add README.md docs/deployment.md docs/demo-script.md docs/closed-pilot-checklist.md
git commit -m "docs: add cohort OAuth deployment and demo runbook"
```

---

### Task 10: Full release gate, hosted migration, and two-account smoke test

**Files:**

- Modify only files changed mechanically by the repository formatter if formatting differs.
- Do not edit migration history after it has been applied to hosted Supabase; add a new corrective migration if a hosted fix is required.

**Interfaces:**

- Verifies every repository command required by `AGENTS.md`.
- Verifies public production with two real GitHub accounts.
- Produces an evidence-based staff-review comment without claiming unrun checks.

- [ ] **Step 1: Run formatting and static validation**

```bash
CI=true pnpm format
git diff --check
CI=true pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:secrets
```

Expected: every command exits 0. Inspect formatter changes before staging; no unrelated file may be rewritten silently.

- [ ] **Step 2: Run all automated tests and production build**

```bash
pnpm test:unit
pnpm test:db
pnpm test:integration
pnpm test:e2e
pnpm test:demo
pnpm test:e2e:demo
pnpm build
```

Expected: every command exits 0. Record exact suite and test counts from the output; do not infer or round them.

- [ ] **Step 3: Review the final source diff and dependency state**

```bash
git status --short
git diff --stat HEAD~9..HEAD
git diff --check HEAD~9..HEAD
git diff HEAD~9..HEAD -- package.json pnpm-lock.yaml
```

Expected: source diff matches this plan, diff check is clean, and the dependency diff is empty.

- [ ] **Step 4: Apply and deploy in safe order**

Configure the GitHub OAuth App, Supabase provider, redirect allow-list, and Vercel application URL exactly as Task 9 documents. Apply the migration to the production Supabase project, deploy the tested commit, then verify:

```bash
curl -fsS https://momentum-bay-two.vercel.app/api/health
```

Expected: HTTP success with sanitized healthy JSON and the deployed release matching the commit being reviewed.

- [ ] **Step 5: Run the manual two-account production smoke test**

Use an owner browser session and a separate private/incognito GitHub account:

1. Sign up or sign in as owner; add the second account's exact GitHub handle.
2. Assign a new To Do task to the pending handle and verify no Focus/start/complete controls.
3. Filter the board to that pending handle.
4. In the second session, Continue with GitHub and verify automatic workspace/task access.
5. Choose Focus, start, complete, reload dashboard, and verify points/streak/achievement/progress/notification persist.
6. Reopen and recomplete; verify no second ledger or reward result.
7. As the second user, try an unrelated workspace URL; verify safe not-found behavior.
8. Repeat the key board and dialog checks at 390px width.

- [ ] **Step 6: Commit any formatter-only corrections and prepare review evidence**

If Step 1 changed formatting, commit only those reviewed changes:

```bash
git add .
git commit -m "chore: format cohort assignment slice"
```

Prepare the PR/staff update with: public repository URL, production URL, deployed commit, open signup path, two-account test path, exact automated validation results, and the deliberate exclusions from Task 9. Never include credentials, tokens, OAuth codes, or private account data.

## Definition of done

- A public reviewer can use open email/password signup or Continue with GitHub.
- An owner/admin can discover or exactly resolve a real GitHub handle and add it without an operator or database edit.
- A pending participant appears in Team and can be selected in task creation.
- A pending task is visibly To Do and cannot Focus, start, complete, or reach reward side effects.
- Supabase's verified stable GitHub ID atomically claims every matching seat, membership, and pending task.
- Repeated OAuth callbacks are idempotent.
- The claimed participant can use the normal Focus/start/complete flow.
- Reopening and recompleting still produces no duplicate completion, ledger, streak, achievement, or notification.
- The board filters by Me, active member, or pending cohort handle.
- Owner/admin, ordinary member, outsider, cross-workspace, and identity-conflict cases have automated coverage.
- The committed cohort snapshot keeps the owner-side path usable during GitHub outage or rate limiting.
- Email/password auth, existing demo data, reward calculations, streak transitions, achievements, notifications, and celebrations remain green.
- Formatting, linting, strict type checking, unit, database, integration, relevant Playwright, demo reproducibility, demo Playwright, secret scanning, and production build all pass.
- Production OAuth is configured without exposing secrets, and the two-account smoke test is recorded honestly.
- README, deployment, demo, and closed-pilot documentation reflect shipped behavior and remaining exclusions.
