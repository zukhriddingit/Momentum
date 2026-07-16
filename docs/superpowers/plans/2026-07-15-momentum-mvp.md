# Momentum MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Momentum MVP as a motivation-first, exactly-once task-completion workflow for small teams, beginning with a seeded user who can select and complete a Focus Task and see persisted rewards, streak, encouragement, notification, and project progress.

**Architecture:** Use a Next.js App Router modular monolith. Supabase provides cookie-based authentication, PostgreSQL, and RLS-protected reads; server-only application services validate and authorize commands, while a pooled PostgreSQL connection runs the completion workflow atomically. Pure TypeScript domain modules own points, workdays, streaks, achievements, message selection, and quiet-hours scheduling.

**Tech Stack:** Node.js 20.9+, pnpm, Next.js, strict TypeScript, Tailwind CSS, shadcn/ui-compatible components, Supabase Auth/PostgreSQL/CLI, `postgres`, Zod, Vitest, pgTAP, Playwright, Resend, and an SMS provider interface with a mock implementation.

## Global Constraints

- Preserve `AGENTS.md` and follow it for every slice.
- Use TypeScript with `strict: true`; do not use `any` or unchecked type assertions at external boundaries.
- Keep trusted reward, streak, achievement, motivation, and notification-timing logic outside React and on the server.
- Base points are Small 20, Medium 40, Large 70, and Extra Large 100.
- Timing multipliers are `1.20` at least 24 hours early, `1.10` before the deadline, and `1.00` otherwise or when no deadline exists.
- The streak multiplier is `1 + min(0.20, 0.04 * preCompletionStreak)`.
- Round the combined result once to the nearest whole point.
- A workday is Monday through Friday in the user's IANA timezone; public holidays are excluded.
- An unselected workday pauses the streak; a workday with a selected but
  incomplete Focus Task breaks it; weekends do neither.
- One Focus Task is allowed globally per user per workday.
- Late tasks retain full base points. Priority cannot affect points. Negative points are forbidden.
- A task may create only one immutable completion receipt and one set of immutable ledger rows for its lifetime.
- Reopening and recompleting a task must not create points, a streak update, achievements, celebration, or notifications again.
- Calm, Friendly, Energetic, and Minimal messages are deterministic reviewed templates; no AI or shaming copy is allowed.
- Email and SMS are opt-in and respect quiet hours. Resend and mock SMS remain behind adapters.
- Do not add production dependencies without adding the rationale to `README.md`.
- Do not expose `DATABASE_URL`, Supabase server credentials, Resend keys, or internal job secrets to client code.
- Every task ends with its focused tests plus formatting, linting, and type checking for touched code.
- The complete release gate runs formatting, linting, type checking, unit tests, database tests, integration tests, the main Playwright flow, and the production build.

---

## 1. Proposed architecture

The browser talks only to Server Components for reads and Server Actions for user mutations. Server Actions validate input with Zod, resolve the current Supabase session, and invoke application services. User-facing reads use a session-bound Supabase client and RLS. Trusted multi-table commands use a server-only `postgres` connection and repeat membership/assignee checks inside each transaction.

The completion service is the sole owner of the first-completion transaction:

```text
validated action
  -> authenticated actor
  -> lock task, focus selection, and streak
  -> return existing receipt when task was completed before
  -> calculate points/streak/achievements/message in pure TypeScript
  -> persist task + receipt + ledger + streak + grants + in-app notification
  -> commit
  -> revalidate board/dashboard
  -> return authoritative celebration receipt
```

External notification rows are added to an outbox in the same transaction once preferences are implemented. Protected job routes create deadline nudges and deliver due outbox records. Provider failure never rolls back a task completion.

## 2. Database schema

