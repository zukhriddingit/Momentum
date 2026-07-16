# Slice 2: Self-Service Core Project Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new user sign up, create and navigate a workspace/project, create and edit tasks, and complete a self-created Focus Task without changing Slice 1 reward, streak, or idempotency behavior.

**Architecture:** Extend the existing Next.js modular monolith with validated Server Actions and focused server-only PostgreSQL services. Use one additive migration for atomic profile creation and tenant constraints, keep browser table access read-only under RLS, and extract the existing completion transaction body only so task create/edit commands can delegate `Done` inside the same transaction.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript 6, Tailwind CSS 4, shadcn/ui-compatible primitives, Supabase Auth/PostgreSQL, Postgres.js, Zod 4, Vitest 4, pgTAP, and Playwright Chromium.

## Global Constraints

- Preserve the baseline at commit `3a907bd` and tag `momentum-slice-1`.
- Work only on `agent/slice-2-self-service-core`; never move or recreate the baseline tag.
- Do not change base points, timing multipliers, streak multipliers, rounding, pause/break/weekend semantics, Momentum Three, or the deterministic completion message.
- The seeded completion must remain exactly 52 points and move streak 2 to 3.
- Reopening and recompleting must return the original receipt and create no new ledger, streak, achievement, celebration, or notification artifacts.
- Server Actions validate external input and delegate to server-only services.
- Browser roles retain read-only collaboration access and no trusted reward writes.
- Cross-workspace, inaccessible, and nonexistent tenant resources return the same generic not-found result.
- A completed task's assignee is immutable.
- `Done` is an authoritative completion request and only the assignee may submit it.
- No production dependency additions are expected. If one becomes necessary, stop and document the reason before installing it.
- Keep Resend, email, SMS, quiet hours, nudges, delivery workers, settings, additional achievements, invitations, member removal, role UI, leaderboards, AI content, analytics, billing, and production deployment out of scope.

---

### Task 1: Add the profile and tenant database guardrails

**Files:**

- Create: `supabase/migrations/202607150002_self_service_core.sql`
- Create: `supabase/tests/database/second_slice.test.sql`
- Modify: `supabase/config.toml`
- Modify: `supabase/seed.sql`

**Interfaces:**

- Consumes: existing `profiles`, `projects`, `tasks`, `workspace_memberships`, and first-completion trigger from migration `202607150001_first_slice.sql`.
- Produces: `public.initialize_auth_profile()`, `public.validate_task_workspace_assignee()`, completed-assignee protection, three query indexes, enabled local email signup, and a reset-safe seed.

- [ ] **Step 1: Write the failing pgTAP checks**

Create `second_slice.test.sql` with explicit checks before creating the migration:

```sql
begin;

select plan(9);

select has_function('public', 'initialize_auth_profile', array[]::text[], 'profile trigger function exists');
select has_trigger('auth', 'users', 'initialize_auth_profile_after_insert', 'auth insert initializes a profile');
select has_function('public', 'validate_task_workspace_assignee', array[]::text[], 'task assignee validator exists');
select has_trigger('public', 'tasks', 'tasks_require_workspace_assignee', 'tasks enforce same-workspace assignees');
select has_index('public', 'workspace_memberships', 'workspace_memberships_user_workspace_idx', 'membership navigation index exists');
select has_index('public', 'projects', 'projects_workspace_created_idx', 'workspace project index exists');
select has_index('public', 'tasks', 'tasks_created_by_idx', 'task creator permission index exists');
select function_returns('public', 'protect_task_first_completion', array[]::text[], 'trigger', 'task completion guard remains a trigger');
select is_empty(
  $$
    select 1
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name in ('task_completions', 'point_ledger', 'focus_streaks', 'achievement_grants', 'notifications')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  $$,
  'authenticated has no trusted reward writes'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test and verify it fails**

Run:

```bash
pnpm test:db
```

Expected: `second_slice.test.sql` fails because the new functions, triggers, and indexes do not exist.

- [ ] **Step 3: Implement the additive migration**

Create the migration with these exact invariants:

```sql
create function public.initialize_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  requested_timezone text := coalesce(new.raw_user_meta_data ->> 'timezone', '');
begin
  if char_length(requested_name) not between 1 and 80 then
    raise exception 'valid display_name metadata is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = requested_timezone
  ) then
    raise exception 'valid timezone metadata is required' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, timezone, motivation_tone)
  values (new.id, requested_name, requested_timezone, 'friendly')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger initialize_auth_profile_after_insert
after insert on auth.users
for each row execute function public.initialize_auth_profile();

