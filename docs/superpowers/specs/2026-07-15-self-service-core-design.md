# Slice 2: Self-Service Core Project Management Design

**Date:** 2026-07-15

**Status:** Approved design; implementation plan pending

**Baseline:** Commit `3a907bd`, tagged `momentum-slice-1`, on the private
`zukhriddingit/Momentum` repository

## Objective

Slice 2 removes the seeded-data dependency for ordinary use. A new user can
sign up, create a profile, create and navigate their own workspace and project,
create and edit assigned tasks, select a Focus Task, and complete it through the
existing authoritative reward workflow.

The seeded demonstration remains a permanent regression path. Slice 2 does not
change reward formulas, Focus Streak semantics, immutable ledger behavior,
completion idempotency, the deterministic supportive message, or the seeded
52-point result.

## Confirmed decisions

- Use the existing modular-monolith architecture with validated Server Actions
  delegating to server-only TypeScript application services.
- Browser access to collaboration data remains read-only under RLS. Trusted
  writes use server-only services with explicit authorization checks.
- Email/password sign-up creates an immediate authenticated session. Email
  confirmation and email delivery remain deferred.
- Sign-up requires a display name and valid IANA timezone. Motivation tone
  defaults to `friendly`.
- Profile creation is atomic with Auth user creation through a database trigger
  and idempotently repairable through `ensureProfile`.
- A membership row represents an active membership in this slice. Invitations,
  suspension, removal, and role-management UI remain deferred.
- An incomplete task may be reassigned to a member of its own workspace.
- After the first rewarded completion, the task's assignee is immutable even if
  the task is later reopened.
- Submitting `Done` from task creation or editing is a real completion request.
  Only the assignee may submit it, and it must use the existing atomic completion
  workflow.
- Owners and admins may edit any task in their workspace except that they cannot
  change a post-completion assignee or complete a task assigned to someone else.
- Members may edit tasks they created. Independently, assignees may move their
  assigned tasks through statuses. Only assignees can complete and receive
  rewards.
- A task without a deadline receives no timing bonus.
- Task cards and forms may show a non-authoritative base-point estimate. No
  reward value is accepted from client input.
- Cross-workspace, inaccessible, and nonexistent tenant resources use the same
  generic not-found response.
- No production dependency is expected for this slice.

## Architecture

Momentum remains a Next.js App Router modular monolith. Server Components load
authorized view models. Client Components manage accessible forms and dialogs.
Server Actions validate external input, require the current Supabase user, and
delegate to application services. Application services use the existing
server-only PostgreSQL adapter for transactions, row locks, and explicit
authorization.

The routes introduced or expanded by this slice are:

```text
/
├── sign-in
├── sign-up
├── onboarding
├── dashboard
├── workspaces/[workspaceId]
└── workspaces/[workspaceId]/projects/[projectId]
```

The root and sign-in routes continue to send authenticated users to the
dashboard. The dashboard redirects an authenticated user without a membership
to onboarding. The proxy treats `/sign-up` as public and redirects an already
authenticated user away from both auth pages.

### Authentication and profile flow

`signUpAction` validates email, password, display name, and timezone before
calling Supabase Auth. It includes `display_name` and `timezone` in Auth user
metadata. Local Auth has email signup enabled and confirmation disabled.

An `auth.users` trigger validates the metadata again inside PostgreSQL:

- display name length must remain within the profile constraint;
- timezone must exist in `pg_timezone_names`;
- motivation tone is always inserted as `friendly`;
- insertion uses `on conflict (id) do nothing`.

Because the trigger executes in the Auth insert transaction, an invalid profile
cannot leave a successful Auth user without application state. The server-only
`ensureProfile` service repeats validation and conflict-safe insertion for
seeded or pre-existing Auth users. Repeating it returns the same profile rather
than overwriting identity data.

### Onboarding flow

The onboarding page loads the user's membership state. When no membership
exists, it shows one focused two-step flow:

1. Create a workspace. `createWorkspace` inserts the workspace and owner
   membership in one transaction.
2. Create the first project in that workspace. Success redirects directly to
   the project board.

If a user revisits onboarding after obtaining membership, the page redirects to
the dashboard. If the workspace exists but the project step was interrupted,
the flow resumes at project creation without creating another workspace.

### Workspace and project navigation

`listWorkspaceNavigation` returns only workspaces the actor belongs to and the
projects inside them. The authenticated shell renders keyboard-accessible
workspace and project selectors from this view model.

`/workspaces/[workspaceId]` is the selected workspace landing page. It shows
project cards and progress, a usable no-project state, an owner/admin project
creation control, and navigation to accessible projects.

Workspace creation is available during onboarding and later from the workspace
selector. Any authenticated user may create a workspace and becomes its owner.

Project creation and editing require `owner` or `admin`. Editing supports name
and description. Every command locks and authorizes the workspace/project row
before mutation. Failed authorization and missing IDs return the same
`NOT_FOUND` application error.

### Task creation and editing

Task forms support:

- title;
- description;
- assignee;
- effort (`small`, `medium`, `large`, or `extra_large`);
- optional ISO deadline;
- status (`todo`, `in_progress`, or `done`).

Every task command derives workspace identity through the authoritative project
row. The assignee must have a membership in that workspace. IDs, timestamps,
and `created_by` are generated or derived on the server.

Authorization rules are evaluated by a small pure permission function and
rechecked in locked SQL queries:

| Actor relationship               | Edit fields | Reassign before completion | Move non-Done status | Complete           |
| -------------------------------- | ----------- | -------------------------- | -------------------- | ------------------ |
| Owner/admin                      | Yes         | Yes                        | Yes                  | Only when assignee |
| Member who created task          | Yes         | Yes                        | Yes                  | Only when assignee |
| Assignee who did not create task | No          | No                         | Yes                  | Yes                |
| Other member                     | No          | No                         | No                   | No                 |

After `first_completed_at` is populated, `assignee_id` cannot change. Other
authorized descriptive edits do not alter the immutable completion receipt or
ledger. A reopened task may be moved back to Done only by its unchanged
assignee, and the original receipt is returned without new reward artifacts.

### Done delegation and completion isolation

The public contract remains:

```ts
completeTask(input: {
  actorId: string;
  taskId: string;
  occurredAt: Date;
}): Promise<CompletionReceipt>;
```

The current transaction body moves to a server-private
`completeTaskInTransaction(sql, input)` function. The public wrapper starts a
transaction and delegates to it. Task creation and editing can therefore
persist non-reward fields and, when the requested status is `done`, call the
same completion engine inside one transaction.

No point, timing, streak, achievement, message, notification, or idempotency
logic changes. Existing task locks and unique constraints remain the duplicate
completion defense.

## Database changes

One additive migration, `202607150002_self_service_core.sql`, contains only the
schema support required by Slice 2:

- an `auth.users` profile-initialization trigger and its protected function;
- a task-assignee membership trigger that checks the task's project workspace;
- an extension to task first-completion protection that also freezes the
  assignee after first completion;
- an index on `workspace_memberships (user_id, workspace_id)`;
- an index on `projects (workspace_id, created_at)`;
- an index on `tasks (created_by)`.

The existing first migration is not rewritten. Existing seed Auth metadata is
updated to contain valid timezones, and its explicit profile insert becomes
conflict-safe so database reset remains reproducible.

All browser-readable tables remain under RLS. Existing authenticated select
policies continue to scope profiles, workspaces, memberships, projects, tasks,
Focus data, rewards, achievements, and notifications. No authenticated insert,
update, or delete grants are added to trusted reward relations.

## Server contracts

The slice adds these service boundaries:

```ts
ensureProfile(input: {
  actorId: string;
  displayName: string;
  timezone: string;
}): Promise<ProfileView>;

createWorkspace(input: {
  actorId: string;
  name: string;
}): Promise<WorkspaceSummary>;

listWorkspaceNavigation(input: {
  actorId: string;
}): Promise<WorkspaceNavigationView>;

getWorkspaceOverview(input: {
  actorId: string;
  workspaceId: string;
}): Promise<WorkspaceOverview>;

createProject(input: {
  actorId: string;
  workspaceId: string;
  name: string;
  description: string | null;
}): Promise<ProjectSummary>;

updateProject(input: {
  actorId: string;
  projectId: string;
  name: string;
  description: string | null;
}): Promise<ProjectSummary>;

createTask(input: {
  actorId: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string;
  effort: EffortLevel;
  dueAt: Date | null;
  status: TaskStatus;
  occurredAt: Date;
}): Promise<TaskMutationReceipt>;

updateTask(input: {
  actorId: string;
  taskId: string;
  title: string;
  description: string | null;
  assigneeId: string;
  effort: EffortLevel;
  dueAt: Date | null;
  status: TaskStatus;
  occurredAt: Date;
}): Promise<TaskMutationReceipt>;
```

Actions return the existing `ActionResult<T>` discriminated union. Clients may
send only user-editable fields and resource IDs. They never send trusted point
values, reward multipliers, streak state, completion timestamps, membership
roles, achievement results, notification data, or project progress.

## User experience

### Sign-up

The sign-up page visually matches sign-in and links back to it. It uses clear
labels, autocomplete attributes, password constraints, a display-name field,
and an IANA timezone selector or validated text-backed choice. Errors do not
disclose Auth internals. The seeded demo credentials remain documented and the
existing sign-in path continues to work.

### Forms and dialogs

- Workspace onboarding uses a dedicated page so the first-run sequence stays
  focused.
- Later workspace creation uses an accessible dialog from the workspace
  switcher.
- Project creation and editing use an accessible shared dialog.
- Task creation and editing use an accessible shared dialog.
- Forms expose loading, pending, disabled, and supportive validation states.
- Dialog focus is trapped and restored by the existing Radix primitive.
- Native select and date-time controls retain keyboard behavior.

Implementation discovery: the Slice 1 dialog close control was labeled
`Close celebration`. Because Slice 2 reuses the primitive for project and task
forms, `src/components/ui/dialog.tsx` now uses the accurate generic label
`Close dialog`. This is a shared-foundation file added to the approved manifest
after design review.

Task deadline controls submit an ISO timestamp derived from the visible local
date-time. The server validates it before creating a `Date`. The user's profile
timezone remains authoritative for Focus work dates and streak behavior.

### Board and reward preview

The board always renders To Do, In Progress, and Done columns. A project with no
tasks shows a supportive prompt and task-creation control instead of a blank
screen.

`basePointsForEffort(effort)` exposes the existing base mapping for a visual
estimate:

- Small: 20
- Medium: 40
- Large: 70
- Extra Large: 100

The UI labels this as estimated base points and explains that early and streak
bonuses are calculated securely at completion. Completion continues to call
`calculatePointBreakdown` with database values.

Visible card indicators include assignee, effort, deadline, status column,
Focus state, and estimated base reward. Reduced-motion styles suppress
decorative transitions and celebration motion without removing state feedback.

## Error handling

- Zod schemas reject malformed IDs, missing names, invalid efforts/statuses,
  invalid deadlines, and malformed Auth fields before service calls.
- IANA timezone validation uses `Intl.DateTimeFormat` in TypeScript and
  `pg_timezone_names` in PostgreSQL.
- Expected validation, authentication, not-found, conflict, and permission
  failures use supportive action messages.
- Cross-workspace and missing-resource failures are deliberately
  indistinguishable.
- Unexpected errors are logged on the server without secrets and return the
  existing generic safe-work message.
- Workspace creation, task creation-to-Done, and task edit-to-Done roll back as
  complete transactions on failure.

## Testing strategy

### Unit tests

Vitest covers:

- sign-up schema success and field failures;
- IANA timezone acceptance and rejection;
- workspace/project/task schema normalization;
- task permission decisions for owner, admin, creator, assignee, and unrelated
  member;
- the base-point preview mapping;
- all existing reward and streak tests unchanged.

Implementation discovery: the Slice 1 Vitest configuration included only
`src/domain/**/*.test.ts`. Slice 2 therefore also updates `vitest.config.ts` to
include `src/features/**/*.test.ts`, ensuring the approved feature-schema
tests run under the documented `pnpm test:unit` command.

Release-gate discovery: Slice 2 moved the primary Dashboard link from project
page content into the shared application navigation. The preserved seeded
Playwright test still scoped that link to `<main>`, so it timed out even though
the accessible navigation link was present and both reward paths were correct.
`tests/e2e/momentum-happy-path.spec.ts` is therefore updated only to use the
shared accessible Dashboard link. Its seeded 52-point, streak, achievement,
message, persistence, and progress expectations remain unchanged.

### Database tests

pgTAP verifies:

- the profile trigger creates one friendly profile with a valid timezone;
- profile insertion is conflict-safe;
- task assignees must belong to the project workspace;
- a first-completed task cannot change assignee;
- new indexes exist;
- tenant reads remain scoped by RLS;
- authenticated browser roles have no direct writes to completion receipts,
  ledger rows, streaks, achievement grants, or notifications;
- all first-slice schema tests still pass.

### Integration tests

Local-Supabase Vitest tests cover:

- idempotent profile creation;
- workspace and owner-membership atomicity;
- onboarding membership detection;
- project creation and editing by owner/admin;
- project rejection for members and cross-workspace actors;
- task creation by a member;
- owner/admin and creator edit boundaries;
- assigned-member status movement;
- valid reassignment before completion;
- cross-workspace assignee rejection;
- unauthorized completion rejection;
- create/edit with Done delegating to the authoritative engine;
- immutable assignee after completion;
- existing concurrent completion and reopen/recomplete behavior;
- preservation of the seeded 52-point result.

### End-to-end tests

The existing seeded Chromium test remains unchanged.

A new serial Chromium test:

1. signs up a unique clean user;
2. creates a workspace;
3. creates a project;
4. creates a medium task assigned to the current user without a deadline;
5. selects it as today's Focus Task;
6. moves it to In Progress and Done;
7. verifies an authoritative 40-point celebration and streak one;
8. reloads the celebration;
9. verifies persisted dashboard points, project progress, Focus state, and
   notification.

## Implementation slices

1. **Signup and onboarding:** Auth configuration, profile trigger/service,
   sign-up UI, atomic workspace ownership, and onboarding recovery.
2. **Workspace and project management:** authorized navigation, workspace
   overview, project create/edit, switchers, and empty states.
3. **Task management:** schemas, pure permissions, create/edit services,
   assignee validation, form/dialog, board integration, and reward preview.
4. **Completion and release hardening:** transaction extraction, Done
   delegation, authorization regressions, the new-user E2E flow, documentation,
   and the complete validation gate.

Each slice ends with focused tests and a clean commit. The original baseline tag
remains unchanged.

## Exact file scope

### Create