| Relation                   | Purpose                                          | Required invariants                                                   |
| -------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `profiles`                 | Display name, timezone, tone                     | One row per `auth.users` ID                                           |
| `workspaces`               | Team tenant                                      | Creator is a profile                                                  |
| `workspace_memberships`    | Tenant membership and role                       | Unique workspace/user; owner/admin/member                             |
| `projects`                 | Workspace project                                | Always belongs to one workspace                                       |
| `tasks`                    | Assigned work and three-state board              | Assignee is a member; immutable first completion time                 |
| `focus_selections`         | One Focus Task for a work date                   | Unique user/date; only user's assigned task; completed rows immutable |
| `task_completions`         | Explainable first-completion receipt             | Unique task; immutable                                                |
| `point_ledger`             | Positive base/timing/streak entries              | Unique completion/kind; positive; update/delete rejected              |
| `focus_streaks`            | Current/longest Focus Streak                     | One row per user; longest >= current                                  |
| `achievement_definitions`  | Five seeded achievement rules                    | Stable code primary key                                               |
| `achievement_grants`       | Earned achievements                              | Unique user/code; immutable                                           |
| `notifications`            | Persisted in-app messages                        | Unique user/event/source                                              |
| `notification_preferences` | Tone, destinations, channel opt-ins, quiet hours | External destinations required only when channel enabled              |
| `notification_deliveries`  | Retryable email/SMS outbox                       | Unique notification/channel                                           |
| `project_progress`         | Derived task completion projection               | View; no synchronized summary table                                   |

Migrations are additive and slice-owned:

```text
supabase/migrations/202607150001_core.sql
supabase/migrations/202607150002_core_rls.sql
supabase/migrations/202607150003_focus.sql
supabase/migrations/202607150004_rewards.sql
supabase/migrations/202607150005_notifications.sql
supabase/migrations/202607150006_notification_delivery.sql
supabase/migrations/202607150007_deadline_nudges.sql
supabase/migrations/202607150008_security_hardening.sql
```

`supabase/seed.sql` is created in Slice 1 with the complete demonstration state needed by Milestone 1. Later migrations seed stable achievement definitions; later slices do not rewrite demonstration rows.

## 3. Directory structure

```text
src/
├── app/
│   ├── (auth)/sign-in/page.tsx
│   ├── (auth)/sign-up/page.tsx
│   ├── (app)/dashboard/page.tsx
│   ├── (app)/settings/notifications/page.tsx
│   ├── (app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx
│   ├── api/jobs/deadline-nudges/route.ts
│   ├── api/jobs/notification-deliveries/route.ts
│   ├── auth/callback/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/ui/
├── domain/
│   ├── achievements/
│   ├── motivation/
│   ├── notifications/
│   ├── rewards/
│   └── streaks/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── focus/
│   ├── notifications/
│   ├── projects/
│   └── tasks/
├── lib/
│   ├── env/
│   ├── supabase/
│   └── utils.ts
├── server/
│   ├── auth/
│   ├── dashboard/
│   ├── db/
│   ├── focus/
│   ├── notifications/
│   ├── projects/
│   ├── tasks/
│   └── workspaces/
└── types/database.ts

supabase/
├── config.toml
├── migrations/
├── seed.sql
└── tests/database/

tests/
├── e2e/
├── fixtures/
└── integration/
```

## 4. Domain-service responsibilities

These signatures are the cross-slice contracts. Implementers may split private helpers, but must not rename or widen these public inputs without updating dependent slices.

```ts
export type EffortLevel = "small" | "medium" | "large" | "extra_large";
export type MotivationTone = "calm" | "friendly" | "energetic" | "minimal";

export interface PointBreakdown {
  basePoints: number;
  timingMultiplier: 1 | 1.1 | 1.2;
  streakMultiplier: number;
  timingBonus: number;
  streakBonus: number;
  finalPoints: number;
}

export function calculatePointBreakdown(input: {
  effort: EffortLevel;
  dueAt: Date | null;
  completedAt: Date;
  preCompletionStreak: number;
}): PointBreakdown;

export interface StreakTransition {
  currentCount: number;
  longestCount: number;
  lastCompletedWorkDate: string;
  incremented: boolean;
}

export function calculateStreakTransition(input: {
  completionWorkDate: string;
  previous: {
    currentCount: number;
    longestCount: number;
    lastCompletedWorkDate: string | null;
  };
}): StreakTransition;

export function evaluateAchievements(
  input: CompletionAchievementSnapshot,
): AchievementCode[];

export function selectMotivationMessage(input: {
  sourceId: string;
  eventType: MotivationEventType;
  tone: MotivationTone;
  variables: Readonly<Record<string, string | number>>;
}): RenderedMotivationMessage;

export function scheduleExternalDelivery(input: {
  occurredAt: Date;
  timezone: string;
  quietHours: QuietHours;
}): Date;
```

