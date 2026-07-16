# Momentum MVP Design

**Date:** 2026-07-15

**Status:** Approved design; Slice 1 implemented at tag `momentum-slice-1` and
Slice 2 approved in `2026-07-15-self-service-core-design.md`

## Product intent

Momentum is a motivation-first project-management platform for small teams. The
MVP centers on one workflow:

1. Create and assign a task.
2. Select one assigned task as today's Focus Task.
3. Move the task through To Do, In Progress, and Done.
4. Award completion points exactly once.
5. Extend the Focus Streak when the completed task was today's Focus Task.
6. Select a deterministic, supportive message in the user's chosen tone.
7. Persist updated task, reward, streak, achievement, notification, and project
   progress state.
8. Show an authoritative completion celebration and refreshed dashboard.

The product must not expand into a generic enterprise project-management suite.
There are no public leaderboards, negative points, shame states, or AI-controlled
rewards, employee evaluation, message generation, or delivery timing.

## Confirmed product decisions

- The streak multiplier uses the streak immediately before the completion.
- The final result is rounded once to the nearest whole point.
- A workday is Monday through Friday in the user's selected IANA timezone.
- Public holidays are not modeled in the MVP.
- A workday with no Focus Task selection pauses the streak without incrementing
  or breaking it.
- A workday with a Focus Task selection that remains incomplete breaks the
  streak. The next completed Focus Task starts a new streak at 1.
- Weekends neither increment nor break the streak.
- One Focus Task is allowed globally per user per workday, even when the user
  belongs to multiple workspaces.
- A selected Focus Task may be changed until it has been completed. A completed
  Focus selection is immutable.
- No deadline uses a timing multiplier of `1.00`.
- At exactly 24 hours early, the multiplier is `1.20`.
- After the 24-hour threshold but before the deadline, the multiplier is `1.10`.
- At or after the deadline, the multiplier is `1.00`.
- Reopening and recompleting a task can change its current status to Done but
  cannot create another completion receipt, point entry, streak update,
  achievement grant, celebration, or notification.
- Priority is excluded from the MVP schema and cannot influence rewards.

## Architecture

Momentum is a modular monolith built with the Next.js App Router, strict
TypeScript, Tailwind CSS, shadcn/ui-compatible components, Supabase Auth and
PostgreSQL, Vitest, and Playwright.

### Runtime boundaries

- Server Components perform authenticated reads through a cookie-based Supabase
  client and PostgreSQL Row Level Security.
- Server Actions are the browser mutation boundary. Every action validates its
  input, verifies the current user, and delegates to a server-only application
  service.
- Pure TypeScript domain modules own point calculation, streak transitions,
  achievement evaluation, motivational-message selection, and quiet-hours
  scheduling.
- A small server-only PostgreSQL adapter uses Supabase's pooled `DATABASE_URL`
  and the `postgres` package to execute the completion workflow in one database
  transaction. When a transaction pooler is used, prepared statements are
  disabled in the adapter.
- User-facing reads remain protected by RLS. Transactional command services also
  repeat explicit membership, role, project, and assignee checks after locking
  authoritative rows.
- React components consume authorized view models. They do not calculate or
  accept trusted points, multipliers, streak counts, completion timestamps, or
  notification schedules.

The `postgres` dependency is justified because the completion workflow must
atomically lock and update several tables while retaining canonical domain rules
in small, testable TypeScript functions. `Zod` is justified for shared input
schemas at every external boundary. `Resend` is isolated behind an adapter.

### Completion transaction

`completeTask({ actorId, taskId, occurredAt })` performs the following work:

1. Begin a transaction and lock the task.
2. Verify the actor is authenticated, is an active member of the task's
   workspace, and is the task's assignee.
3. If an immutable completion already exists, set the task status to Done if
   necessary and return the original receipt with `wasNewCompletion: false`.
4. Lock today's Focus selection and the assignee's streak row.
5. Load the assignee's timezone, tone, and notification preferences.
6. Calculate the point breakdown, streak transition, achievements, motivational
   template, and external-delivery schedule with pure domain functions.
