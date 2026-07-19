# Project Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner/admin project archival that preserves history, removes archived projects from active work, blocks stale mutations, and closes the final Hult Project 1 baseline gap.

**Architecture:** Add nullable `projects.archived_at` and a partial active-project index. A server-only, transactional `archiveProject` service owns authorization and idempotency; all active reads and mutations require `archived_at is null`. A confirmation dialog calls a validated server action and redirects to an accessible workspace success state.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Zod, Tailwind CSS, Radix dialog primitives, Supabase PostgreSQL, pgTAP, Vitest, and Playwright.

## Global Constraints

- Use TypeScript with strict type checking.
- Prefer server-side authorization checks and never trust browser archive state.
- Preserve tasks, task completions, point-ledger rows, achievements, notifications, and Focus history.
- Make archival idempotent and preserve the first `archived_at` timestamp.
- Only workspace owners and admins may archive.
- Missing, unauthorized, cross-workspace, and archived active routes remain indistinguishable.
- Archived projects generate no new task mutations, rewards, Focus selections, or deadline nudges.
- Use supportive, non-punitive language and maintain keyboard and mobile accessibility.
- Do not add production dependencies.
- Restore UI, deletion, bulk archive, and general project status management remain out of scope.

---

## File map

**Create**

- `supabase/migrations/202607180006_project_archive.sql` — nullable archive timestamp and active-project index.
- `supabase/tests/database/sixth_slice.test.sql` — schema, privilege, and preservation assertions.
- `src/server/projects/archive-project.ts` — transactional owner/admin archive service.
- `src/features/projects/archive-project-dialog.tsx` — accessible confirmation and redirect UI.
- `tests/integration/project-archive.test.ts` — authorization, idempotency, filtering, preservation, and stale-action tests.
- `tests/e2e/project-archive.spec.ts` — browser baseline flow and mobile-width check.

**Modify**

- `src/server/types.ts` — `ArchiveProjectReceipt`.
- `src/features/projects/schemas.ts` — strict archive input schema.
- `src/features/projects/schemas.test.ts` — archive schema tests.
- `src/features/projects/actions.ts` — archive server action and cache invalidation.
- `src/components/ui/button.tsx` — destructive button variant.
- `src/app/(app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx` — management control.
- `src/app/(app)/workspaces/[workspaceId]/page.tsx` — bounded archive success message.
- `src/server/workspaces/get-workspace-overview.ts` — active-only project cards.
- `src/server/workspaces/list-workspace-navigation.ts` — active-only project selector and onboarding source.
- `src/server/dashboard/get-dashboard.ts` — active-only current Focus and project progress.
- `src/server/projects/get-project-board.ts` — safe unavailable archived routes.
- `src/server/projects/update-project.ts` — reject stale archived edits.
- `src/server/tasks/create-task.ts` — reject archived task creation.
- `src/server/tasks/update-task.ts` — reject archived task edits/completion requests.
- `src/server/tasks/move-task.ts` — reject archived movement and serialize against archive.
- `src/server/focus/select-focus-task.ts` — reject archived Focus selection and serialize against archive.
- `src/server/tasks/complete-task-transaction.ts` — reject archived completion/replay and serialize against archive.
- `src/server/notifications/scan-deadline-nudges.ts` — skip archived work and serialize scanner selection.
- `tests/integration/deadline-nudges.test.ts` — archived deadline exclusion.
- `README.md` — archive capability and sixth migration.
- `docs/deployment.md` — migration order and hosted archive smoke.
- `docs/closed-pilot-checklist.md` — unverified archive release checks, then hosted evidence after deployment.

---

### Task 1: Add the archive schema with pgTAP coverage

**Files:**

- Create: `supabase/tests/database/sixth_slice.test.sql`
- Create: `supabase/migrations/202607180006_project_archive.sql`

**Interfaces:**

- Produces: nullable `public.projects.archived_at timestamptz`.
- Produces: partial index `projects_active_workspace_created_idx`.
- Preserves: existing project rows and every foreign-key relationship.

- [ ] **Step 1: Write the failing database test**

Create `supabase/tests/database/sixth_slice.test.sql`:

```sql
begin;

select plan(7);

select has_column(
  'public', 'projects', 'archived_at',
  'projects record an optional archive time'
);
select col_type_is(
  'public', 'projects', 'archived_at', 'timestamp with time zone',
  'project archive time is timezone-aware'
);
select has_index(
  'public', 'projects', 'projects_active_workspace_created_idx',
  'active workspace projects have a partial navigation index'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.projects', 'UPDATE'
  ),
  'authenticated browser clients cannot archive projects directly'
);
select lives_ok(
  $$
    update public.projects
    set archived_at = '2026-07-18T20:00:00Z'
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  'the trusted database role can archive a project'
);
select results_eq(
  $$
    select archived_at
    from public.projects
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('2026-07-18T20:00:00Z'::timestamptz) $$,
  'archive time persists exactly'
);
select results_eq(
  $$
    select count(*)::integer
    from public.tasks
    where project_id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values (4::integer) $$,
  'archiving preserves related tasks'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test to verify it fails**

Run:

```bash
CI=true pnpm test:db
```

Expected: FAIL in `sixth_slice.test.sql` because `projects.archived_at` and the partial index do not exist.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/202607180006_project_archive.sql`:

```sql
alter table public.projects
  add column archived_at timestamptz;

create index projects_active_workspace_created_idx
  on public.projects (workspace_id, created_at, id)
  where archived_at is null;
```

- [ ] **Step 4: Run pgTAP and verify the migration**

Run:

```bash
CI=true pnpm test:db
```

Expected: all six database test files pass, including 7 assertions in `sixth_slice.test.sql`.

- [ ] **Step 5: Commit the schema slice**

```bash
git add supabase/migrations/202607180006_project_archive.sql supabase/tests/database/sixth_slice.test.sql
git commit -m "feat: add project archive schema"
```

---

### Task 2: Add the validated, authorized, idempotent archive service

**Files:**

- Modify: `src/server/types.ts`
- Modify: `src/features/projects/schemas.ts`
- Modify: `src/features/projects/schemas.test.ts`
- Create: `src/server/projects/archive-project.ts`
- Modify: `src/features/projects/actions.ts`
- Create: `tests/integration/project-archive.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ArchiveProjectReceipt {
  projectId: string;
  workspaceId: string;
  archivedAt: string;
}
```

- Produces:

```ts
archiveProject(input: {
  actorId: string;
  projectId: string;
}): Promise<ArchiveProjectReceipt>
```

- Produces: `archiveProjectSchema` and `archiveProjectAction`.

- [ ] **Step 1: Write failing schema tests**

Extend `src/features/projects/schemas.test.ts`:

```ts
import {
  archiveProjectSchema,
  projectSchema,
} from "@/features/projects/schemas";

describe("archiveProjectSchema", () => {
  it("accepts only a UUID project ID", () => {
    const projectId = "30000000-0000-4000-8000-000000000001";
    expect(archiveProjectSchema.parse({ projectId })).toEqual({ projectId });
    expect(
      archiveProjectSchema.safeParse({ projectId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      archiveProjectSchema.safeParse({ projectId, archived: true }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing service integration tests**

Create `tests/integration/project-archive.test.ts` with isolated fixture IDs. The first test must establish owner, admin, member, and outsider identities and assert:

```ts
await expect(
  archiveProject({ actorId: ownerId, projectId: ownerProject.id }),
).resolves.toMatchObject({
  projectId: ownerProject.id,
  workspaceId,
});

const first = await archiveProject({
  actorId: adminId,
  projectId: adminProject.id,
});
const retry = await archiveProject({
  actorId: ownerId,
  projectId: adminProject.id,
});
expect(retry).toEqual(first);