create function public.validate_task_workspace_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  select project.workspace_id into target_workspace_id
  from public.projects as project
  where project.id = new.project_id;

  if target_workspace_id is null or not exists (
    select 1 from public.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = new.assignee_id
  ) then
    raise exception 'task assignee must belong to the project workspace' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tasks_require_workspace_assignee
before insert or update of project_id, assignee_id on public.tasks
for each row execute function public.validate_task_workspace_assignee();

create or replace function public.protect_task_first_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_completed_at is not null then
    if new.first_completed_at is distinct from old.first_completed_at then
      raise exception 'tasks.first_completed_at is immutable once set' using errcode = '55000';
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      raise exception 'tasks.assignee_id is immutable after first completion' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create index workspace_memberships_user_workspace_idx
  on public.workspace_memberships (user_id, workspace_id);
create index projects_workspace_created_idx
  on public.projects (workspace_id, created_at);
create index tasks_created_by_idx on public.tasks (created_by);
```

Do not grant execute on either trigger function to browser roles.

- [ ] **Step 4: Enable immediate local email signup and repair the seed**

Set `[auth] enable_signup = true` and keep `[auth.email] enable_confirmations = false`. Add `timezone` to both seeded users' `raw_user_meta_data`. Change the explicit profile insert to:

```sql
insert into public.profiles (id, display_name, timezone, motivation_tone)
values
  (demo_user_id, 'Maya Chen', 'America/New_York', 'friendly'),
  (teammate_user_id, 'Alex Rivera', 'America/New_York', 'friendly')
on conflict (id) do nothing;
```

- [ ] **Step 5: Reset and run both database test files**

Run:

```bash
pnpm supabase:reset
pnpm test:db
```

Expected: reset succeeds; first-slice 12 tests pass; all 9 second-slice checks pass.

- [ ] **Step 6: Commit the database foundation**

```bash
git add supabase/config.toml supabase/seed.sql supabase/migrations/202607150002_self_service_core.sql supabase/tests/database/second_slice.test.sql
git commit -m "feat: add self-service database guardrails"
```

### Task 2: Add validated signup and idempotent profile recovery

**Files:**

- Create: `src/domain/profiles/is-iana-timezone.ts`
- Create: `src/domain/profiles/is-iana-timezone.test.ts`
- Create: `src/features/auth/schemas.ts`
- Create: `src/features/auth/schemas.test.ts`
- Create: `src/features/auth/sign-up-form.tsx`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/server/profiles/ensure-profile.ts`
- Create: `tests/fixtures/self-service.ts`
- Create: `tests/integration/profile-and-onboarding.test.ts`
- Modify: `src/features/auth/actions.ts`
- Modify: `src/features/auth/sign-in-form.tsx`
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Modify: `src/proxy.ts`

**Interfaces:**

- Consumes: Supabase Auth server client, `ActionResult<T>`, the new Auth profile trigger, and `database()`.
- Produces: `isIanaTimezone(value)`, exported `signInSchema`/`signUpSchema`, `ensureProfile(input)`, `signUpAction`, `/sign-up`, and reusable clean-user integration fixtures.

- [ ] **Step 1: Write failing timezone and Auth schema unit tests**

Use these assertions:

```ts
expect(isIanaTimezone("America/New_York")).toBe(true);
expect(isIanaTimezone("Asia/Tokyo")).toBe(true);
expect(isIanaTimezone("Mars/Olympus_Mons")).toBe(false);

expect(
  signUpSchema.safeParse({
    email: "new@example.com",
    password: "momentum-pass-2026",
    displayName: "New User",
    timezone: "America/New_York",
  }).success,
).toBe(true);

expect(
  signUpSchema.safeParse({
    email: "bad",
    password: "short",
    displayName: "",
    timezone: "Not/AZone",
  }).success,
).toBe(false);
```

- [ ] **Step 2: Run the focused unit tests and verify failure**

```bash
pnpm exec vitest run src/domain/profiles/is-iana-timezone.test.ts src/features/auth/schemas.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement timezone validation and shared schemas**

```ts
export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}
```

Define `signUpSchema` with `z.email()`, password minimum 12, trimmed display name 1–80, and a timezone refinement. Export `signInSchema` so the action and tests share one boundary.

- [ ] **Step 4: Write the failing idempotent profile integration test**

In `tests/fixtures/self-service.ts`, export deterministic UUID helpers and `insertAuthUser` that inserts Auth metadata with a display name and timezone. In the integration test, call `ensureProfile` twice and assert one row:

```ts
const first = await ensureProfile({
  actorId: userId,
  displayName: "Self Service User",
  timezone: "America/New_York",
});
const second = await ensureProfile({
  actorId: userId,
  displayName: "Self Service User",
  timezone: "America/New_York",
});
expect(second).toEqual(first);