7. Update the task to Done and set its immutable `first_completed_at`.
8. Insert the immutable completion receipt and positive point-ledger entries.
9. If applicable, mark the Focus selection complete and update current and
   longest streak values.
10. Insert any newly earned achievement grants.
11. Insert one in-app completion notification containing the rendered message.
12. Insert opted-in email and SMS outbox rows with quiet-hours-aware
    `available_at` values.
13. Commit and return a persisted completion receipt containing the points,
    breakdown, streak result, newly earned achievements, rendered message, and
    project progress.

The task row lock serializes concurrent attempts. Unique constraints are the
final idempotency defense. A second request returns the original receipt and
does not replay the celebration.

### External notifications

Two protected internal routes support scheduled notification work:

- `POST /api/jobs/deadline-nudges` creates deterministic due-within-24-hours
  notifications. The source identity includes the task and exact deadline, so a
  retry is idempotent and an intentionally changed deadline may receive a new
  nudge.
- `POST /api/jobs/notification-deliveries` claims due email/SMS outbox rows in
  bounded batches and delegates to provider adapters.

Both routes require an internal job secret and are never called from browser
code. Provider failure cannot roll back a completed task. Transient failures use
exponential retry delays; after five failures the row becomes `failed` for
inspection. Resend receives the delivery ID as its idempotency key. The MVP SMS
adapter records a mock receipt and contacts no external carrier.

In-app notifications are immediate and are not suppressed by external-channel
quiet hours. Email and SMS are opt-in and are delayed until the next allowed
time when an event falls inside quiet hours.

## Data model

All identifiers are UUIDs. Timestamps are `timestamptz`. Work dates are
PostgreSQL `date` values computed in the user's IANA timezone.

### Core collaboration

#### `profiles`