for (const attempt of [
  () => archiveProject({ actorId: memberId, projectId: activeProject.id }),
  () => archiveProject({ actorId: outsiderId, projectId: activeProject.id }),
  () =>
    archiveProject({
      actorId: memberId,
      projectId: selfServiceUuid(1699),
    }),
]) {
  await expect(attempt()).rejects.toMatchObject({
    code: "NOT_FOUND",
    message: "Project not found.",
  });
}
```

Also call `Promise.all` with two owner/admin archive attempts against a third project and assert both receipts contain the same `archivedAt` value.

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```bash
CI=true pnpm test:unit src/features/projects/schemas.test.ts
CI=true pnpm test:integration tests/integration/project-archive.test.ts
```

Expected: FAIL because the archive schema and service do not exist.

- [ ] **Step 4: Add the receipt and strict schema**

Add to `src/server/types.ts`:

```ts
export interface ArchiveProjectReceipt {
  projectId: string;
  workspaceId: string;
  archivedAt: string;
}
```

Add to `src/features/projects/schemas.ts`:

```ts
export const archiveProjectSchema = z.object({ projectId: z.uuid() }).strict();
```

- [ ] **Step 5: Implement the transactional archive service**

Create `src/server/projects/archive-project.ts`:

```ts
import "server-only";

import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { ArchiveProjectReceipt } from "@/server/types";

interface ArchivableProjectRow {
  id: string;
  workspace_id: string;
  archived_at: Date | null;
}

export async function archiveProject(input: {
  actorId: string;
  projectId: string;
}): Promise<ArchiveProjectReceipt> {
  return database().begin(async (sql) => {
    const [authorized] = await sql<ArchivableProjectRow[]>`
      select project.id, project.workspace_id, project.archived_at
      from public.projects as project
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
       and membership.user_id = ${input.actorId}
       and membership.role in ('owner', 'admin')
      where project.id = ${input.projectId}
      for update of project
    `;
    if (!authorized) {
      throw new AppError("NOT_FOUND", "Project not found.");
    }

    const [project] = await sql<ArchivableProjectRow[]>`
      update public.projects
      set
        archived_at = coalesce(archived_at, now()),
        updated_at = case when archived_at is null then now() else updated_at end
      where id = ${authorized.id}
      returning id, workspace_id, archived_at
    `;
    if (!project?.archived_at) {
      throw new Error("Project archive did not return an archive time.");
    }

    return {
      projectId: project.id,
      workspaceId: project.workspace_id,
      archivedAt: project.archived_at.toISOString(),
    };
  });
}
```

- [ ] **Step 6: Add the server action**

In `src/features/projects/actions.ts`, import the schema, service, and receipt. Add:

```ts
export type ArchiveProjectActionState =
  ActionResult<ArchiveProjectReceipt> | null;

export async function archiveProjectAction(
  _previousState: ArchiveProjectActionState,
  formData: FormData,
): Promise<ArchiveProjectActionState> {
  const parsed = archiveProjectSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That project could not be archived. Refresh and try again.",
    };
  }

  try {
    const user = await requireUser();
    const receipt = await archiveProject({
      actorId: user.id,
      projectId: parsed.data.projectId,
    });
    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    revalidatePath(`/workspaces/${receipt.workspaceId}`);
    revalidatePath(
      `/workspaces/${receipt.workspaceId}/projects/${receipt.projectId}`,
    );
    return { ok: true, data: receipt };
  } catch (error) {
    return actionFailure(error);
  }
}
```

- [ ] **Step 7: Run the focused tests**

```bash
CI=true pnpm test:unit src/features/projects/schemas.test.ts
CI=true pnpm test:integration tests/integration/project-archive.test.ts
```

Expected: archive schema and authorization/idempotency tests pass.

- [ ] **Step 8: Commit the service slice**

```bash
git add src/server/types.ts src/features/projects/schemas.ts src/features/projects/schemas.test.ts src/server/projects/archive-project.ts src/features/projects/actions.ts tests/integration/project-archive.test.ts
git commit -m "feat: add authorized project archive service"
```

---

### Task 3: Enforce the active-project boundary everywhere

**Files:**

- Modify: `tests/integration/project-archive.test.ts`
- Modify: `tests/integration/deadline-nudges.test.ts`
- Modify: `src/server/workspaces/get-workspace-overview.ts`
- Modify: `src/server/workspaces/list-workspace-navigation.ts`
- Modify: `src/server/dashboard/get-dashboard.ts`
- Modify: `src/server/projects/get-project-board.ts`
- Modify: `src/server/projects/update-project.ts`
- Modify: `src/server/tasks/create-task.ts`
- Modify: `src/server/tasks/update-task.ts`
- Modify: `src/server/tasks/move-task.ts`
- Modify: `src/server/focus/select-focus-task.ts`
- Modify: `src/server/tasks/complete-task-transaction.ts`
- Modify: `src/server/notifications/scan-deadline-nudges.ts`

**Interfaces:**

- Consumes: `projects.archived_at` and `archiveProject`.
- Produces: one consistent definition of active work: `project.archived_at is null`.
- Preserves: historical completion, ledger, achievement, and notification reads.

- [ ] **Step 1: Extend integration tests for active filtering and preservation**

In `tests/integration/project-archive.test.ts`, create one open assigned task and one completed task before archiving. Record artifact counts, archive, and assert:

```ts
expect(
  (await getWorkspaceOverview({ actorId: ownerId, workspaceId })).projects,
).not.toContainEqual(expect.objectContaining({ id: project.id }));
expect(
  (await listWorkspaceNavigation({ actorId: ownerId })).workspaces.flatMap(
    (workspace) => workspace.projects,
  ),
).not.toContainEqual(expect.objectContaining({ id: project.id }));
expect(
  (await getDashboard({ actorId: memberId, occurredAt })).projects,
).not.toContainEqual(expect.objectContaining({ id: project.id }));
await expect(
  getProjectBoard({ actorId: memberId, projectId: project.id, occurredAt }),
).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found." });

