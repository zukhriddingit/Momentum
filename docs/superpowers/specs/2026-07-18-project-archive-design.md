# Project Archive Design

## Context

Momentum already supports creating and editing projects. The Hult Project 1
baseline also requires project archival. This change adds that missing lifecycle
operation without turning projects into a broad status-management system or
deleting any work history.

## Goals

- Let workspace owners and admins archive an active project.
- Remove archived projects from every active project list and selector.
- Make archived project routes unavailable through the same safe not-found
  experience used for missing or unauthorized projects.
- Preserve tasks, completions, immutable point-ledger entries, achievements,
  notifications, and progress history.
- Reject stale mutations after a project is archived.
- Keep archival idempotent and server-authorized.
- Add focused database, integration, and end-to-end coverage.

## Non-goals

- Restore or unarchive UI.
- Permanent project deletion.
- Multiple project lifecycle states beyond active and archived.
- Bulk archival, retention policies, or automatic archival.
- Archived-project browsing, search, reporting, or administration.
- Changes to rewards, streaks, achievements, messages, or notifications.

## Confirmed decisions

- Archival is hide-only in the MVP UI and does not delete related records.
- Restoration is deliberately deferred.
- The schema uses nullable `projects.archived_at timestamptz`, not a boolean or
  status enum.
- The first successful archival records the database time. Repeated archival is
  idempotent and preserves that original timestamp.
- Only workspace owners and admins can archive.
- Archived projects are not active work: direct routes and stale mutations are
  rejected.

## Data model and migration

Add a new migration after
`202607180005_cohort_assignment_github_oauth.sql`:

```sql
alter table public.projects
  add column archived_at timestamptz;

create index projects_active_workspace_created_idx
  on public.projects (workspace_id, created_at, id)
  where archived_at is null;
```

The column is nullable so existing projects remain active without a data
rewrite. The partial index supports the active workspace and navigation queries.
The existing project foreign keys and delete behavior remain unchanged.

The migration does not add `archived_by`: authorization is enforced at the
operation boundary, while the baseline needs lifecycle state and timing rather
than a new audit subsystem.

## Domain and service boundaries

Create a server-only `archiveProject` service with this contract:

```ts
interface ArchiveProjectReceipt {
  projectId: string;
  workspaceId: string;
  archivedAt: string;
}

archiveProject(input: {
  actorId: string;
  projectId: string;
}): Promise<ArchiveProjectReceipt>
```

The service runs in a database transaction. It locks the project through a join
to `workspace_memberships` restricted to `owner` and `admin`. Missing,
cross-workspace, and unauthorized projects all raise the existing safe
`NOT_FOUND` shape. The update uses
`archived_at = coalesce(archived_at, now())`, so retries return the same archived
project and do not change the first archive time.

Trusted calculations and immutable completion records are untouched. Archiving
does not award points, change streaks, create achievements, emit notifications,
or alter task status.

## Active-project boundary

Every active project surface adds `archived_at is null`:

- workspace project cards and progress summaries;
- header workspace/project navigation;
- onboarding's check for an existing project;
- dashboard project progress and the current-Focus display;
- project-board loading and direct project routes.

An archived project therefore behaves like an unavailable project when opened
by URL. The application does not reveal whether the project is archived,
missing, or outside the actor's workspace.

Server mutation queries also require the owning project to be active. This
includes project editing, task creation and editing, task movement, Focus
selection, and task completion. A stale browser page cannot continue changing
work after another owner or admin archives the project.

The deadline-nudge scanner also excludes archived projects so inactive work
cannot generate new reminders. Existing completion notifications and point
activity remain visible as preserved history.

## Server action and validation

Add a strict Zod schema containing only `projectId: z.uuid()`. The server action
validates `FormData`, requires the authenticated user, calls `archiveProject`,
and revalidates:

- `/dashboard`;
- `/onboarding`;
- the archived project's workspace route;
- the archived project route;
- shared application navigation.

Validation failures use supportive existing action-result conventions. Service
authorization failures continue to use the generic safe not-found message.

## User interface

Owners and admins see **Archive project** beside **Edit project** on an active
project page. Ordinary members do not see either management operation they are
not authorized to perform.

The archive button opens a confirmation dialog:

- title: **Archive this project?**
- description: **It will leave active project views, while its tasks, points,
  and completion history stay preserved.**
- secondary action: **Cancel**
- primary action: **Archive project**
- pending label: **Archiving…**

The confirmation action is visually destructive but does not use shaming or
punitive language. Focus returns correctly when the dialog is cancelled. While
submitting, both actions are disabled.

After success, the client navigates to the workspace overview with the bounded
query flag `projectArchived=1`. The workspace page renders an accessible status
message: **Project archived. Its history is preserved.** The archived project is
absent from the project grid and header selector.

No archived-project list or restore control is shown.

## Error handling and concurrency

- Invalid project IDs return a validation result without calling the service.
- Missing, unauthorized, and cross-workspace IDs are indistinguishable.
- Two owners archiving concurrently both receive the same persisted first
  archive timestamp.
- A repeated server call remains successful and does not mutate related data.
- A stale mutation that loses the race with archival returns the existing safe
  unavailable result.
- Database failures are handled through the existing safe action boundary; raw
  database errors are not returned to the browser.

## Testing strategy

### Database tests

- The migration leaves existing projects active with `archived_at is null`.
- `archived_at` accepts a timestamp and related task/completion/ledger rows
  remain intact.
- Browser-role writes to `projects.archived_at` remain unavailable under the
  existing server-only mutation model.

### Integration tests

- Owners and admins can archive.
- Members, outsiders, cross-workspace actors, and missing IDs receive the same
  `NOT_FOUND` shape.
- Repeated and concurrent archival preserves one timestamp.
- Workspace overview and navigation omit archived projects.
- Project-board loading rejects archived projects.
- Project edit and representative trusted task mutations reject archived
  projects, including task creation and completion.
- Deadline scans do not create new notifications for archived-project tasks.
- Archival preserves tasks, task completions, point-ledger rows, achievements,
  and notifications.

### End-to-end test

One Playwright flow creates a fresh user, workspace, and project; opens the
project; confirms the archive dialog; verifies the supportive workspace status;
and confirms the project is absent from the workspace cards and header selector.
Opening the saved project URL then shows the safe unavailable page. The test
also checks the archive dialog at the existing mobile-width coverage boundary.

## Documentation and release

- Update the README feature summary and migration sequence.
- Update deployment guidance to apply the archive migration before the build
  that consumes it.
- Update the closed-pilot checklist with hosted archive evidence only after the
  production smoke test succeeds.
- Add restore UI and archived-project administration to deliberate MVP
  exclusions.
- Run formatting, linting, strict type checking, unit tests, database tests,
  integration tests, relevant Playwright tests, the secret scan, and a
  production build.
- Merge the Momentum fix, deploy it, confirm `/api/health`, and manually archive
  a disposable production project.
- Submit the required second Hult cohort PR from branch
  `participants/summer26/phase-1-project-1/zukhriddingit` into
  `projects/summer26/phase-1-project-1` with title
  `[Project 1] Fix — zukhriddingit` and fresh verification evidence.

## Definition of done

The baseline is complete when an owner or admin can archive an active project,
the project disappears from active surfaces, preserved data remains unchanged,
unauthorized and stale operations are rejected safely, automated validation is
green, the production behavior is manually verified, and the second cohort PR
contains the public repository and production evidence required by staff.