const [{ count }] = await database()<Array<{ count: number }>>`
  select count(*)::integer as count from public.profiles where id = ${userId}
`;
expect(count).toBe(1);
```

- [ ] **Step 5: Implement `ensureProfile`**

The service must import `server-only`, validate the name/timezone again, insert with `on conflict do nothing`, select the row, and reject a conflicting existing name/timezone with `AppError("CONFLICT", "That profile already exists with different details.")`.

- [ ] **Step 6: Implement signup and preserve seeded sign-in**

`signUpAction` must call:

```ts
const { data, error } = await supabase.auth.signUp({
  email: parsed.data.email,
  password: parsed.data.password,
  options: {
    data: {
      display_name: parsed.data.displayName,
      timezone: parsed.data.timezone,
    },
  },
});
```

Require `data.user`, call `ensureProfile`, then `redirect("/onboarding")`. Return supportive `VALIDATION` or `UNAUTHORIZED` results without exposing Supabase messages. Keep `signInAction` compatible with `demo@momentum.local`, update its generic error copy, and redirect to `/dashboard`.

Make `/sign-up` public in `src/proxy.ts`; authenticated visits to sign-in or sign-up redirect to `/dashboard`.

- [ ] **Step 7: Implement accessible sign-up UI**

Use `useActionState(signUpAction, null)` with labeled email, password, display-name, and timezone controls, autocomplete attributes, `aria-live` errors, and a disabled pending submit. Link sign-up and sign-in pages to each other. Do not remove the seeded demo hint from sign-in.

- [ ] **Step 8: Run focused and baseline Auth tests**

```bash
pnpm test:unit
pnpm test:integration
pnpm lint
pnpm typecheck
```

Expected: all existing tests plus the new profile test pass.

- [ ] **Step 9: Commit signup/profile recovery**

```bash
git add src/domain/profiles src/features/auth src/app/\(auth\) src/server/profiles src/proxy.ts tests/fixtures/self-service.ts tests/integration/profile-and-onboarding.test.ts
git commit -m "feat: add self-service signup"
```

### Task 3: Create the atomic workspace onboarding step

**Files:**

- Create: `src/features/workspaces/schemas.ts`
- Create: `src/features/workspaces/schemas.test.ts`
- Create: `src/features/workspaces/actions.ts`
- Create: `src/features/workspaces/workspace-form.tsx`
- Create: `src/features/onboarding/onboarding-flow.tsx`
- Create: `src/app/(app)/onboarding/page.tsx`
- Create: `src/server/workspaces/create-workspace.ts`
- Create: `src/server/workspaces/list-workspace-navigation.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/server/dashboard/get-dashboard.ts`
- Modify: `src/server/types.ts`
- Test: `tests/integration/profile-and-onboarding.test.ts`

**Interfaces:**

- Consumes: `requireUser`, `database`, `ActionResult`, and the authenticated profile.
- Produces: `workspaceSchema`, `createWorkspace`, `listWorkspaceNavigation`, `createWorkspaceAction`, the first onboarding stage, and navigation view types.

- [ ] **Step 1: Write failing workspace schema and integration tests**

Unit assertions:

```ts
expect(workspaceSchema.parse({ name: "  Design Team  " })).toEqual({
  name: "Design Team",
});
expect(workspaceSchema.safeParse({ name: "" }).success).toBe(false);
```

Integration assertions:

```ts
const workspace = await createWorkspace({
  actorId: userId,
  name: "My Workspace",
});
expect(workspace.name).toBe("My Workspace");

const [membership] = await database()<Array<{ role: string }>>`
  select role::text from public.workspace_memberships
  where workspace_id = ${workspace.id} and user_id = ${userId}
`;
expect(membership.role).toBe("owner");
```

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
pnpm exec vitest run src/features/workspaces/schemas.test.ts
pnpm test:integration
```

Expected: FAIL because workspace modules are missing.

- [ ] **Step 3: Implement workspace schema and transaction service**

`createWorkspace` must generate the UUID server-side and execute both inserts in one `database().begin` callback:

```ts
await sql`
  insert into public.workspaces (id, name, created_by)
  select ${workspaceId}, ${input.name}, profile.id
  from public.profiles as profile
  where profile.id = ${input.actorId}
`;
await sql`
  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (${workspaceId}, ${input.actorId}, 'owner')
`;
```

If the profile insert-select affects no row, throw `NOT_FOUND` without inserting membership.

- [ ] **Step 4: Implement navigation read model**

Return:

```ts
interface WorkspaceNavigationView {
  workspaces: Array<{
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    projects: Array<{ id: string; name: string }>;
  }>;
}
```