Server services own I/O and authorization:

```ts
export function requireUser(): Promise<{ id: string; email: string | null }>;
export function getProjectBoard(input: {
  actorId: string;
  projectId: string;
}): Promise<ProjectBoardView>;
export function selectFocusTask(input: {
  actorId: string;
  taskId: string;
  occurredAt: Date;
}): Promise<FocusSelectionView>;
export function moveTask(input: {
  actorId: string;
  taskId: string;
  status: TaskStatus;
  occurredAt: Date;
}): Promise<TaskMutationReceipt>;
export function completeTask(input: {
  actorId: string;
  taskId: string;
  occurredAt: Date;
}): Promise<CompletionReceipt>;
export function getDashboard(input: {
  actorId: string;
  occurredAt: Date;
}): Promise<DashboardView>;
```

Notification adapters share one contract:

```ts
export interface NotificationProvider {
  readonly channel: "email" | "sms";
  send(message: ExternalNotificationMessage): Promise<ProviderSendResult>;
}
```

## 5. API and Server Action boundaries

There is no browser-facing CRUD REST API. Actions expose validated form commands:

```ts
export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };
```

- Auth: `signInAction`, `signUpAction`, `signOutAction`.
- Workspace/project: `createWorkspaceAction`, `createProjectAction`.
- Task: `createTaskAction`, `moveTaskAction`; `moveTaskAction` delegates Done to `completeTask`.
- Focus: `selectFocusTaskAction`.
- Preferences: `updateNotificationPreferencesAction`.
- Notifications: `markNotificationReadAction`.
- Internal routes: authenticated Supabase callback plus secret-protected deadline and delivery jobs.

Clients may send IDs, user-entered task fields, target status, profile tone/timezone, and notification preferences. They never send trusted points, multipliers, streak state, completion time, membership role, project progress, or delivery timing.

## 6. Security and authorization rules

- Session verification happens inside every protected action, service, Server Component query, and internal route.
- Workspace membership is checked for all tenant resources.
- Owners/admins create or edit projects; every member may create a task and assign it to an existing member of that workspace.
- Only an assignee completes their task. Owners/admins reassign rather than award for someone else.
- Only the current user selects their Focus Task, and the task must be assigned to them.
- Individual point ledgers, achievements, preferences, and notifications are private. Team progress is aggregate and unranked.
- RLS allows authorized reads and denies direct browser writes to trusted reward relations.
- Server-only modules import `server-only`. Environment schemas reject missing secrets at startup without logging secret values.
- PostgreSQL constraints enforce tenant foreign keys, one completion per task, one Focus selection per user/workday, positive ledger values, and immutable receipts/ledger/grants.
- Internal job routes require `Authorization: Bearer <INTERNAL_JOB_SECRET>` and compare secrets in constant time.

## 7. Testing strategy

### Unit

Vitest covers all effort mappings, timing boundaries, final rounding, ledger reconciliation, streak cap and workday transitions, timezone/DST behavior, all five achievements, deterministic message variants, prohibited copy, quiet hours, and provider adapter contracts.

### Database

pgTAP verifies tables, columns, enums, constraints, indexes, RLS policies, cross-tenant denial, immutable reward rows, and the progress view. Each SQL test is transactional and rolls back.

### Integration

Vitest against local Supabase exercises auth, memberships, assignment, Focus uniqueness, the full completion transaction, concurrency, retry, reopen/recomplete, opt-ins, quiet hours, delivery claiming, and deadline-nudge idempotency. Fixtures use unique IDs and clean themselves up.