- `id uuid primary key references auth.users(id)`
- `display_name text not null`
- `timezone text not null`
- `motivation_tone motivation_tone not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Allowed tones are `calm`, `friendly`, `energetic`, and `minimal`.

#### `workspaces`

- `id uuid primary key`
- `name text not null`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

#### `workspace_memberships`

- `workspace_id uuid references workspaces(id)`
- `user_id uuid references profiles(id)`
- `role membership_role not null`
- `joined_at timestamptz not null`
- Primary key: `(workspace_id, user_id)`

Roles are `owner`, `admin`, and `member`.

#### `projects`

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `name text not null`
- `description text`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

#### `tasks`

- `id uuid primary key`
- `project_id uuid not null references projects(id)`
- `title text not null`
- `description text`
- `assignee_id uuid not null references profiles(id)`
- `status task_status not null`
- `effort effort_level not null`
- `due_at timestamptz`
- `first_completed_at timestamptz`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Statuses are `todo`, `in_progress`, and `done`. Effort levels are `small`,
`medium`, `large`, and `extra_large`. A database trigger rejects changes to a
non-null `first_completed_at`.

### Focus, rewards, and achievements

#### `focus_selections`

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `task_id uuid not null references tasks(id)`
- `work_date date not null`
- `selected_at timestamptz not null`
- `completed_at timestamptz`
- Unique: `(user_id, work_date)`

The application service and database constraint trigger verify that the task is
assigned to the selecting user. A completed selection cannot be updated or
deleted.

#### `task_completions`

- `id uuid primary key`
- `task_id uuid not null unique references tasks(id)`
- `workspace_id uuid not null references workspaces(id)`
- `project_id uuid not null references projects(id)`
- `recipient_id uuid not null references profiles(id)`
- `actor_id uuid not null references profiles(id)`
- `focus_selection_id uuid unique references focus_selections(id)`
- `completed_at timestamptz not null`
- `base_points integer not null`
- `timing_multiplier numeric(4,2) not null`
- `streak_multiplier numeric(4,2) not null`
- `pre_completion_streak integer not null`
- `post_completion_streak integer not null`
- `final_points integer not null`
- `message_template_key text not null`
- `created_at timestamptz not null`

The row is an immutable receipt. Its snapshots make the historical award
explainable even if future scoring rules change.

#### `point_ledger`

- `id uuid primary key`
- `completion_id uuid not null references task_completions(id)`
- `workspace_id uuid not null references workspaces(id)`
- `project_id uuid not null references projects(id)`
- `user_id uuid not null references profiles(id)`
- `entry_kind point_entry_kind not null`
- `points integer not null check (points > 0)`
- `created_at timestamptz not null`
- Unique: `(completion_id, entry_kind)`

Entry kinds are `base`, `timing_bonus`, and `streak_bonus`. Update and delete
operations are rejected. Zero-value bonus entries are omitted.

#### `focus_streaks`

- `user_id uuid primary key references profiles(id)`
- `current_count integer not null check (current_count >= 0)`
- `longest_count integer not null check (longest_count >= current_count)`
- `last_completed_work_date date`
- `updated_at timestamptz not null`

#### `achievement_definitions`

- `code text primary key`
- `name text not null`
- `description text not null`
- `icon text not null`

The five seeded definitions are:

1. `first_step`: complete the first task.
2. `focused_finish`: complete the first Focus Task.
3. `momentum_three`: reach a three-workday Focus Streak.
4. `five_day_flow`: reach a five-workday Focus Streak.
5. `ahead_of_schedule`: complete a task at least 24 hours early.

#### `achievement_grants`

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `achievement_code text not null references achievement_definitions(code)`
- `completion_id uuid not null references task_completions(id)`
- `granted_at timestamptz not null`
- Unique: `(user_id, achievement_code)`

Grant rows are immutable.

### Notifications

#### `notifications`

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `workspace_id uuid not null references workspaces(id)`
- `event_type notification_event_type not null`
- `source_id text not null`
- `tone motivation_tone not null`
- `template_key text not null`
- `title text not null`
- `body text not null`
- `read_at timestamptz`
- `created_at timestamptz not null`
- Unique: `(user_id, event_type, source_id)`

Event types include task completion, Focus completion, achievement, streak, and
deadline nudge events. Completion may use one combined notification body to
avoid flooding the user with several messages for the same action.

#### `notification_preferences`

- `user_id uuid primary key references profiles(id)`
- `email_opt_in boolean not null default false`
- `sms_opt_in boolean not null default false`
- `email_address text`
- `phone_e164 text`
- `quiet_hours_enabled boolean not null default false`
- `quiet_hours_start time`
- `quiet_hours_end time`
- `timezone text not null`
- `updated_at timestamptz not null`

Email and phone destinations are required only when the corresponding channel is
enabled. Cross-midnight quiet-hour windows are supported.

#### `notification_deliveries`

- `id uuid primary key`
- `notification_id uuid not null references notifications(id)`
- `channel external_notification_channel not null`
- `status delivery_status not null`
- `available_at timestamptz not null`
- `attempt_count integer not null default 0`
- `provider_message_id text`
- `last_error_code text`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- Unique: `(notification_id, channel)`

Channels are `email` and `sms`. Statuses are `pending`, `processing`, `sent`,
and `failed`.

### Derived progress

A `project_progress` database view derives `done_tasks`, `total_tasks`, and a
bounded completion percentage from persisted task state. The dashboard also
sums the current user's immutable ledger rows. No synchronization-prone project
or user summary tables are stored in the MVP.

## Domain rules

### Points

Base points are:

- Small: 20
- Medium: 40
- Large: 70
- Extra Large: 100

Timing multipliers are:

- At least 24 hours before `due_at`: `1.20`
- Less than 24 hours early but still before `due_at`: `1.10`
- At or after `due_at`, or with no deadline: `1.00`

The streak multiplier is:

```text
1 + min(0.20, 0.04 * preCompletionStreak)
```

The award and ledger breakdown are:

```text
timingAdjusted = basePoints * timingMultiplier
finalPoints = round(timingAdjusted * streakMultiplier)
timingBonus = round(timingAdjusted) - basePoints
streakBonus = finalPoints - basePoints - timingBonus
```

Only positive rows are inserted. The entries always sum to `finalPoints`.
Priority never participates. There are no negative adjustments.

### Focus Streak

- Completing the first Focus Task sets the streak to 1.
- Completing a later Focus Task increments the prior streak when every
  intervening workday either had no Focus Task selected or had its selected
  Focus Task completed.
- Completing another task on the same work date does not increment it.
- A workday with no Focus Task selected pauses the streak.
- A workday with a selected but incomplete Focus Task breaks the streak. Until a
  later Focus completion starts a new streak, its effective current value is 0.
- Weekends neither increment nor break it.
- Longest streak is the maximum of its prior value and the new current value.
- Only a task recorded as the user's Focus selection for that work date can
  update the streak.

### Motivation

Motivational templates are reviewed constants grouped by event type and tone.
Selection is deterministic from the event type, tone, and immutable source ID.
The same event therefore always renders the same template. Templates may
celebrate effort, progress, consistency, or a clear next step. They may not
shame, threaten, compare employees, or imply a penalty.

### Deadline nudges

The deadline job identifies assigned, incomplete tasks with `due_at` greater
than the scan time and no more than 24 hours away. It creates at most one nudge
per `(user, task, due_at)`. It does not evaluate employee performance and does
not alter rewards.

## Routes and user experience

### Routes

```text
/
├── sign-in
├── sign-up
├── auth/callback
├── dashboard
├── workspaces/[workspaceId]/projects/[projectId]
├── settings/notifications
├── api/jobs/deadline-nudges
└── api/jobs/notification-deliveries
```

The root route sends an authenticated user to the dashboard and an unauthenticated
user to sign-in.

### Dashboard

The dashboard prioritizes today's work and visible progress:

- Today's Focus Task or a prompt to select one.
- Current points with a recent transparent ledger breakdown.
- Current and longest Focus Streak.
- Recently earned achievements.
- Project completion cards.
- Recent in-app notifications.

It does not contain a leaderboard or comparative performance ranking.

### Project board

The project page contains:

- A responsive three-column Kanban board.
- A task-creation dialog for title, description, assignee, effort, and deadline.
- Explicit keyboard-accessible move controls.
- Optional pointer dragging implemented without making drag-and-drop the only
  interaction.
- A Focus Task control available only on tasks assigned to the current user.
- Clear Focus, deadline, effort, and assignee indicators.

The first transition to Done opens a celebration containing the persisted point
breakdown, streak result, achievements, and supportive message. Reduced-motion
preferences suppress decorative animation. Recompletion does not replay the
reward celebration.

### Settings

Notification settings allow the user to select Calm, Friendly, Energetic, or
Minimal tone; choose their timezone; opt into email and/or SMS; enter the
relevant destination; and configure quiet hours.

## Directory boundaries

```text
src/
├── app/
│   ├── (auth)/
│   ├── (app)/
│   ├── api/jobs/
│   └── auth/callback/
├── components/ui/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── projects/
│   ├── tasks/
│   ├── focus/
│   └── notifications/
├── domain/
│   ├── rewards/
│   ├── streaks/
│   ├── achievements/
│   ├── motivation/
│   └── notifications/
├── server/
│   ├── auth/
│   ├── db/
│   ├── tasks/
│   ├── focus/
│   ├── dashboard/
│   └── notifications/adapters/
└── types/