Use an actor-filtered membership join and deterministic workspace/project ordering.

- [ ] **Step 5: Implement the workspace action and onboarding stage**

`createWorkspaceAction` validates input, calls `requireUser`, delegates to the service, and revalidates `/dashboard` and `/onboarding`. `WorkspaceForm` returns the created workspace ID to `OnboardingFlow`. The flow renders workspace creation when `workspaces.length === 0`; after success it renders the project step with the persisted workspace ID.

The onboarding page redirects users with any project to `/dashboard`. It resumes the project step for a membership whose workspace has no projects.

Extend `DashboardView` with `hasWorkspace`. `getDashboard` sets it with an
actor-filtered `exists` query against `workspace_memberships`. The dashboard
page redirects to `/onboarding` only when `dashboard.hasWorkspace === false`;
it must not redirect a member whose workspace currently has zero projects.

- [ ] **Step 6: Run focused validation**

```bash
pnpm test:unit
pnpm test:integration
pnpm lint
pnpm typecheck
```

Expected: workspace schema, atomic owner membership, existing profile, and Slice 1 tests pass.

- [ ] **Step 7: Commit workspace onboarding**

```bash
git add src/features/workspaces src/features/onboarding src/app/\(app\)/onboarding src/app/\(app\)/dashboard/page.tsx src/server/workspaces src/server/dashboard/get-dashboard.ts src/server/types.ts tests/integration/profile-and-onboarding.test.ts
git commit -m "feat: add workspace onboarding"
```

### Task 4: Add project management and workspace switching

**Files:**

- Create: `src/features/workspaces/workspace-switcher.tsx`
- Create: `src/features/projects/schemas.ts`
- Create: `src/features/projects/schemas.test.ts`
- Create: `src/features/projects/actions.ts`
- Create: `src/features/projects/project-form-dialog.tsx`
- Create: `src/server/workspaces/get-workspace-overview.ts`
- Create: `src/server/projects/create-project.ts`
- Create: `src/server/projects/update-project.ts`
- Create: `src/app/(app)/workspaces/[workspaceId]/page.tsx`
- Create: `tests/integration/project-and-task-authorization.test.ts`
- Modify: `src/features/onboarding/onboarding-flow.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/features/dashboard/dashboard-cards.tsx`
- Modify: `src/app/(app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx`
- Modify: `src/server/types.ts`

**Interfaces:**

- Consumes: workspace navigation, roles, `project_progress`, `requireUser`, and `ActionResult`.
- Produces: project schemas/actions/services, `WorkspaceOverview`, workspace/project switchers, project create/edit dialog, and no-project UI.

- [ ] **Step 1: Write failing project schema and authorization tests**

Cover trimming and nullable description, then create owner/admin/member fixtures. Assert owner and admin create/update succeed; member and cross-workspace actor receive identical `NOT_FOUND` errors.

```ts
await expect(
  createProject({
    actorId: memberId,
    workspaceId,
    name: "Denied",
    description: null,
  }),
).rejects.toMatchObject({ code: "NOT_FOUND", message: "Workspace not found." });
await expect(
  createProject({
    actorId: memberId,
    workspaceId: crypto.randomUUID(),
    name: "Missing",
    description: null,
  }),
).rejects.toMatchObject({ code: "NOT_FOUND", message: "Workspace not found." });
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
pnpm exec vitest run src/features/projects/schemas.test.ts
pnpm test:integration
```

- [ ] **Step 3: Implement project services with role checks**

Both services must lock and authorize through:

```sql
join public.workspace_memberships as membership
  on membership.workspace_id = workspace.id
 and membership.user_id = $actorId
 and membership.role in ('owner', 'admin')
```

`updateProject` derives workspace through the project row and uses the same generic `Project not found.` result for missing/cross-tenant/forbidden actors.

- [ ] **Step 4: Implement workspace overview and actions**

`getWorkspaceOverview` returns workspace ID/name/actor role plus project progress. Actions validate, delegate, revalidate affected paths, and return IDs for client navigation.

- [ ] **Step 5: Complete onboarding and navigation UI**

The project step in `OnboardingFlow` calls `createProjectAction` and pushes to `/workspaces/${workspaceId}/projects/${projectId}`. `WorkspaceSwitcher` uses labeled native selects and `router.push`; it never accepts options outside the server-produced navigation view.

Add workspace/project navigation to the authenticated layout. Add the workspace landing page with project cards, a zero-project empty state, and owner/admin create control. Add an edit-project dialog to the project page for owner/admin view models.

- [ ] **Step 6: Run focused validation**

```bash
pnpm test:unit
pnpm test:integration
pnpm lint
pnpm typecheck
```