- `docs/superpowers/specs/2026-07-15-self-service-core-design.md`
- `docs/superpowers/plans/2026-07-15-self-service-core.md`
- `supabase/migrations/202607150002_self_service_core.sql`
- `supabase/tests/database/second_slice.test.sql`
- `src/app/(auth)/sign-up/page.tsx`
- `src/app/(app)/onboarding/page.tsx`
- `src/app/(app)/workspaces/[workspaceId]/page.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/textarea.tsx`
- `src/domain/profiles/is-iana-timezone.ts`
- `src/domain/profiles/is-iana-timezone.test.ts`
- `src/domain/tasks/task-permissions.ts`
- `src/domain/tasks/task-permissions.test.ts`
- `src/features/auth/schemas.ts`
- `src/features/auth/schemas.test.ts`
- `src/features/auth/sign-up-form.tsx`
- `src/features/onboarding/onboarding-flow.tsx`
- `src/features/workspaces/actions.ts`
- `src/features/workspaces/schemas.ts`
- `src/features/workspaces/schemas.test.ts`
- `src/features/workspaces/workspace-form.tsx`
- `src/features/workspaces/workspace-switcher.tsx`
- `src/features/projects/actions.ts`
- `src/features/projects/schemas.ts`
- `src/features/projects/schemas.test.ts`
- `src/features/projects/project-form-dialog.tsx`
- `src/features/tasks/schemas.ts`
- `src/features/tasks/schemas.test.ts`
- `src/features/tasks/task-form-dialog.tsx`
- `src/server/profiles/ensure-profile.ts`
- `src/server/workspaces/create-workspace.ts`
- `src/server/workspaces/list-workspace-navigation.ts`
- `src/server/workspaces/get-workspace-overview.ts`
- `src/server/projects/create-project.ts`
- `src/server/projects/update-project.ts`
- `src/server/tasks/create-task.ts`
- `src/server/tasks/update-task.ts`
- `src/server/tasks/complete-task-transaction.ts`
- `tests/fixtures/self-service.ts`
- `tests/integration/profile-and-onboarding.test.ts`
- `tests/integration/project-and-task-authorization.test.ts`
- `tests/e2e/new-user-self-service.spec.ts`

### Modify

- `README.md`
- `vitest.config.ts`
- `docs/superpowers/specs/2026-07-15-momentum-mvp-design.md`
- `docs/superpowers/plans/2026-07-15-momentum-mvp.md`
- `supabase/config.toml`
- `supabase/seed.sql`
- `src/components/ui/dialog.tsx`
- `src/proxy.ts`
- `src/app/(auth)/sign-in/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx`
- `src/domain/rewards/calculate-point-breakdown.ts`
- `src/domain/rewards/calculate-point-breakdown.test.ts`
- `src/features/auth/actions.ts`
- `src/features/auth/sign-in-form.tsx`
- `src/features/dashboard/dashboard-cards.tsx`
- `src/features/tasks/actions.ts`
- `src/features/tasks/kanban-board.tsx`
- `src/features/tasks/task-card.tsx`
- `src/server/dashboard/get-dashboard.ts`
- `src/server/projects/get-project-board.ts`
- `src/server/tasks/complete-task.ts`
- `src/server/tasks/move-task.ts`
- `src/server/types.ts`
- `tests/e2e/momentum-happy-path.spec.ts`

Changes outside this manifest require an explicit documented deviation.

## Explicitly deferred

- workspace invitations;
- membership removal, suspension, or role-management UI;
- Resend and email delivery;
- SMS;
- quiet-hour scheduling;
- deadline-nudge jobs;
- notification-delivery workers;
- AI-generated content;
- public or private leaderboards;
- kudos or social feeds;
- priority, subtasks, dependencies, recurring tasks, attachments, comments,
  time tracking, or custom columns;
- deployment schedulers;
- analytics integrations;
- production billing.

## Definition of done

- A new user can sign up with a valid profile and immediate local session.
- A user without membership completes onboarding and reaches their first board.
- Authorized workspace/project switching and project editing work without
  cross-tenant exposure.
- Authorized members create tasks with every supported field and valid
  same-workspace assignees.
- Task edit and reassignment rules match the confirmed permission matrix.
- A completed task's assignee cannot change.
- Done always delegates to the authoritative completion engine.
- Browser input never controls trusted rewards or completion timestamps.
- New-user completion persists 40 points and streak one after reload.
- Seeded completion remains exactly 52 points and streak three.
- Concurrent and reopen/recomplete attempts create no duplicate reward
  artifacts.
- Existing and new unit, database, integration, and Chromium tests pass.
- Formatting, linting, strict type checking, and the production build pass.
- README and the parent MVP documents reflect the completed Slice 1 baseline
  and implemented Slice 2 behavior.