supabase/
├── migrations/
├── tests/database/
└── seed.sql

tests/
├── integration/
└── e2e/
```

Unit tests live next to pure domain files as `*.test.ts`.

## Application-service and action boundaries

### Pure domain modules

- `rewards` maps effort to base points, classifies deadline timing, applies the
  pre-completion streak multiplier, rounds once, and returns ledger entries.
- `streaks` converts timestamps to work dates, evaluates intervening Focus
  selections, and returns the pause, break, or current/longest transition
  without I/O.
- `achievements` evaluates the five definitions from an authoritative
  completion snapshot.
- `motivation` selects and renders a reviewed template deterministically.
- `notifications` validates preferences and schedules a send outside quiet
  hours.

### Server application services

- Workspace service creates a workspace and owner membership atomically.
- Project service creates and edits projects after role checks.
- Task service creates, edits, assigns, and moves tasks.
- Focus service selects or changes today's Focus Task after assignee checks.
- Completion service owns the atomic first-completion transaction.
- Dashboard service returns authorized view models rather than raw rows.
- Deadline-nudge service generates idempotent notification events.
- Delivery worker claims and sends due external deliveries through adapters.

### Server Actions

- `signIn`, `signUp`, `signOut`
- `createWorkspace`, `createProject`
- `createTask`
- `moveTask`; moving to Done delegates to the completion service
- `selectFocusTask`
- `updateProfilePreferences`
- `markNotificationRead`

Each action returns a discriminated result:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "CONFLICT"
        | "INTERNAL";
      fieldErrors?: Record<string, string[]>;
    };
```