- [ ] **Step 7: Commit project management**

```bash
git add src/features/workspaces/workspace-switcher.tsx src/features/projects src/server/workspaces/get-workspace-overview.ts src/server/projects src/app/\(app\) src/features/dashboard/dashboard-cards.tsx src/server/types.ts tests/integration/project-and-task-authorization.test.ts
git commit -m "feat: add workspace project management"
```

### Task 5: Define task inputs, permissions, and reward preview

**Files:**

- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/domain/tasks/task-permissions.ts`
- Create: `src/domain/tasks/task-permissions.test.ts`
- Create: `src/features/tasks/schemas.ts`
- Create: `src/features/tasks/schemas.test.ts`
- Modify: `src/domain/rewards/calculate-point-breakdown.ts`
- Modify: `src/domain/rewards/calculate-point-breakdown.test.ts`
- Modify: `src/server/types.ts`

**Interfaces:**

- Consumes: existing `EffortLevel`, `TaskStatus`, membership roles, and Tailwind UI conventions.
- Produces: `basePointsForEffort`, `taskInputSchema`, `getTaskPermissions`, native Select/Textarea primitives, and expanded task/board view models.

- [ ] **Step 1: Write failing reward-preview, task-schema, and permission tests**

```ts
expect(basePointsForEffort("small")).toBe(20);
expect(basePointsForEffort("medium")).toBe(40);
expect(basePointsForEffort("large")).toBe(70);
expect(basePointsForEffort("extra_large")).toBe(100);

expect(
  taskInputSchema.safeParse({
    projectId: crypto.randomUUID(),
    title: "Write brief",
    description: "",
    assigneeId: crypto.randomUUID(),
    effort: "medium",
    dueAt: null,
    status: "todo",
  }).success,
).toBe(true);

expect(
  getTaskPermissions({
    actorId: "owner",
    role: "owner",
    createdBy: "other",
    assigneeId: "other",
    firstCompletedAt: null,
  }),
).toEqual({
  canEdit: true,
  canReassign: true,
  canMove: true,
  canComplete: false,
});
```

Add cases for admin, creator-member, assignee-only member, unrelated member, and post-completion reassignment.

- [ ] **Step 2: Run focused unit tests and verify failure**

```bash
pnpm exec vitest run src/domain/rewards/calculate-point-breakdown.test.ts src/domain/tasks/task-permissions.test.ts src/features/tasks/schemas.test.ts
```

- [ ] **Step 3: Export the existing base mapping without changing calculation**

```ts
export function basePointsForEffort(effort: EffortLevel): number {
  return BASE_POINTS[effort];
}
```

Replace only the calculator's direct map access with this function. Confirm the documented 52-point test remains byte-for-byte equivalent in expected values.

- [ ] **Step 4: Implement task input normalization and permissions**

Normalize blank description/deadline to `null`; validate dueAt as ISO datetime; never include points, completion time, streak, or role fields. Implement:

```ts
export function getTaskPermissions(
  input: TaskPermissionInput,
): TaskPermissions {
  const privileged = input.role === "owner" || input.role === "admin";
  const creator = input.createdBy === input.actorId;
  const assignee = input.assigneeId === input.actorId;
  const canEdit = privileged || creator;
  return {
    canEdit,
    canReassign: canEdit && input.firstCompletedAt === null,
    canMove: canEdit || assignee,
    canComplete: assignee,
  };
}
```

- [ ] **Step 5: Add UI primitives and view-model fields**

Implement native forward-ref Select/Textarea components using the same `cn` and focus-ring conventions as Input. Extend `TaskView` with `createdBy`, `estimatedBasePoints`, and permissions. Extend `ProjectBoardView` with actor role and workspace member options.

- [ ] **Step 6: Run all unit tests, lint, and types**

```bash
pnpm test:unit
pnpm lint
pnpm typecheck
```

- [ ] **Step 7: Commit task boundaries**

```bash
git add src/components/ui/select.tsx src/components/ui/textarea.tsx src/domain/tasks src/domain/rewards src/features/tasks/schemas.ts src/features/tasks/schemas.test.ts src/server/types.ts
git commit -m "feat: define task management boundaries"
```

### Task 6: Add atomic task create/edit and Done delegation

**Files:**

- Create: `src/server/tasks/complete-task-transaction.ts`
- Create: `src/server/tasks/create-task.ts`
- Create: `src/server/tasks/update-task.ts`
- Modify: `src/server/tasks/complete-task.ts`
- Modify: `src/server/tasks/move-task.ts`
- Test: `tests/integration/project-and-task-authorization.test.ts`
- Regression: `tests/integration/complete-task.test.ts` (run unchanged)

**Interfaces:**

- Consumes: `database`, `getTaskPermissions`, existing completion receipt types, task locks, reward/streak/achievement/message functions, and the new tenant trigger.
- Produces: `completeTaskInTransaction(sql, input)`, `createTask(input)`, `updateTask(input)`, and authoritative Done delegation.

- [ ] **Step 1: Write failing task-service integration cases**

Add cases for member creation, owner/admin editing, creator editing, assigned-only status movement, valid reassignment, cross-workspace assignee rejection, unauthorized completion, completed-assignee rejection, and direct Done delegation.

For Done, assert receipt and artifacts rather than only status:

```ts
const result = await updateTask({
  ...editableTask,
  actorId: assigneeId,
  status: "done",
  occurredAt,
});
expect(result.completion).toMatchObject({
  wasNewCompletion: true,
  points: { finalPoints: 40 },
});