### End to end

Playwright resets the local database, signs in through the UI as the seeded user, opens the demo project, selects the Focus Task, moves it through In Progress and Done, verifies the 52-point result and streak 3, visits the dashboard, reloads, and confirms persisted progress, achievement, message, and notification.

## 8. Contributor-friendly issue breakdown

| Slice                                       | User-visible outcome                                                                            | Primary file ownership                                                                                                                           | Depends on                                        | Parallel-safe with                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------- |
| 1. Seeded authenticated project             | Demo user signs in and sees a three-column seeded project                                       | Root config, `src/lib/supabase/**`, auth, core migrations, seed                                                                                  | None                                              | None; establishes contracts                           |
| 2. Focus selection                          | User selects today's assigned Focus Task and sees it marked                                     | `domain/streaks/workday*`, `server/focus/**`, `features/focus/**`, focus migration                                                               | 1                                                 | Pure reward/message work on uncommitted branches only |
| 3. Atomic completion engine                 | First completion persists 52 points, streak 3, achievement, message, and notification once      | `domain/rewards/**`, `domain/streaks/transition*`, `domain/achievements/**`, `domain/motivation/**`, `server/tasks/complete*`, rewards migration | 2                                                 | Adapter contract work in Slice 8                      |
| 4. Persisted celebration/dashboard          | Board celebration and dashboard show the committed receipt after reload; Playwright path passes | `features/dashboard/**`, completion UI, dashboard server queries, E2E                                                                            | 3                                                 | Documentation drafts                                  |
| 5. Workspace/project creation               | Signed-up user creates a workspace and project                                                  | `server/workspaces/**`, `server/projects/**`, project feature forms                                                                              | 4                                                 | Slice 7 preference domain work                        |
| 6. Task creation and assignment             | Member creates assigned tasks with effort/deadline and moves all board states                   | task form/service except completion engine                                                                                                       | 5                                                 | Slice 8 adapters                                      |
| 7. Preferences and quiet hours              | User selects tone, opts into channels, and configures quiet hours                               | `domain/notifications/**`, settings feature, notification schema                                                                                 | 4                                                 | 5, 6, 8                                               |
| 8. Email and mock SMS delivery              | Due outbox rows send through Resend/mock adapters with retries                                  | `server/notifications/adapters/**`, delivery worker/route                                                                                        | 7 for integration; adapter code can start after 1 | 5, 6                                                  |
| 9. Deadline nudges                          | Assigned due-soon tasks receive one supportive nudge per deadline                               | nudge migration, nudge service/route                                                                                                             | 7, 8                                              | Slice 11 UI polish                                    |
| 10. Authorization and idempotency hardening | Cross-tenant, concurrent, and immutable-row tests prove defenses                                | core/reward RLS hardening migration, pgTAP, integration security tests                                                                           | 6, 9                                              | Slice 11                                              |
| 11. Accessibility and responsive polish     | Keyboard/mobile/reduced-motion flows meet acceptance criteria                                   | presentation components and CSS only                                                                                                             | 6, 7                                              | 9, 10                                                 |
| 12. Release gate and documentation          | Clean setup, CI-equivalent validation, and provider docs are reproducible                       | README, env example, scripts, workflow if GitHub is chosen                                                                                       | 10, 11                                            | None; final integration owner                         |

Shared hotspots are `package.json`, `pnpm-lock.yaml`, `src/types/database.ts`, `supabase/seed.sql`, `src/server/tasks/complete-task.ts`, and the project page. One integration owner must serialize changes to these files. Contributors must not regenerate database types or add dependencies independently; they submit requested package names or migration outputs to the integration owner.

## 9. Implementation order

### Milestone 1: smallest end-to-end Focus completion

Execute Slices 1 through 4 in order. This is the first releasable milestone and must not be split across separate releases: a seeded user signs in, opens a project, selects a Focus Task, moves it through the board, completes it exactly once, receives 52 points, extends the streak from 2 to 3, sees Momentum Three and a deterministic message, and reloads a persisted dashboard.