## Security and authorization

### Role rules

- Any authenticated user may create a workspace and becomes its owner.
- Workspace members may read workspace metadata, projects, tasks, aggregate
  progress, and the limited teammate profile data needed for assignment.
- Owners/admins may create and edit projects. Membership records and roles are
  enforced by the MVP, but adding, removing, and changing members is deliberately
  deferred.
- Members may create tasks and assign them only to active members of the same
  workspace.
- An assignee may move and complete their assigned task.
- Owners/admins may edit or reassign a task but cannot complete a task on another
  user's behalf to award that user points.
- A user may select only their own assigned task as Focus Task.
- Users may read only their own ledger, achievements, notifications, and
  preferences. Team progress is aggregate and unranked.

### Defense layers

1. Zod validates every external input.
2. `requireUser()` verifies the Supabase session on every protected action or
   route.
3. Application services check tenant membership and role.
4. Transactions repeat authorization using locked database rows.
5. Constraints enforce cross-row invariants, uniqueness, positive points, and
   immutability.
6. RLS protects user-facing reads and denies browser writes to trusted reward
   tables.

Sensitive modules import `server-only`. `DATABASE_URL`, Supabase server
credentials, Resend keys, and internal job secrets never use `NEXT_PUBLIC_` and
never enter client components. SQL is parameterized. Logs use correlation IDs
and omit credentials and raw destination data.

## Error and concurrency behavior

- Validation errors return field-specific supportive copy.
- Authorization failures do not reveal whether cross-workspace data exists.
- Missing resources return `NOT_FOUND`.
- Invalid state changes, such as changing a completed Focus selection, return a
  recoverable `CONFLICT`.
- Unexpected database/provider details are logged server-side and reduced to an
  `INTERNAL` result for the user.
- Completion locks the task, Focus selection, and streak state. Concurrent
  requests either create the first receipt or return that receipt.
- A task-completion success is returned only after the authoritative transaction
  commits.
- Provider failure remains visible in the delivery table and never removes an
  in-app notification or reward.
- Successful mutations revalidate affected project and dashboard routes.

## Demonstration seed

`supabase/seed.sql` creates a documented local demo user, a teammate, one shared
workspace, one project, and tasks in all three Kanban columns. It also creates
two coherent historical Focus completions so the demo user begins with a
two-workday streak but no Focus selection for the current workday.

Any intervening workdays without a Focus selection are intentionally absent
from the seed. Under the pause rule they preserve the two-day streak; the seed
contains no selected-but-incomplete workday between the second historical
completion and the demonstration workday.

The main candidate is a medium task due more than 24 hours later. Completing it
as today's Focus Task produces:

```text
round(40 * 1.20 * 1.08) = 52 points
```

The streak extends from 2 to 3 and grants Momentum Three. Historical seed dates
are relative to the database-reset date and respect weekends. External channels
are opted out by default.

## Testing strategy

### Vitest unit tests

- Every effort/base-point mapping.
- Exact timing boundaries, late completion, and no deadline.
- Streak multipliers from zero through the 20% cap.
- Single final rounding and ledger reconciliation.
- Friday-to-Monday, no-selection pause, selected-but-incomplete break,
  timezone, and DST transitions.
- All five achievement thresholds.
- Stable message selection across every event/tone combination.
- Template safety checks for prohibited shame and punishment language.
- Disabled, ordinary, all-day, and overnight quiet hours.
- Resend and mock-SMS adapter contracts using test doubles.

### Database and integration tests

- Schema constraints, RLS policies, tenant isolation, and ledger immutability
  with pgTAP.