const [{ completions, points }] = await database()<
  Array<{ completions: number; points: number }>
>`
  select
    (select count(*)::integer from public.task_completions where task_id = ${taskId}) as completions,
    (select coalesce(sum(ledger.points), 0)::integer
       from public.point_ledger as ledger
       join public.task_completions as receipt on receipt.id = ledger.completion_id
      where receipt.task_id = ${taskId}) as points
`;
expect({ completions, points }).toEqual({ completions: 1, points: 40 });
```

- [ ] **Step 2: Run integration tests and verify failure**

```bash
pnpm test:integration
```

- [ ] **Step 3: Extract the transaction body without semantic edits**

Move receipt helpers and the current `database().begin` callback body into `complete-task-transaction.ts`:

```ts
export async function completeTaskInTransaction(
  sql: postgres.TransactionSql,
  input: { actorId: string; taskId: string; occurredAt: Date },
): Promise<CompletionReceipt> {
  // Existing locked completion workflow, unchanged except generic NOT_FOUND copy.
}
```

Import the namespace type with `import type postgres from "postgres"`. Keep
`complete-task.ts` as:

```ts
export async function completeTask(
  input: CompletionInput,
): Promise<CompletionReceipt> {
  return database().begin((sql) => completeTaskInTransaction(sql, input));
}
```

Use `AppError("NOT_FOUND", "Task not found.")` for a task the actor cannot access or complete, matching a nonexistent UUID.

- [ ] **Step 4: Implement `createTask`**

Begin one transaction, lock/authorize the project membership, verify the assignee membership, generate ID and createdBy server-side, and insert `todo` when the requested status is `done`. If requested Done, require `actorId === assigneeId` and call `completeTaskInTransaction` before commit. Otherwise return `completion: null`.

- [ ] **Step 5: Implement `updateTask`**

Lock the task/project/membership row, calculate permissions from authoritative values, reject unauthorized/cross-tenant rows as `Task not found.`, prevent reassignment after completion, and update only validated fields. For Done, require `canComplete`, write non-reward fields, then call `completeTaskInTransaction` in the same transaction.

Do not accept client points, roles, creator IDs, first-completion timestamps, or reward state.

- [ ] **Step 6: Keep movement semantics compatible**

Leave `moveTask` as the explicit assignee board-control path. Its Done branch continues through public `completeTask`; non-Done moves remain locked and assignee-only. No owner/admin privilege is added here because administrative status editing uses `updateTask`.

- [ ] **Step 7: Run completion and authorization regression suites**

```bash
pnpm test:unit
pnpm test:integration
pnpm test:db
pnpm lint
pnpm typecheck
```

Expected: seeded 52, concurrent duplicate, reopen/recomplete, new 40-point Done delegation, task permissions, and DB invariants all pass.

- [ ] **Step 8: Commit task services**

```bash
git add src/server/tasks tests/integration/project-and-task-authorization.test.ts
git commit -m "feat: add authorized task management"
```

### Task 7: Add task forms and board management UI

**Files:**

- Create: `src/features/tasks/task-form-dialog.tsx`
- Modify: `src/features/tasks/actions.ts`
- Modify: `src/features/tasks/kanban-board.tsx`
- Modify: `src/features/tasks/task-card.tsx`
- Modify: `src/server/projects/get-project-board.ts`
- Modify: `src/app/(app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx`
- Modify: `src/server/types.ts`

**Interfaces:**

- Consumes: task schemas/services, member options, permissions, base-point estimate, existing focus/move actions, and Radix Dialog.
- Produces: `createTaskAction`, `updateTaskAction`, shared create/edit dialog, empty-board CTA, and permission-aware task cards.

- [ ] **Step 1: Expand the authorized board view model**

Update `getProjectBoard` to select actor role, member options, `created_by`, and `first_completed_at`. Map every task through `getTaskPermissions` and `basePointsForEffort`. Keep project membership in the root query so a foreign project still returns `NOT_FOUND`.

- [ ] **Step 2: Add validated task actions**

`createTaskAction` and `updateTaskAction` parse `taskInputSchema`, call `requireUser` and `requestNow`, delegate, revalidate board/dashboard/workspace paths, and return `TaskMutationReceipt`. If a new completion receipt is returned, the client uses its persisted `completionId` for the celebration query.

- [ ] **Step 3: Implement the shared task dialog**

The dialog receives `mode`, project ID, members, and optional task. It renders labeled title, description, assignee, effort, deadline, and status fields. On effort change, render:

```tsx
<p data-testid="base-point-estimate">
  Estimated base reward: {basePointsForEffort(effort)} points. Early and streak
  bonuses are calculated securely when completed.
</p>
```

Disable assignee after first completion. Hide Done from actors without `canComplete`; disable the whole edit trigger without `canEdit`.

- [ ] **Step 4: Integrate create/edit into the Kanban board**

Add a Create task button above the columns for every member. Add Edit task controls where `canEdit`. Preserve explicit Start, Back to To Do, Complete, Reopen, and Focus controls. After create/update, refresh or navigate to the persisted celebration exactly as the existing move path does.

When `board.tasks.length === 0`, render all columns plus supportive copy: `Create one clear task to give this project its first bit of momentum.`

- [ ] **Step 5: Verify accessibility and responsive behavior in code**

Ensure every control has an accessible name; validation uses `role="alert"` or `aria-live`; pending actions disable submit/buttons; native selects retain keyboard control; dialog focus is managed by Radix; add `motion-reduce:transition-none` to decorative transitions.

- [ ] **Step 6: Run static and focused browser compilation checks**

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

- [ ] **Step 7: Commit task UI**

```bash
git add src/features/tasks src/server/projects/get-project-board.ts src/app/\(app\)/workspaces/\[workspaceId\]/projects/\[projectId\]/page.tsx src/server/types.ts
git commit -m "feat: add task management UI"
```

### Task 8: Complete authorization and onboarding integration coverage

**Files:**

- Modify: `tests/integration/profile-and-onboarding.test.ts`
- Modify: `tests/integration/project-and-task-authorization.test.ts`
- Regression-only: `supabase/tests/database/second_slice.test.sql`
- Regression-only: `tests/integration/complete-task.test.ts`

**Interfaces:**

- Consumes: every Slice 2 service plus deterministic auth/workspace/project/task fixtures.
- Produces: exhaustive evidence for role, tenant, onboarding, profile, completion, and immutable-assignee behavior.

- [ ] **Step 1: Add the full role matrix**

Create two workspaces and owner/admin/member/outsider actors. Assert every row of the approved permission table for project and task commands. Compare error `code` and `message` for a foreign UUID and random UUID.

- [ ] **Step 2: Add onboarding recovery coverage**

Assert navigation returns zero workspaces before creation, one owner workspace with zero projects after workspace creation, and one project after project creation. Call `createWorkspace` with an actor lacking a profile and assert neither workspace nor membership persists.

- [ ] **Step 3: Add immutable and duplicate-completion coverage**

Complete, reopen, attempt reassignment, and re-complete. Assert one completion, unchanged ledger sum/count, one notification, unchanged achievement/streak counts, and original completion ID. Keep the existing concurrent Promise.all test unchanged.

- [ ] **Step 4: Run all non-browser validation**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:integration
```

Expected: no skipped tests and no changes to seeded 52-point expectations.

- [ ] **Step 5: Commit security coverage**

```bash
git add tests/integration/profile-and-onboarding.test.ts tests/integration/project-and-task-authorization.test.ts
git commit -m "test: harden self-service authorization"
```

### Task 9: Add the new-user Playwright path

**Files:**

- Create: `tests/e2e/new-user-self-service.spec.ts`
- Regression-only: `tests/e2e/momentum-happy-path.spec.ts`
- Reference-only: `playwright.config.ts` (retain the existing serial one-worker configuration unchanged)

**Interfaces:**

- Consumes: immediate local signup, onboarding forms, project/task dialogs, Focus/move controls, persisted celebration/dashboard, and the deterministic test clock.
- Produces: one clean-user end-to-end test while retaining the seeded 52-point test.

- [ ] **Step 1: Write the browser test**

Use a unique email derived from the worker/test timestamp. Follow the approved flow with accessible locators and assert:

```ts
await expect(page.getByTestId("completion-celebration")).toContainText(
  "40 points earned",
);
await expect(page.getByTestId("completion-celebration")).toContainText("0 → 1");
await page.reload();
await expect(page.getByTestId("completion-celebration")).toBeVisible();
await page.getByRole("button", { name: "Keep the momentum going" }).click();
await page.getByRole("link", { name: "Dashboard" }).first().click();
await expect(page.getByTestId("total-points")).toHaveText("40");
await expect(page.getByTestId("current-streak")).toHaveText("1");
await expect(page.getByText("1 of 1 tasks complete")).toBeVisible();
```

- [ ] **Step 2: Run both browser paths**

```bash
pnpm test:e2e
```

Expected: both tests pass. The task-management UI from Task 7 must already
provide every accessible label and stable persisted-value test ID used by this
flow.

- [ ] **Step 3: Verify the persisted new-user result explicitly**

After dismissing the reloaded celebration, reload the dashboard once more and
assert that the celebration stays dismissed while points remain `40`, current
streak remains `1`, project progress remains `1 of 1 tasks complete`, and the
completion notification remains visible. The test must not add sleeps or
weaken reward expectations.

- [ ] **Step 4: Run both Chromium paths twice from clean resets**

```bash
pnpm test:e2e
pnpm test:e2e
```

Expected each run: 2 tests pass; seeded path shows 52/streak 3; new user shows 40/streak 1.

- [ ] **Step 5: Commit the browser flow**

```bash
git add tests/e2e/new-user-self-service.spec.ts
git commit -m "test: add new-user Momentum flow"
```

Before committing, verify `git diff --cached --name-only` contains only files changed to satisfy the new flow.

### Task 10: Update documentation and run the release gate

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-15-momentum-mvp-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-momentum-mvp.md`
- Reference: `docs/superpowers/specs/2026-07-15-self-service-core-design.md`
- Reference: `docs/superpowers/plans/2026-07-15-self-service-core.md`

**Interfaces:**

- Consumes: final implemented commands, routes, test counts, migration behavior, and deferrals.
- Produces: reproducible setup/onboarding documentation and a clean, validated Slice 2 branch.

- [ ] **Step 1: Update README behavior and setup**

Document sign-up, demo sign-in, onboarding, the two completion examples (40 new-user and 52 seeded), local signup configuration, validation commands, migration behavior, and the unchanged deferred list. Do not add production deployment instructions.

- [ ] **Step 2: Update parent milestone status**

Mark Slices 5–6 implemented only after tests pass. Keep Slices 7–12 unauthorized/deferred. Remove no historical design decisions.

- [ ] **Step 3: Run formatting and inspect the exact diff**

```bash
pnpm format
git status --short
git diff --check
git diff --stat momentum-slice-1...HEAD
```

Confirm every changed source file is in the approved manifest. Document any required deviation before proceeding.

- [ ] **Step 4: Run the complete validation gate**

```bash
pnpm validate
```

Expected:

- Prettier passes;
- ESLint passes;
- strict TypeScript passes;
- all old and new unit tests pass;
- both pgTAP files pass;
- all integration tests pass, including seeded 52 and exactly-once replay;
- both Chromium tests pass;
- Next.js production build passes.

- [ ] **Step 5: Run final security and repository checks**

```bash
git diff --check momentum-slice-1...HEAD
git status --short --branch
git diff momentum-slice-1...HEAD -- . ':!pnpm-lock.yaml' | rg "SERVICE_ROLE_KEY|SECRET_KEY|BEGIN .* PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}" || true
```

Expected: no whitespace errors, no untracked source, and no committed secret values. Environment-name placeholders are acceptable.

- [ ] **Step 6: Commit release documentation**

```bash
git add README.md docs/superpowers/specs/2026-07-15-momentum-mvp-design.md docs/superpowers/plans/2026-07-15-momentum-mvp.md
git commit -m "docs: complete Slice 2 self-service core"
```

- [ ] **Step 7: Prepare the completion handoff**

Report every created/modified source file, migration and authorization changes, exact validation results and counts, any deviation from this plan, all deferred functionality, branch/commit status, and whether the branch has been pushed. Do not claim a command that did not run.

## Plan self-review checklist

- Every approved design requirement maps to a task above.
- The first migration, reward formulas, streak functions, seeded integration test, and seeded Playwright test are preserved.
- Profile creation is atomic and idempotent.
- Workspace ownership and Done delegation are transactional.
- Browser reward writes remain forbidden.
- Cross-tenant and missing resources are indistinguishable.
- Completed assignees are immutable.
- New-user and seeded browser flows have separate exact point expectations.
- Every created or modified file from the approved manifest is owned by a task.
- No deferred feature appears in an implementation step.