### Milestone 2: create real work

Slices 5 and 6 are implemented on `agent/slice-2-self-service-core`. A new user
can sign up, create a workspace/project/task, assign and move the task, complete
it through the authoritative engine, and reload the persisted result. Slice 7
domain work and Slice 8 adapter-contract work remain unauthorized.

### Milestone 3: notification channels and nudges

Integrate Slices 7 and 8, then execute Slice 9. Only the integration owner modifies the completion transaction to add outbox creation.

### Milestone 4: hardening and release

Execute Slices 10 and 11 in parallel with separate file ownership. Slice 12 integrates, documents, and runs the full release gate.

## 10. Risks and deliberate MVP exclusions

### Risks

- Slice 1 is frozen at tag `momentum-slice-1` in the private
  `zukhriddingit/Momentum` repository. Slice 2 work uses a dedicated branch and
  keeps the baseline tag unchanged.
- The workspace has no framework or local database setup. Docker and network access for package/browser downloads are prerequisites.
- The transaction adapter requires a Node runtime and a correct Supabase pooled `DATABASE_URL`.
- Hosted job scheduling is deployment-specific; this plan provides protected routes but does not select a host.
- Manual Resend verification requires an API key and verified sender domain. Automated fakes remain mandatory.
- Database types are a shared generated artifact and can create contributor conflicts without an integration owner.

### Exclusions

No leaderboards, rankings, negative points, employee scoring, AI decisions, real SMS, membership invitations/removal, SSO, billing, custom columns, dependencies, recurring tasks, subtasks, Gantt charts, attachments, comments, time tracking, reporting suites, holiday calendars, priority, or multi-browser real-time push synchronization are included.

## 11. Exact validation commands

Prerequisite setup:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm exec supabase start
pnpm exec supabase db reset --local
```

Required release order:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec supabase test db --local
pnpm test:integration
pnpm test:e2e
pnpm build
```

`pnpm test:e2e` resets the local database before Playwright setup. `pnpm validate` runs the same release commands in the same order except the one-time Supabase start.

## 12. Definition of done

- Authentication, workspaces/memberships, projects, task creation/assignment, three-column Kanban, deadlines, and effort levels work through authorized server boundaries.
- One Focus Task per user/workday is enforced globally and visible on board/dashboard.
- Completion uses one atomic, server-trusted, idempotent transaction.
- Late tasks receive full base points; early and streak bonuses match the approved formula; priority and negative points are absent.
- Reopen/recomplete and concurrent duplicate attempts produce no second reward artifacts.
- Current/longest streak and all five achievements are persisted and displayed.
- Four deterministic tone sets contain no shaming language.
- In-app notifications persist; email/mock SMS are opt-in, quiet-hours-aware, adapter-backed, and retry-safe.
- Deadline nudges are supportive and idempotent.
- The seeded demo and main Playwright flow reproduce from a local database reset.
- Keyboard, responsive, and reduced-motion behavior passes acceptance checks.
- No trusted calculations or secrets appear in client bundles.
- Migrations, generated types, README, environment example, dependency rationale, and validation commands are current.
- Every release validation command passes with no skipped relevant tests.

---

## Detailed vertical-slice tasks

The following tasks are execution checklists. Each task must be reviewed and committed before a dependent task begins.

### Active execution scope

Slices 1 through 4—the first seeded end-to-end milestone—are complete at tag
`momentum-slice-1`. Slices 5 and 6 are implemented as the bounded Self-Service
Core Project Management slice specified in
`../specs/2026-07-15-self-service-core-design.md`. Slices 7 through 12 remain
planning context and are not authorized. The completed Slice 2 still excludes
Resend, email, SMS, quiet hours, deadline nudges, delivery workers, full settings,
additional achievements beyond Momentum Three, and production deployment.

The streak implementation for this milestone must distinguish three outcomes:
an unselected weekday pauses, a selected-but-incomplete weekday breaks, and a
weekend has no effect.