- Sign-in and cross-workspace authorization.
- Workspace/project/task creation and assignment validation.
- Global one-Focus-per-user-per-workday enforcement.
- Streak preservation across an unselected workday and reset after a selected
  but incomplete workday.
- Atomic task completion, ledger breakdown, streak, achievements, in-app
  notification, outbox, and dashboard projection.
- Late tasks receiving full base points.
- Concurrent duplicate completion.
- Reopen/recomplete producing no new reward artifacts.
- Opt-out and quiet-hours behavior.
- Deadline-nudge idempotency.
- A clean database reset reproducing the demo workspace.

Database integration cases create uniquely named fixtures and clean them up.
The Playwright command performs a local database reset before its setup project,
so repeated runs always start from the documented demonstration state.

### Playwright

The primary Chromium test signs in as the seeded user, opens the project,
selects the Focus Task, moves it to In Progress and Done, verifies the 52-point
celebration and three-day streak, opens the dashboard, reloads, and confirms the
progress, ledger, message, achievement, and notification remain persisted.

Authentication state is generated during Playwright setup and ignored by Git.
The test uses keyboard-operable task controls and checks the primary responsive
layout at desktop and mobile widths.

## Exact local setup and validation commands

Momentum standardizes on pnpm and Node.js 20.9 or newer. A Docker-compatible
container runtime is required for the local Supabase stack.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm exec supabase start
pnpm exec supabase db reset --local

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec supabase test db --local
pnpm test:integration
pnpm test:e2e
pnpm build
```

The validation order satisfies the repository working agreement: formatting,
linting, type checking, unit testing, relevant database/integration testing, and
the main end-to-end test. The build is an additional release check.

## Deliberate MVP exclusions

- Public or private leaderboards, rankings, negative points, and performance
  scoring.
- AI-generated rewards, evaluations, messages, or delivery timing.
- Real SMS delivery.
- Membership invitations, member removal workflows, SSO, complex organization
  administration, and billing.
- Custom board columns, task dependencies, recurring tasks, subtasks, Gantt
  charts, file attachments, comments, time tracking, and reporting suites.
- Holiday calendars.
- Priority fields.
- Real-time push synchronization between multiple open browsers.
- A deployment-provider-specific scheduler.

Actual production email sending also requires a Resend API key and verified
sender domain. The adapter and automated contract tests do not depend on those
credentials.

## Risks

- The workspace is not currently a Git repository, so planning documents cannot
  be committed until Git is initialized or the intended repository is supplied.
- The workspace contains no existing application setup; the first implementation
  slice must create all framework, database, lint, format, and test foundations.
- Direct server-side PostgreSQL transactions require a Node-compatible runtime
  and a correctly configured Supabase pooled connection string.
- A deployment scheduler has not been selected. The job routes are portable,
  but production invocation remains deployment-specific.
- Resend delivery cannot be manually exercised without external credentials and
  a verified sender. Automated adapter tests and the mock SMS path remain fully
  reproducible.

## Definition of done

- Every requested MVP capability has an authorized server-side path and visible
  UI.
- The seeded happy path works after a clean `supabase db reset`.
- Points, streak, achievement, message, in-app notification, and task state are
  persisted as one first-completion outcome.
- The dashboard and project progress reflect that outcome after reload.
- Concurrent completion and reopen/recomplete tests prove exactly-once rewards.
- External channels are opt-in, quiet-hours-aware, adapter-backed, and retry-safe.
- The Kanban and Focus flows are responsive, keyboard accessible, and respectful
  of reduced-motion preferences.
- No client bundle contains trusted calculations or secret credentials.
- Migrations, generated types, environment documentation, setup instructions,
  provider rationale, and the demonstration credentials are current.
- Formatting, linting, type checking, unit tests, database tests, integration
  tests, the main Playwright test, and the production build all pass.

## Primary references

- [Next.js authentication and authorization](https://nextjs.org/docs/app/guides/authentication)
- [Next.js Server Action forms](https://nextjs.org/docs/app/guides/forms)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Supabase local-development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database testing](https://supabase.com/docs/guides/database/testing)
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright authentication](https://playwright.dev/docs/auth)
- [Playwright web-server configuration](https://playwright.dev/docs/test-webserver)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