const artifactsAfter = await loadArchiveArtifactCounts(project.id);
expect(artifactsAfter).toEqual(artifactsBefore);
```

Assert the current Focus display is absent after archiving while its stored `focus_selections` row still exists.

- [ ] **Step 2: Add stale-mutation integration assertions**

Against the archived project and task IDs, assert these calls reject:

```ts
const staleAttempts = [
  () =>
    updateProject({
      actorId: ownerId,
      projectId: project.id,
      name: "Stale rename",
      description: null,
    }),
  () =>
    createTask({
      actorId: ownerId,
      projectId: project.id,
      title: "Stale task",
      description: null,
      assignee: { kind: "member", userId: ownerId },
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt,
    }),
  () =>
    updateTask({
      actorId: memberId,
      taskId: openTask.taskId,
      title: "Stale edit",
      description: null,
      assignee: { kind: "member", userId: memberId },
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt,
    }),
  () =>
    moveTask({
      actorId: memberId,
      taskId: openTask.taskId,
      status: "in_progress",
      occurredAt,
    }),
  () =>
    selectFocusTask({
      actorId: memberId,
      taskId: openTask.taskId,
      occurredAt,
    }),
  () =>
    completeTask({
      actorId: memberId,
      taskId: completedTask.taskId,
      occurredAt,
    }),
];

for (const attempt of staleAttempts) {
  await expect(attempt()).rejects.toMatchObject({ code: expect.any(String) });
}
```

Use the existing message shape for each service: project operations return `Project not found.`, task operations return `Task not found.`, and Focus selection returns the existing assigned-workspace-task denial.

- [ ] **Step 3: Add archived deadline coverage**

In `tests/integration/deadline-nudges.test.ts`, import `archiveProject`. Create a second project and a due-soon task for the enabled user, archive that project before the first scan, and leave the existing expected `{ scannedCount: 3, createdCount: 3 }` unchanged. Add:

```ts
const [archivedNotificationCount] = await database()<Array<{ count: number }>>`
  select count(*)::integer as count
  from public.notifications
  where task_id = ${archivedTask.taskId}
`;
expect(archivedNotificationCount?.count).toBe(0);
```

- [ ] **Step 4: Run integration tests and confirm the new assertions fail**

```bash
CI=true pnpm test:integration tests/integration/project-archive.test.ts tests/integration/deadline-nudges.test.ts
```

Expected: FAIL because archived projects still appear and stale services still accept them.

- [ ] **Step 5: Filter active read models**

Apply these exact predicates:

```sql
-- get-workspace-overview.ts project query
where project.workspace_id = ${workspace.id}
  and project.archived_at is null

-- list-workspace-navigation.ts
left join public.projects as project
  on project.workspace_id = workspace.id
 and project.archived_at is null

-- get-dashboard.ts current Focus join
join public.projects as project
  on project.id = task.project_id
 and project.archived_at is null

-- get-dashboard.ts project progress query
where project.archived_at is null

-- get-project-board.ts
where project.id = ${input.projectId}
  and project.archived_at is null
```

Do not filter point-ledger, task-completion, achievement, or existing notification history queries.

- [ ] **Step 6: Guard all project and task mutations**

Add `and project.archived_at is null` to the authorized project/task query in:

- `src/server/projects/update-project.ts`
- `src/server/tasks/create-task.ts`
- `src/server/tasks/update-task.ts`
- `src/server/tasks/move-task.ts`
- `src/server/focus/select-focus-task.ts`
- `src/server/tasks/complete-task-transaction.ts`

Where a mutation already locks a task but not its project, change the lock clause to serialize with archive:

```sql
for update of task, project
```

Keep `update-task.ts`'s existing `for update of task, project, membership` clause.

- [ ] **Step 7: Exclude archived projects from deadline scans**

In `src/server/notifications/scan-deadline-nudges.ts`, add:

```sql
where project.archived_at is null
  and task.status <> 'done'
```

Change its lock clause to:

```sql
for update of task, project skip locked
```

- [ ] **Step 8: Run focused and full integration tests**

```bash
CI=true pnpm test:integration -- tests/integration/project-archive.test.ts tests/integration/deadline-nudges.test.ts
CI=true pnpm test:integration
```

Expected: every integration test passes; archived artifacts remain unchanged and stale mutations fail safely.

- [ ] **Step 9: Commit the active boundary**

```bash
git add tests/integration/project-archive.test.ts tests/integration/deadline-nudges.test.ts src/server/workspaces/get-workspace-overview.ts src/server/workspaces/list-workspace-navigation.ts src/server/dashboard/get-dashboard.ts src/server/projects/get-project-board.ts src/server/projects/update-project.ts src/server/tasks/create-task.ts src/server/tasks/update-task.ts src/server/tasks/move-task.ts src/server/focus/select-focus-task.ts src/server/tasks/complete-task-transaction.ts src/server/notifications/scan-deadline-nudges.ts
git commit -m "fix: keep archived projects out of active work"
```

---

### Task 4: Add the accessible archive confirmation UI

**Files:**

- Modify: `src/components/ui/button.tsx`
- Create: `src/features/projects/archive-project-dialog.tsx`
- Modify: `src/app/(app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx`
- Modify: `src/app/(app)/workspaces/[workspaceId]/page.tsx`
- Create: `tests/e2e/project-archive.spec.ts`

**Interfaces:**

- Consumes: `archiveProjectAction` and `ArchiveProjectActionState`.
- Produces: `ArchiveProjectDialog({ projectId, workspaceId })`.
- Produces: workspace query acknowledgement `projectArchived=1`.

- [ ] **Step 1: Write the failing Playwright flow**

Create `tests/e2e/project-archive.spec.ts` using the existing fresh-signup/onboarding sequence. After project creation:

```ts
const projectUrl = page.url();
await page.setViewportSize({ width: 390, height: 844 });

const archiveTrigger = page.getByRole("button", { name: "Archive project" });
await archiveTrigger.click();
const dialog = page.getByRole("dialog", { name: "Archive this project?" });
await expect(dialog).toContainText(
  "It will leave active project views, while its tasks, points, and completion history stay preserved.",
);
expect(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
).toBe(true);

await dialog.getByRole("button", { name: "Cancel" }).click();
await expect(archiveTrigger).toBeFocused();
await archiveTrigger.click();
await dialog.getByRole("button", { name: "Archive project" }).click();

await expect(page).toHaveURL(/\/workspaces\/[^/?]+\?projectArchived=1$/);
await expect(page.getByRole("status")).toHaveText(
  "Project archived. Its history is preserved.",
);
await expect(page.getByRole("link", { name: projectName })).toHaveCount(0);
await expect(page.getByRole("option", { name: projectName })).toHaveCount(0);

await page.goto(projectUrl);
await expect(
  page.getByRole("heading", { name: "That page is not available" }),
).toBeVisible();
```

- [ ] **Step 2: Run the Playwright file and verify it fails**

```bash
CI=true pnpm test:e2e tests/e2e/project-archive.spec.ts
```

Expected: FAIL because no archive control exists.

- [ ] **Step 3: Add a destructive button variant**

In `src/components/ui/button.tsx`, extend `variant`:

```ts
destructive: "bg-rose-600 text-white hover:bg-rose-700",
```

- [ ] **Step 4: Implement the archive dialog**

Create `src/features/projects/archive-project-dialog.tsx` with `useActionState`, `useRouter`, and the existing Radix dialog primitives. Its action handler must be:

```ts
const handleAction = useCallback(
  async (previousState: ArchiveProjectActionState, formData: FormData) => {
    const result = await archiveProjectAction(previousState, formData);
    if (result?.ok) {
      setOpen(false);
      router.push(`/workspaces/${workspaceId}?projectArchived=1`);
      router.refresh();
    }
    return result;
  },
  [router, workspaceId],
);
```

Render a trigger with `variant="outline"`, a dialog titled **Archive this project?**, the exact approved description, a hidden `projectId`, a safe action error with `role="alert"`, a **Cancel** button, and a `variant="destructive"` submit button whose pending text is **Archiving…**. Disable both dialog actions while pending.

- [ ] **Step 5: Mount the management control**

In the project page, import `ArchiveProjectDialog` and render it inside the existing `canManageProject` block beside `ProjectFormDialog`:

```tsx
<ArchiveProjectDialog projectId={board.id} workspaceId={workspaceId} />
```

- [ ] **Step 6: Add the bounded workspace success message**

Change the workspace page signature to accept:

```ts
searchParams: Promise<{ projectArchived?: string | string[] }>;
```

Resolve it with `params`, treat only the scalar value `"1"` as success, and render before the Team section:

```tsx
{
  projectArchived === "1" ? (
    <p
      role="status"
      className="mb-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
    >
      Project archived. Its history is preserved.
    </p>
  ) : null;
}
```

- [ ] **Step 7: Run the archive Playwright flow**

```bash
CI=true pnpm test:e2e tests/e2e/project-archive.spec.ts
```

Expected: 1 passed; the project disappears from cards and the selector, mobile width has no horizontal overflow, and the saved URL is unavailable.

- [ ] **Step 8: Run accessibility-adjacent unit checks and commit**

```bash
CI=true pnpm lint
CI=true pnpm typecheck
git add src/components/ui/button.tsx src/features/projects/archive-project-dialog.tsx 'src/app/(app)/workspaces/[workspaceId]/projects/[projectId]/page.tsx' 'src/app/(app)/workspaces/[workspaceId]/page.tsx' tests/e2e/project-archive.spec.ts
git commit -m "feat: add project archive confirmation"
```

---

### Task 5: Document the baseline fix and run the release gate

**Files:**

- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/closed-pilot-checklist.md`

**Interfaces:**

- Documents migration `202607180006_project_archive.sql`.
- Documents hide-only archive and deferred restore UI.
- Adds hosted checks without marking them complete before evidence exists.

- [ ] **Step 1: Update repository documentation**

In `README.md`:

- add owner/admin project archive to self-service project management;
- state archived projects leave active views but preserve tasks and reward history;
- add the sixth migration to the migration sequence;
- add restore UI and archived-project administration to deliberate exclusions.

In `docs/deployment.md`:

- add `202607180006_project_archive.sql` after the cohort OAuth migration in the manual migration order;
- add hosted archive smoke: create a disposable project, archive it, verify cards/navigation/direct URL, and confirm preserved database rows;
- retain the rule that migrations run before the application build consuming them.

In `docs/closed-pilot-checklist.md`, add unchecked items:

```markdown
- [ ] Migration `202607180006_project_archive.sql` was reviewed and applied before the archive-capable build.
- [ ] A Production owner archived a disposable project; it disappeared from workspace cards and the project selector.
- [ ] The archived project URL returned the safe unavailable page, while its task and reward history remained preserved.
- [ ] A member could not see or invoke the archive operation.
```

- [ ] **Step 2: Run formatting and static validation**

```bash
CI=true pnpm format
CI=true pnpm format:check
CI=true pnpm lint
CI=true pnpm typecheck
git diff --check
```

Expected: all commands pass with no unrequested file changes.

- [ ] **Step 3: Run the complete local validation matrix**

```bash
CI=true pnpm test:unit
CI=true pnpm test:db
CI=true pnpm test:integration
CI=true pnpm test:e2e
CI=true pnpm test:demo
CI=true pnpm test:e2e:demo
CI=true pnpm check:secrets
CI=true pnpm build
```

Expected: every command exits 0. Record actual file/test/assertion counts; do not claim tests that did not run.

- [ ] **Step 4: Inspect generated-file noise**

Run `git status --short`. If Next.js changed `next-env.d.ts` from the tracked production types reference to the dev reference, restore only that generated line with `apply_patch`; do not include unrelated generated changes.

- [ ] **Step 5: Commit documentation and release evidence**

```bash
git add README.md docs/deployment.md docs/closed-pilot-checklist.md
git commit -m "docs: document project archive operations"
```

---

### Task 6: Merge, migrate, deploy, smoke-test, and submit the second cohort PR

**Files:**

- Modify after hosted evidence: `docs/closed-pilot-checklist.md`
- Modify in cohort repository: `submissions/zukhriddingit-project-1.md`
- Create temporarily outside repositories: `/tmp/momentum-project-archive-pr.md`
- Create temporarily outside repositories: `/tmp/momentum-cohort-fix-pr.md`

**Interfaces:**

- Publishes Momentum feature branch `codex/project-archive`.
- Merges the Momentum application PR only after the Production migration is applied.
- Publishes cohort branch `participants/summer26/phase-1-project-1/zukhriddingit`.
- Opens `[Project 1] Fix — zukhriddingit` into `projects/summer26/phase-1-project-1`.

- [ ] **Step 1: Freeze and publish the Momentum feature branch**

```bash
git status --short
git push -u origin codex/project-archive
```

Create `/tmp/momentum-project-archive-pr.md` with:

```markdown
## Summary

- add owner/admin project archiving with preserved history
- remove archived projects from active views and block stale mutations
- add pgTAP, integration, and Playwright coverage

## Validation

- formatting, lint, strict TypeScript
- unit, pgTAP, integration, and Playwright suites
- demo reproducibility and guided-demo Playwright
- tracked-source secret scan and production build

## Deliberate scope

Restore UI, permanent deletion, and general project lifecycle states remain deferred.
```

Open a ready Momentum PR titled `feat: add project archiving` into `main`.

- [ ] **Step 2: Review the Momentum PR and apply the Production migration**

Confirm the PR diff contains only the planned archive files. Review checks, then run against the linked Production Supabase project:

```bash
pnpm exec supabase db push --linked --dry-run
pnpm exec supabase db push --linked
```

Expected dry-run: only `202607180006_project_archive.sql`. Confirm the linked project reference before the push. The old application remains compatible while the nullable column is added.

- [ ] **Step 3: Merge and verify the Production deployment**

Merge the Momentum PR, update local `main`, and wait for Vercel. Verify:

```bash
curl -fsS https://momentum-bay-two.vercel.app/api/health
```

Expected: HTTP 200 JSON with `status: "ok"`, `environment: "production"`, and a release hash matching merged `main`.

- [ ] **Step 4: Run the hosted archive smoke**

In a fresh Production owner account:

1. Create a disposable workspace and project.
2. Confirm an ordinary member session has no archive button.
3. As owner, open **Archive project**, cancel once to verify focus return, reopen, and confirm.
4. Verify the supportive workspace status.
5. Verify the project is absent from cards and the header project selector.
6. Open the saved project URL and verify the safe unavailable page.
7. At 390×844, verify the dialog and workspace page have no horizontal overflow.
8. Query only safe counts through the trusted operator boundary to confirm tasks, completions, and ledger history were not deleted.

- [ ] **Step 5: Record hosted evidence without changing behavior**

Mark only the exercised archive items complete in `docs/closed-pilot-checklist.md`, include the review date and safe release hash, run:

```bash
CI=true pnpm format:check
CI=true pnpm check:secrets
git diff --check
```

Commit and push the docs-only evidence:

```bash
git add docs/closed-pilot-checklist.md
git commit -m "docs: record production archive verification"
git push origin main
```

Wait for the docs-only Vercel deployment and reconfirm `/api/health`.

- [ ] **Step 6: Refresh the cohort submission branch**

In `/tmp/hult-cohort-program-zukhriddingit`, preserve unrelated changes and run:

```bash
git remote add upstream https://github.com/rogerSuperBuilderAlpha/hult-cohort-program.git
git fetch upstream projects/summer26/phase-1-project-1
git checkout participants/summer26/phase-1-project-1/zukhriddingit
git merge --ff-only upstream/projects/summer26/phase-1-project-1
```

If `upstream` already exists, verify its URL instead of adding it again. Update `submissions/zukhriddingit-project-1.md` to:

- point the current review branch at public Momentum `main`;
- record the merged archive commit and current Production release;
- update actual validation counts;
- add project archive to the architecture and verified baseline behavior;
- remove the stale limitation that workspace assignment is unavailable;
- list restore UI as the deliberate archive limitation;
- retain the six required sections: Production URL, fresh-clone setup, architecture, motivation/engagement notes, known limitations, and agent usage.

- [ ] **Step 7: Validate and push the cohort fix branch**

```bash
git -C /tmp/hult-cohort-program-zukhriddingit diff --check
git -C /tmp/hult-cohort-program-zukhriddingit status --short
git -C /tmp/hult-cohort-program-zukhriddingit add submissions/zukhriddingit-project-1.md
git -C /tmp/hult-cohort-program-zukhriddingit commit -m "docs: verify Momentum project archive fix"
git -C /tmp/hult-cohort-program-zukhriddingit push origin participants/summer26/phase-1-project-1/zukhriddingit
```

- [ ] **Step 8: Open the exact second cohort PR**

Create `/tmp/momentum-cohort-fix-pr.md`:

```markdown
## Production URL

https://momentum-bay-two.vercel.app

## Fix

Momentum now supports owner/admin project archiving. Archived projects leave active workspace cards, project navigation, dashboards, and direct board routes while tasks and immutable reward history remain preserved.

## Fresh-clone validation

The public repository's merged release passed formatting, lint, strict TypeScript, unit tests, pgTAP, integration tests, Playwright flows, demo reproducibility, the guided-demo Playwright flow, the tracked-source secret scan, and a production build. Exact counts are recorded in the submission file.

## Architecture

The nullable `projects.archived_at` migration is applied before the application build. An idempotent server transaction authorizes owners/admins; active reads and trusted mutations require `archived_at is null`.

## Known limitation

Archive restoration UI is deliberately deferred. Archival is non-destructive and history-preserving.

## Agent usage

Codex assisted with the approved design, implementation plan, migration, server authorization, UI, tests, validation, deployment checks, and PR preparation. The human owner approved the archive behavior and reviewed the resulting flow.
```

Open:

```bash
gh pr create \
  --repo rogerSuperBuilderAlpha/hult-cohort-program \
  --head zukhriddingit:participants/summer26/phase-1-project-1/zukhriddingit \
  --base projects/summer26/phase-1-project-1 \
  --title "[Project 1] Fix — zukhriddingit" \
  --body-file /tmp/momentum-cohort-fix-pr.md
```

Expected: a new, non-draft PR URL. Confirm its Files changed view contains only `submissions/zukhriddingit-project-1.md`.

---

## Final definition of done

- Production contains migration `202607180006_project_archive.sql`.
- Owners/admins can archive; members cannot.
- Archived projects leave every active surface and direct routes are safely unavailable.
- Stale project/task/Focus/completion actions fail after archive.
- Tasks, completions, ledger entries, achievements, and notifications remain preserved.
- Deadline scans skip archived work.
- The archive flow is accessible and responsive at 390×844.
- All documented validation commands passed with actual counts recorded.
- Momentum `main` and Production health match.
- The second cohort PR has the exact required branch, base, title, and one-file submission diff.
