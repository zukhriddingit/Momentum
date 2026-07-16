# Slice 3 Motivation Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Momentum's complete deterministic motivation experience—five achievements, four message tones, authoritative celebrations, personal settings, an actionable in-app notification center, deadline nudges, and an expanded personal dashboard—without changing trusted reward or streak behavior.

**Architecture:** Keep the existing Next.js modular monolith and atomic PostgreSQL completion transaction. Pure TypeScript modules evaluate achievements, prioritize motivation events, select reviewed templates, and classify deadline windows; authenticated Server Actions and one secret-protected job route delegate to server-only services that persist immutable snapshots under existing RLS and authorization boundaries.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript 6, Tailwind CSS 4, shadcn/ui-compatible local components, Supabase Auth/PostgreSQL/RLS, `postgres`, Zod 4, Vitest 4, pgTAP, and Playwright 1.61. No new production dependency.

## Global Constraints

- Read and follow `AGENTS.md` before every task.
- Work from the committed Slice 2 baseline plus the approved design in `docs/superpowers/specs/2026-07-16-motivation-experience-design.md`.
- Use TypeScript with `strict: true`; do not use `any` or unchecked external-boundary assertions.
- Keep reward, streak, achievement, message-selection, and deadline-classification logic outside React components.
- Never accept trusted points, streaks, grant codes, tones, user IDs, or notification source IDs from browser input.
- Preserve base points Small 20, Medium 40, Large 70, and Extra Large 100.
- Preserve timing multipliers 1.20 at least 24 hours early, 1.10 before the deadline, and 1.00 otherwise.
- Preserve `1 + min(0.20, 0.04 * preCompletionStreak)` and current rounding.
- Preserve the streak rule: no Focus selection pauses, an incomplete selected Focus Task breaks, and weekends do neither.
- Preserve the seeded 52-point, streak 2-to-3 path and the unbonused new-user 40-point path.
- Recompletion creates no new reward, streak, grant, notification, or celebration.
- Achievement grants, completion receipts, and positive point-ledger rows remain immutable.
- Persist rendered message event, tone, key, title, and body; setting changes never rewrite history.
- Messages are reviewed static copy with no LLM, randomness, shame, threat, punishment, manipulation, or employee comparison.
- Browser roles receive no trusted write access to generated rewards, grants, or notifications.
- Do not add Resend, email/SMS, phone fields, quiet hours, external workers, production scheduling, invitations, member administration, AI, leaderboards, kudos/social feeds, billing, analytics, or production deployment configuration.
- Do not add a production dependency.
- Follow TDD: write the focused failing test, observe the intended failure, implement the smallest complete behavior, rerun focused tests, then commit.
- Keep the tree clean between tasks and never stage unrelated user changes.

---

## Exact file manifest

### Create

- `supabase/migrations/202607160003_motivation_experience.sql` — event enums, completion snapshots, private preference flags, notification routing/idempotency, achievement definitions, RLS, immutability, and indexes.
- `supabase/tests/database/third_slice.test.sql` — pgTAP contract for Slice 3 schema, grants, policies, indexes, and browser-write denial.
- `src/domain/achievements/achievements.ts` — stable definitions, codes, and pure evaluator.
- `src/domain/achievements/achievements.test.ts` — every threshold, overlap, invalid state, and already-granted rule.
- `src/domain/motivation/types.ts` — tone, event, template, and rendered-message contracts.
- `src/domain/motivation/catalog.ts` — all 56 reviewed templates.
- `src/domain/motivation/select-message.ts` — event priority and stable hash selection.
- `src/domain/motivation/select-message.test.ts` — matrix completeness, stability, priority, and prohibited-language checks.
- `src/domain/notifications/classify-deadline-event.ts` — pure due-soon/overdue classifier.
- `src/domain/notifications/classify-deadline-event.test.ts` — exact boundary tests.
- `src/server/settings/types.ts` — settings read/update contracts.
- `src/server/settings/get-motivation-settings.ts` — current-user settings query.
- `src/server/settings/update-motivation-settings.ts` — authorized transactional profile/preference update.
- `src/features/settings/schemas.ts` — Zod settings boundary.
- `src/features/settings/schemas.test.ts` — tones, booleans, and IANA timezone validation.
- `src/features/settings/actions.ts` — authenticated settings Server Action.
- `src/features/settings/motivation-settings-form.tsx` — accessible settings form.
- `src/app/(app)/settings/page.tsx` — authenticated settings route.
- `src/server/tasks/completion-receipt.ts` — map one immutable receipt row plus all grant rows into the shared completion view model.
- `src/server/notifications/types.ts` — notification summary, item, page, cursor, and scanner receipts.
- `src/server/notifications/cursor.ts` — opaque keyset cursor encoder/decoder.
- `src/server/notifications/get-notification-summary.ts` — unread count and five-item header preview.
- `src/server/notifications/list-notifications.ts` — authorized 20-item keyset history.
- `src/server/notifications/mark-notification-read.ts` — idempotent owned-row read mutation.
- `src/server/notifications/mark-all-notifications-read.ts` — current-user bulk read mutation.
- `src/server/notifications/scan-deadline-nudges.ts` — deterministic idempotent nudge creation.
- `src/features/notifications/actions.ts` — mark-one and mark-all Server Actions.
- `src/features/notifications/notification-icon.tsx` — event-to-icon presentation mapping.
- `src/features/notifications/notification-bell.tsx` — accessible recent preview and mobile sheet.
- `src/features/notifications/notification-list.tsx` — history list and load-more UI.
- `src/app/(app)/notifications/page.tsx` — authenticated notification-history route.
- `src/app/api/jobs/deadline-nudges/route.ts` — POST-only secret-protected dev/test trigger.
- `tests/integration/achievements-and-motivation.test.ts` — all grants, concurrency, snapshots, and exact point regressions.
- `tests/integration/motivation-settings.test.ts` — current-user preference reads, updates, defaults, and isolation.
- `tests/integration/notifications.test.ts` — notification ownership, read state, history, and pagination.
- `tests/integration/deadline-nudges.test.ts` — window, retry, changed-deadline, completed-task, and disabled-preference behavior.
- `tests/e2e/motivation-experience.spec.ts` — settings-to-completion-to-notification-to-nudge browser flow.

### Modify

- `.env.example` — document the server-only job secret.
- `README.md` — describe Slice 3 behavior, local job trigger, migration, validation, and accurate deferrals.
- `playwright.config.ts` — provide only the Next.js test server with a test job secret.
- `supabase/seed.sql` — seed historical First Step and Focused Finish grants while preserving points/streak/project state.
- `src/server/profiles/ensure-profile.ts` — repair the three preference flags alongside profile repair.
- `src/server/tasks/complete-task-transaction.ts` — evaluate all achievements and snapshot one prioritized deterministic message atomically.
- `src/server/tasks/get-completion-celebration.ts` — return all persisted grant and message-event data.
- `src/server/types.ts` — expand completion and dashboard view models only.
- `src/server/dashboard/get-dashboard.ts` — load recent point activity, five achievement states, unread count, and latest message.
- `src/features/tasks/celebration-dialog.tsx` — authoritative variants, task title, plural grants, and reduced motion.
- `src/features/tasks/task-card.tsx` — add a stable authorized hash target for notification links.
- `src/features/dashboard/dashboard-cards.tsx` — render point activity, earned/locked achievements, unread count, and empty states.
- `src/app/(app)/layout.tsx` — load notification summary and render bell/Settings navigation.
- `src/app/globals.css` — restrained celebration motion with `prefers-reduced-motion` override.
- `tests/integration/complete-task.test.ts` — keep exactly-once assertions while expecting both legitimate seeded-path grants.
- `tests/integration/profile-and-onboarding.test.ts` — assert preference initialization and repair.
- `tests/e2e/momentum-happy-path.spec.ts` — preserve 52 points and assert enhanced persisted celebration/dashboard.
- `tests/e2e/new-user-self-service.spec.ts` — preserve the unbonused 40-point self-service flow with complete achievements.
- `tests/fixtures/demo.ts` — expose stable expected achievement codes and nudge instants.
- `tests/fixtures/self-service.ts` — expose the shared Playwright job secret and tone expectations.

### Delete after replacements compile

- `src/domain/achievements/momentum-three.ts` — replaced by the complete achievement evaluator.
- `src/domain/motivation/focus-complete.ts` — replaced by the typed 56-template catalog and selector.

## Dependency and contributor order

```text
Task 1 database contract
├── Task 2 achievements domain ─┐
├── Task 3 motivation domain ───┼── Task 4 completion integration
├── Task 5 settings ────────────┤
└── Task 6 notification reads ──┼── Task 7 deadline nudges
                                └── Task 8 celebration/dashboard
                                         └── Task 9 browser/docs/release gate
```

After Task 1, Tasks 2 and 3 have no file overlap and can be assigned
independently. Tasks 5 and 6 can also proceed independently after Task 1 because
their contracts are colocated under separate feature/server directories; Task 6
alone owns the app layout. Task 7 depends on Task 3's selector and Task 6's
notification types. Task 4 and Task 8 are intentional integration gates and
must be sequential because both consume the central completion/dashboard view
models. Task 9 is the single final convergence task.

---

### Task 1: Add the Slice 3 database contract and deterministic seed state

**Files:**

- Create: `supabase/migrations/202607160003_motivation_experience.sql`
- Create: `supabase/tests/database/third_slice.test.sql`
- Modify: `supabase/seed.sql`
- Modify: `tests/integration/profile-and-onboarding.test.ts`

**Interfaces:**

- Produces: `public.motivation_event_type`, expanded `public.notification_event_type`, `public.motivation_preferences`, completion message snapshots, notification routing/deadline fields, exact uniqueness indexes, and five stable achievement definitions.
- Produces: one preference row per profile and immutable notification content with a one-way `read_at` transition.
- Consumes: existing profiles, tasks, completions, notifications, Auth trigger, and immutable-trigger conventions.

- [ ] **Step 1: Write the failing pgTAP contract**

Create `supabase/tests/database/third_slice.test.sql` with explicit assertions:

```sql
begin;

select plan(20);

select has_type('public', 'motivation_event_type', 'motivation events are typed');
select has_table('public', 'motivation_preferences', 'motivation preferences exist');
select has_column('public', 'task_completions', 'task_title', 'completion stores task title');
select has_column('public', 'task_completions', 'message_event', 'completion stores message event');
select has_column('public', 'task_completions', 'message_tone', 'completion stores message tone');
select has_column('public', 'notifications', 'project_id', 'notifications route to projects');
select has_column('public', 'notifications', 'task_id', 'notifications route to tasks');
select has_column('public', 'notifications', 'deadline_at', 'notifications snapshot exact deadline');
select has_index('public', 'notifications', 'notifications_user_history_idx', 'notification history is indexed');
select has_index('public', 'notifications', 'notifications_user_unread_idx', 'unread notifications are indexed');
select has_index('public', 'notifications', 'notifications_completion_identity_idx', 'completion notification identity is unique');
select has_index('public', 'notifications', 'notifications_deadline_identity_idx', 'deadline notification identity is unique');
select has_index('public', 'tasks', 'tasks_open_deadline_idx', 'deadline scans are indexed');
select has_check('public', 'notifications', 'notifications_deadline_shape', 'deadline notification shape is constrained');

select results_eq(
  $$ select code from public.achievement_definitions order by code $$,
  $$ values
    ('ahead_of_schedule'::text),
    ('first_step'::text),
    ('five_day_flow'::text),
    ('focused_finish'::text),
    ('momentum_three'::text) $$,
  'all five achievements are seeded'
);

select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.motivation_preferences', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.motivation_preferences', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.motivation_preferences', 'DELETE'),
  'authenticated browser cannot write motivation preferences'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.notifications', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.notifications', 'DELETE'),
  'authenticated browser cannot write generated notifications'
);
select has_policy('public', 'motivation_preferences', 'users read their motivation preferences', 'preferences have owner read RLS');
select has_trigger('public', 'notifications', 'notification_content_is_immutable', 'notification content is protected');
select has_trigger('auth', 'users', 'initialize_auth_profile_after_insert', 'auth initialization remains installed');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database contract and verify the intended failure**

Run: `pnpm test:db`

Expected: FAIL because `motivation_event_type`, `motivation_preferences`, the
new columns, indexes, trigger, policy, and four definitions do not exist.

- [ ] **Step 3: Implement the additive migration**

Create `202607160003_motivation_experience.sql` with these complete schema
operations in this order:

```sql
create type public.motivation_event_type as enum (
  'task_completed',
  'completed_early',
  'focus_task_completed',
  'streak_extended',
  'achievement_unlocked',
  'deadline_approaching',
  'overdue_recovery'
);

alter type public.notification_event_type add value if not exists 'task_completed';
alter type public.notification_event_type add value if not exists 'achievement_unlocked';
alter type public.notification_event_type add value if not exists 'streak_extended';
alter type public.notification_event_type add value if not exists 'deadline_approaching';
alter type public.notification_event_type add value if not exists 'overdue_recovery';

alter table public.task_completions
  add column task_title text,
  add column message_event public.motivation_event_type,
  add column message_tone public.motivation_tone;

update public.task_completions as completion
set task_title = task.title,
    message_event = 'focus_task_completed',
    message_tone = 'friendly'
from public.tasks as task
where task.id = completion.task_id
  and (completion.task_title is null
    or completion.message_event is null
    or completion.message_tone is null);

update public.task_completions
set message_event = 'focus_task_completed', message_tone = 'friendly'
where message_event is null or message_tone is null;

alter table public.task_completions
  alter column task_title set not null,
  alter column message_event set not null,
  alter column message_tone set not null;

create table public.motivation_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  deadline_nudges_enabled boolean not null default true,
  celebration_animation_enabled boolean not null default true,
  achievement_visibility_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.motivation_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.motivation_preferences enable row level security;
create policy "users read their motivation preferences"
on public.motivation_preferences for select to authenticated
using (user_id = auth.uid());
grant select on public.motivation_preferences to authenticated;

alter table public.notifications
  add column project_id uuid references public.projects (id),
  add column task_id uuid references public.tasks (id),
  add column deadline_at timestamptz;

update public.notifications as notification
set project_id = completion.project_id, task_id = completion.task_id
from public.task_completions as completion
where notification.source_id = completion.id;

alter table public.notifications
  drop constraint notifications_user_id_event_type_source_id_key;

alter table public.notifications
  add constraint notifications_deadline_shape check (
    (
      event_type::text in ('deadline_approaching', 'overdue_recovery')
      and deadline_at is not null
      and task_id is not null
    )
    or (
      event_type::text not in ('deadline_approaching', 'overdue_recovery')
      and deadline_at is null
    )
  );

create unique index notifications_completion_identity_idx
  on public.notifications (user_id, event_type, source_id)
  where deadline_at is null;
create unique index notifications_deadline_identity_idx
  on public.notifications (user_id, task_id, event_type, deadline_at)
  where deadline_at is not null;
create index notifications_user_history_idx
  on public.notifications (user_id, created_at desc, id desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc, id desc)
  where read_at is null;
create index tasks_open_deadline_idx
  on public.tasks (assignee_id, due_at)
  where due_at is not null and status <> 'done';

create function public.protect_notification_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'notifications cannot be deleted' using errcode = '55000';
  end if;
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.workspace_id is distinct from old.workspace_id
    or new.event_type is distinct from old.event_type
    or new.source_id is distinct from old.source_id
    or new.tone is distinct from old.tone
    or new.template_key is distinct from old.template_key
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
    or new.project_id is distinct from old.project_id
    or new.task_id is distinct from old.task_id
    or new.deadline_at is distinct from old.deadline_at
    or (old.read_at is not null and new.read_at is distinct from old.read_at)
    or (old.read_at is null and new.read_at is null) then
    raise exception 'notification content is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger notification_content_is_immutable
before update or delete on public.notifications
for each row execute function public.protect_notification_content();

insert into public.achievement_definitions (code, name, description, icon)
values
  ('first_step', 'First Step', 'Complete your first task.', 'footprints'),
  ('focused_finish', 'Focused Finish', 'Complete your first Focus Task.', 'target'),
  ('momentum_three', 'Momentum Three', 'Reach a three-workday Focus Streak.', 'flame'),
  ('five_day_flow', 'Five-Day Flow', 'Reach a five-workday Focus Streak.', 'waves'),
  ('ahead_of_schedule', 'Ahead of Schedule', 'Complete a task at least 24 hours early.', 'clock-check')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon;
```

In the same migration, replace `initialize_auth_profile()` with the complete
validated function below so future Auth users receive both rows atomically:

```sql
create or replace function public.initialize_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := trim(
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  requested_timezone text := coalesce(
    new.raw_user_meta_data ->> 'timezone',
    ''
  );
begin
  if char_length(requested_name) not between 1 and 80 then
    raise exception 'valid display_name metadata is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = requested_timezone
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

Keep the existing `initialize_auth_profile_after_insert` trigger name unchanged;
`create or replace function` retains its binding.

- [ ] **Step 4: Update deterministic seed grants**

Add stable grant IDs and insert two historical grants after seeded completion
rows and before the block ends:

```sql
insert into public.achievement_grants (
  id, user_id, achievement_code, completion_id, granted_at
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    demo_user_id,
    'first_step',
    first_completion_id,
    first_completed_at
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    demo_user_id,
    'focused_finish',
    first_completion_id,
    first_completed_at
  );
```

Do not seed Momentum Three, Five-Day Flow, or Ahead of Schedule.

- [ ] **Step 5: Extend profile/onboarding integration coverage**

After creating a fresh Auth user, query and assert the defaults:

```ts
const preferenceRows = await database()<
  Array<{
    deadline_nudges_enabled: boolean;
    celebration_animation_enabled: boolean;
    achievement_visibility_enabled: boolean;
  }>
>`
  select deadline_nudges_enabled,
         celebration_animation_enabled,
         achievement_visibility_enabled
  from public.motivation_preferences
  where user_id = ${createdUserId}
`;

expect(preferenceRows[0]).toEqual({
  deadline_nudges_enabled: true,
  celebration_animation_enabled: true,
  achievement_visibility_enabled: true,
});
```

- [ ] **Step 6: Reset and run focused database/integration tests**

Run:

```bash
pnpm supabase:reset
pnpm test:db
pnpm test:integration -- tests/integration/profile-and-onboarding.test.ts
```

Expected: database assertions PASS; profile initialization/repair tests PASS;
the demo still has 41 historical points and streak count 2.

- [ ] **Step 7: Commit the database contract**

```bash
git add supabase/migrations/202607160003_motivation_experience.sql supabase/tests/database/third_slice.test.sql supabase/seed.sql tests/integration/profile-and-onboarding.test.ts
git commit -m "feat: add motivation experience database contract"
```

---

### Task 2: Implement the complete pure achievement evaluator

**Files:**

- Create: `src/domain/achievements/achievements.ts`
- Create: `src/domain/achievements/achievements.test.ts`
- Delete after Task 4 imports migrate: `src/domain/achievements/momentum-three.ts`

**Interfaces:**

- Produces: `AchievementCode`, `AchievementDefinition`, `ACHIEVEMENTS`, and `evaluateAchievements(input): AchievementCode[]`.
- Consumes: `TimingMultiplier` from `src/domain/rewards/types.ts`.

- [ ] **Step 1: Write failing achievement tests**

Cover each condition independently, all five overlapping, already-granted
filtering, 2-to-3 and 4-to-5 crossings, non-Focus completions, 1.10 timing, and
invalid counters. Use this builder so every case names all authoritative input:

```ts
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  type AchievementEvaluationInput,
} from "@/domain/achievements/achievements";

const baseline: AchievementEvaluationInput = {
  priorCompletionCount: 3,
  priorFocusCompletionCount: 2,
  completedFocusTask: false,
  preCompletionStreak: 2,
  postCompletionStreak: 2,
  timingMultiplier: 1,
  alreadyGranted: new Set(),
};

describe("evaluateAchievements", () => {
  it("defines the five stable codes", () => {
    expect(ACHIEVEMENTS.map(({ code }) => code)).toEqual([
      "first_step",
      "focused_finish",
      "momentum_three",
      "five_day_flow",
      "ahead_of_schedule",
    ]);
  });

  it.each([
    [{ ...baseline, priorCompletionCount: 0 }, ["first_step"]],
    [
      {
        ...baseline,
        priorFocusCompletionCount: 0,
        completedFocusTask: true,
      },
      ["focused_finish"],
    ],
    [
      {
        ...baseline,
        completedFocusTask: true,
        preCompletionStreak: 2,
        postCompletionStreak: 3,
      },
      ["momentum_three"],
    ],
    [
      {
        ...baseline,
        completedFocusTask: true,
        preCompletionStreak: 4,
        postCompletionStreak: 5,
      },
      ["five_day_flow"],
    ],
    [{ ...baseline, timingMultiplier: 1.2 }, ["ahead_of_schedule"]],
  ] satisfies Array<[AchievementEvaluationInput, string[]]>)(
    "returns only the qualifying stable code for %#",
    (input, expected) => expect(evaluateAchievements(input)).toEqual(expected),
  );

  it("returns every possible overlapping first Focus achievement in definition order", () => {
    expect(
      evaluateAchievements({
        ...baseline,
        priorCompletionCount: 0,
        priorFocusCompletionCount: 0,
        completedFocusTask: true,
        preCompletionStreak: 2,
        postCompletionStreak: 3,
        timingMultiplier: 1.2,
      }),
    ).toEqual([
      "first_step",
      "focused_finish",
      "momentum_three",
      "ahead_of_schedule",
    ]);
  });

  it("filters grants already owned by the user", () => {
    expect(
      evaluateAchievements({
        ...baseline,
        priorCompletionCount: 0,
        timingMultiplier: 1.2,
        alreadyGranted: new Set(["first_step"]),
      }),
    ).toEqual(["ahead_of_schedule"]);
  });

  it("rejects contradictory authoritative counters", () => {
    expect(() =>
      evaluateAchievements({ ...baseline, priorCompletionCount: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      evaluateAchievements({
        ...baseline,
        preCompletionStreak: 5,
        postCompletionStreak: 3,
      }),
    ).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run: `pnpm exec vitest run src/domain/achievements/achievements.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement definitions and evaluation**

Use a readonly definition tuple and explicit conditions:

```ts
import type { TimingMultiplier } from "@/domain/rewards/types";

export const ACHIEVEMENTS = [
  {
    code: "first_step",
    name: "First Step",
    description: "Complete your first task.",
    icon: "footprints",
  },
  {
    code: "focused_finish",
    name: "Focused Finish",
    description: "Complete your first Focus Task.",
    icon: "target",
  },
  {
    code: "momentum_three",
    name: "Momentum Three",
    description: "Reach a three-workday Focus Streak.",
    icon: "flame",
  },
  {
    code: "five_day_flow",
    name: "Five-Day Flow",
    description: "Reach a five-workday Focus Streak.",
    icon: "waves",
  },
  {
    code: "ahead_of_schedule",
    name: "Ahead of Schedule",
    description: "Complete a task at least 24 hours early.",
    icon: "clock-check",
  },
] as const;

export type AchievementDefinition = (typeof ACHIEVEMENTS)[number];
export type AchievementCode = AchievementDefinition["code"];

export interface AchievementEvaluationInput {
  priorCompletionCount: number;
  priorFocusCompletionCount: number;
  completedFocusTask: boolean;
  preCompletionStreak: number;
  postCompletionStreak: number;
  timingMultiplier: TimingMultiplier;
  alreadyGranted: ReadonlySet<AchievementCode>;
}

export function evaluateAchievements(
  input: AchievementEvaluationInput,
): AchievementCode[] {
  if (
    !Number.isInteger(input.priorCompletionCount) ||
    !Number.isInteger(input.priorFocusCompletionCount) ||
    input.priorCompletionCount < 0 ||
    input.priorFocusCompletionCount < 0 ||
    input.preCompletionStreak < 0 ||
    input.postCompletionStreak < input.preCompletionStreak ||
    input.postCompletionStreak > input.preCompletionStreak + 1
  ) {
    throw new RangeError("Authoritative achievement state is invalid.");
  }

  const qualifies = new Set<AchievementCode>();
  if (input.priorCompletionCount === 0) qualifies.add("first_step");
  if (input.completedFocusTask && input.priorFocusCompletionCount === 0) {
    qualifies.add("focused_finish");
  }
  if (
    input.completedFocusTask &&
    input.preCompletionStreak < 3 &&
    input.postCompletionStreak >= 3
  ) {
    qualifies.add("momentum_three");
  }
  if (
    input.completedFocusTask &&
    input.preCompletionStreak < 5 &&
    input.postCompletionStreak >= 5
  ) {
    qualifies.add("five_day_flow");
  }
  if (input.timingMultiplier === 1.2) {
    qualifies.add("ahead_of_schedule");
  }

  return ACHIEVEMENTS.map(({ code }) => code).filter(
    (code) => qualifies.has(code) && !input.alreadyGranted.has(code),
  );
}
```

- [ ] **Step 4: Run achievement and reward/streak regression tests**

Run:

```bash
pnpm exec vitest run src/domain/achievements/achievements.test.ts src/domain/rewards/calculate-point-breakdown.test.ts src/domain/streaks/calculate-streak-transition.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the achievement domain**

```bash
git add src/domain/achievements/achievements.ts src/domain/achievements/achievements.test.ts
git commit -m "feat: add complete achievement evaluation"
```

---

### Task 3: Add deterministic motivation templates and deadline classification

**Files:**

- Create: `src/domain/motivation/types.ts`
- Create: `src/domain/motivation/catalog.ts`
- Create: `src/domain/motivation/select-message.ts`
- Create: `src/domain/motivation/select-message.test.ts`
- Create: `src/domain/notifications/classify-deadline-event.ts`
- Create: `src/domain/notifications/classify-deadline-event.test.ts`
- Delete after Task 4 imports migrate: `src/domain/motivation/focus-complete.ts`

**Interfaces:**

- Produces: `MotivationTone`, `MotivationEvent`, `MotivationMessage`, `selectPrimaryCompletionEvent`, `selectMotivationMessage`, and `classifyDeadlineEvent`.
- Consumes: `AchievementCode` and reward `TimingMultiplier`.

- [ ] **Step 1: Write failing motivation and deadline tests**

The message test must enumerate all 28 event/tone pairs, assert exactly two
variants each, select the same key/title/body repeatedly for one source ID, and
check every title/body against prohibited patterns:

```ts
const prohibited = [
  /\blazy\b/i,
  /\bfail(?:ed|ure)?\b/i,
  /\bpunish(?:ed|ment)?\b/i,
  /\bshould have\b/i,
  /\bdisappoint(?:ed|ment)?\b/i,
  /\bbehind (?:everyone|the team)\b/i,
  /\bworse than\b/i,
  /\bor else\b/i,
];

for (const event of MOTIVATION_EVENTS) {
  for (const tone of MOTIVATION_TONES) {
    const templates = MESSAGE_CATALOG[event][tone];
    expect(templates).toHaveLength(2);
    for (const template of templates) {
      expect(template.key).toMatch(new RegExp(`^${event}-${tone}-v[12]$`));
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.body.length).toBeGreaterThan(0);
      expect(template.body.length).toBeLessThanOrEqual(140);
      for (const pattern of prohibited) {
        expect(`${template.title} ${template.body}`).not.toMatch(pattern);
      }
    }
  }
}
```

Add priority assertions for achievement visibility, streak, Focus, early, and
ordinary events. In the deadline test assert:

```ts
const addMilliseconds = (date: Date, milliseconds: number) =>
  new Date(date.getTime() + milliseconds);
const addHours = (date: Date, hours: number) =>
  addMilliseconds(date, hours * 60 * 60 * 1000);

expect(classifyDeadlineEvent({ now, dueAt: addHours(now, 24) })).toBe(
  "deadline_approaching",
);
expect(classifyDeadlineEvent({ now, dueAt: addMilliseconds(now, 1) })).toBe(
  "deadline_approaching",
);
expect(classifyDeadlineEvent({ now, dueAt: now })).toBe("overdue_recovery");
expect(
  classifyDeadlineEvent({
    now,
    dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1),
  }),
).toBeNull();
```

Use local test helpers that construct dates with integer millisecond arithmetic;
do not add a date library.

- [ ] **Step 2: Run focused tests and verify missing-module failures**

Run:

```bash
pnpm exec vitest run src/domain/motivation/select-message.test.ts src/domain/notifications/classify-deadline-event.test.ts
```

Expected: FAIL because the motivation and notification domain modules do not
exist.

- [ ] **Step 3: Define strict motivation contracts and event priority**

Create `types.ts` and the selector contracts:

```ts
export const MOTIVATION_TONES = [
  "calm",
  "friendly",
  "energetic",
  "minimal",
] as const;
export type MotivationTone = (typeof MOTIVATION_TONES)[number];

export const MOTIVATION_EVENTS = [
  "task_completed",
  "completed_early",
  "focus_task_completed",
  "streak_extended",
  "achievement_unlocked",
  "deadline_approaching",
  "overdue_recovery",
] as const;
export type MotivationEvent = (typeof MOTIVATION_EVENTS)[number];

export interface MotivationTemplate {
  key: string;
  title: string;
  body: string;
}

export interface MotivationMessage extends MotivationTemplate {
  event: MotivationEvent;
  tone: MotivationTone;
}
```

```ts
export function selectPrimaryCompletionEvent(input: {
  newAchievementCodes: readonly AchievementCode[];
  achievementVisibilityEnabled: boolean;
  streakIncremented: boolean;
  completedFocusTask: boolean;
  timingMultiplier: TimingMultiplier;
}): MotivationEvent {
  if (
    input.achievementVisibilityEnabled &&
    input.newAchievementCodes.length > 0
  )
    return "achievement_unlocked";
  if (input.streakIncremented) return "streak_extended";
  if (input.completedFocusTask) return "focus_task_completed";
  if (input.timingMultiplier === 1.2) return "completed_early";
  return "task_completed";
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function selectMotivationMessage(input: {
  event: MotivationEvent;
  tone: MotivationTone;
  sourceId: string;
}): MotivationMessage {
  const templates = MESSAGE_CATALOG[input.event][input.tone];
  const template =
    templates[
      stableHash(`${input.event}:${input.tone}:${input.sourceId}`) %
        templates.length
    ];
  return { ...template, event: input.event, tone: input.tone };
}
```

- [ ] **Step 4: Create the complete reviewed 56-template catalog**

Use a typed helper so every pair must contain exactly two variants:

```ts
const pair = (
  first: MotivationTemplate,
  second: MotivationTemplate,
): readonly [MotivationTemplate, MotivationTemplate] => [first, second];

export const MESSAGE_CATALOG = {
  task_completed: {
    calm: pair(
      {
        key: "task_completed-calm-v1",
        title: "Task complete",
        body: "A steady step forward is now recorded.",
      },
      {
        key: "task_completed-calm-v2",
        title: "Progress saved",
        body: "This task is finished, and your progress is in place.",
      },
    ),
    friendly: pair(
      {
        key: "task_completed-friendly-v1",
        title: "Task complete",
        body: "Nice work — another task moved forward.",
      },
      {
        key: "task_completed-friendly-v2",
        title: "Progress made",
        body: "You wrapped this up and made the next step clearer.",
      },
    ),
    energetic: pair(
      {
        key: "task_completed-energetic-v1",
        title: "Task complete",
        body: "Great finish — this task is done.",
      },
      {
        key: "task_completed-energetic-v2",
        title: "Progress unlocked",
        body: "You closed the loop and moved the project forward.",
      },
    ),
    minimal: pair(
      {
        key: "task_completed-minimal-v1",
        title: "Task complete",
        body: "Progress recorded.",
      },
      {
        key: "task_completed-minimal-v2",
        title: "Done",
        body: "Task completion saved.",
      },
    ),
  },
  completed_early: {
    calm: pair(
      {
        key: "completed_early-calm-v1",
        title: "Finished ahead",
        body: "You completed this with time to spare.",
      },
      {
        key: "completed_early-calm-v2",
        title: "Early progress",
        body: "This task is complete ahead of its deadline.",
      },
    ),
    friendly: pair(
      {
        key: "completed_early-friendly-v1",
        title: "Ahead of schedule",
        body: "Nice work — you finished with room before the deadline.",
      },
      {
        key: "completed_early-friendly-v2",
        title: "Early finish",
        body: "You wrapped this up early and moved things forward.",
      },
    ),
    energetic: pair(
      {
        key: "completed_early-energetic-v1",
        title: "Early finish",
        body: "Strong timing — this task landed ahead of schedule.",
      },
      {
        key: "completed_early-energetic-v2",
        title: "Ahead and done",
        body: "You finished early and cleared the way for what is next.",
      },
    ),
    minimal: pair(
      {
        key: "completed_early-minimal-v1",
        title: "Completed early",
        body: "Finished at least 24 hours ahead.",
      },
      {
        key: "completed_early-minimal-v2",
        title: "Ahead of schedule",
        body: "Task completed early.",
      },
    ),
  },
  focus_task_completed: {
    calm: pair(
      {
        key: "focus_task_completed-calm-v1",
        title: "Focus complete",
        body: "Today’s chosen task is complete. Your attention carried it through.",
      },
      {
        key: "focus_task_completed-calm-v2",
        title: "Focused progress",
        body: "You followed through on today’s focus.",
      },
    ),
    friendly: pair(
      {
        key: "focus_task_completed-friendly-v1",
        title: "Focus task complete",
        body: "Nice work — you followed through on today’s focus and built real momentum.",
      },
      {
        key: "focus_task_completed-friendly-v2",
        title: "Focused finish",
        body: "You chose one priority and carried it through.",
      },
    ),
    energetic: pair(
      {
        key: "focus_task_completed-energetic-v1",
        title: "Focus complete",
        body: "You picked the priority and brought it home.",
      },
      {
        key: "focus_task_completed-energetic-v2",
        title: "Focused win",
        body: "Today’s Focus Task is complete and progress is moving.",
      },
    ),
    minimal: pair(
      {
        key: "focus_task_completed-minimal-v1",
        title: "Focus complete",
        body: "Today’s Focus Task is done.",
      },
      {
        key: "focus_task_completed-minimal-v2",
        title: "Focused progress",
        body: "Selected task completed.",
      },
    ),
  },
  streak_extended: {
    calm: pair(
      {
        key: "streak_extended-calm-v1",
        title: "Streak extended",
        body: "Another focused workday is now part of your streak.",
      },
      {
        key: "streak_extended-calm-v2",
        title: "Steady momentum",
        body: "Your Focus Streak grew by one workday.",
      },
    ),
    friendly: pair(
      {
        key: "streak_extended-friendly-v1",
        title: "Streak extended",
        body: "You followed through again and added another focused day.",
      },
      {
        key: "streak_extended-friendly-v2",
        title: "Momentum growing",
        body: "Another Focus Task complete, another day in your streak.",
      },
    ),
    energetic: pair(
      {
        key: "streak_extended-energetic-v1",
        title: "Streak extended",
        body: "Another focused day is on the board.",
      },
      {
        key: "streak_extended-energetic-v2",
        title: "Momentum up",
        body: "You completed the focus and grew the streak.",
      },
    ),
    minimal: pair(
      {
        key: "streak_extended-minimal-v1",
        title: "Streak extended",
        body: "Focus Streak increased by one.",
      },
      {
        key: "streak_extended-minimal-v2",
        title: "Streak updated",
        body: "Another focused workday recorded.",
      },
    ),
  },
  achievement_unlocked: {
    calm: pair(
      {
        key: "achievement_unlocked-calm-v1",
        title: "Achievement unlocked",
        body: "This milestone reflects the progress you have built.",
      },
      {
        key: "achievement_unlocked-calm-v2",
        title: "Milestone reached",
        body: "Your completed work added a new achievement.",
      },
    ),
    friendly: pair(
      {
        key: "achievement_unlocked-friendly-v1",
        title: "Achievement unlocked",
        body: "Nice work — your progress earned a new milestone.",
      },
      {
        key: "achievement_unlocked-friendly-v2",
        title: "New milestone",
        body: "You reached an achievement through work you completed.",
      },
    ),
    energetic: pair(
      {
        key: "achievement_unlocked-energetic-v1",
        title: "Achievement unlocked",
        body: "A new milestone just joined your progress.",
      },
      {
        key: "achievement_unlocked-energetic-v2",
        title: "Milestone reached",
        body: "Your completed work unlocked something new.",
      },
    ),
    minimal: pair(
      {
        key: "achievement_unlocked-minimal-v1",
        title: "Achievement unlocked",
        body: "New milestone recorded.",
      },
      {
        key: "achievement_unlocked-minimal-v2",
        title: "Milestone reached",
        body: "Achievement added.",
      },
    ),
  },
  deadline_approaching: {
    calm: pair(
      {
        key: "deadline_approaching-calm-v1",
        title: "Deadline approaching",
        body: "This task is due within 24 hours. A clear next step may help.",
      },
      {
        key: "deadline_approaching-calm-v2",
        title: "Due soon",
        body: "There is still time to choose a manageable next step.",
      },
    ),
    friendly: pair(
      {
        key: "deadline_approaching-friendly-v1",
        title: "Due soon",
        body: "This task is due within 24 hours. What is the smallest useful next step?",
      },
      {
        key: "deadline_approaching-friendly-v2",
        title: "A deadline is close",
        body: "A quick next step can make this task easier to finish.",
      },
    ),
    energetic: pair(
      {
        key: "deadline_approaching-energetic-v1",
        title: "Due soon",
        body: "This task is within 24 hours. Pick one clear next move.",
      },
      {
        key: "deadline_approaching-energetic-v2",
        title: "Next step ready",
        body: "The deadline is close, and one focused action can move it forward.",
      },
    ),
    minimal: pair(
      {
        key: "deadline_approaching-minimal-v1",
        title: "Due soon",
        body: "Deadline is within 24 hours.",
      },
      {
        key: "deadline_approaching-minimal-v2",
        title: "Deadline approaching",
        body: "Choose the next task step.",
      },
    ),
  },
  overdue_recovery: {
    calm: pair(
      {
        key: "overdue_recovery-calm-v1",
        title: "Ready for a next step",
        body: "This task is overdue. A small next action can restart progress.",
      },
      {
        key: "overdue_recovery-calm-v2",
        title: "Progress can restart",
        body: "The deadline has passed, and the next manageable step still matters.",
      },
    ),
    friendly: pair(
      {
        key: "overdue_recovery-friendly-v1",
        title: "Let’s get this moving",
        body: "This task is overdue, and one small next step can help.",
      },
      {
        key: "overdue_recovery-friendly-v2",
        title: "A fresh next step",
        body: "The deadline passed, but progress can restart from here.",
      },
    ),
    energetic: pair(
      {
        key: "overdue_recovery-energetic-v1",
        title: "Start the next step",
        body: "This task is overdue. Choose one action and move it forward.",
      },
      {
        key: "overdue_recovery-energetic-v2",
        title: "Back into motion",
        body: "The deadline passed, and a clear next move can restart progress.",
      },
    ),
    minimal: pair(
      {
        key: "overdue_recovery-minimal-v1",
        title: "Next step",
        body: "Task is overdue. Choose one action.",
      },
      {
        key: "overdue_recovery-minimal-v2",
        title: "Resume progress",
        body: "Deadline passed. Progress can restart.",
      },
    ),
  },
} as const satisfies Record<
  MotivationEvent,
  Record<MotivationTone, readonly [MotivationTemplate, MotivationTemplate]>
>;
```

- [ ] **Step 5: Implement exact deadline classification**

```ts
export type DeadlineEvent = "deadline_approaching" | "overdue_recovery";

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyDeadlineEvent(input: {
  now: Date;
  dueAt: Date;
}): DeadlineEvent | null {
  const nowMs = input.now.getTime();
  const dueMs = input.dueAt.getTime();
  if (Number.isNaN(nowMs) || Number.isNaN(dueMs)) {
    throw new RangeError("Deadline classification requires valid dates.");
  }
  if (dueMs <= nowMs) return "overdue_recovery";
  if (dueMs <= nowMs + DAY_MS) return "deadline_approaching";
  return null;
}
```

- [ ] **Step 6: Run all new domain tests and format the catalog**

Run:

```bash
pnpm exec prettier --write src/domain/motivation src/domain/notifications
pnpm exec vitest run src/domain/motivation/select-message.test.ts src/domain/notifications/classify-deadline-event.test.ts
```

Expected: all message matrix, stability, priority, language, and deadline tests
PASS.

- [ ] **Step 7: Commit the motivation domain**

```bash
git add src/domain/motivation src/domain/notifications
git commit -m "feat: add deterministic motivation messages"
```

---

### Task 4: Integrate achievements and message snapshots into atomic completion

**Files:**

- Create: `src/server/tasks/completion-receipt.ts`
- Create: `tests/integration/achievements-and-motivation.test.ts`
- Modify: `src/server/tasks/complete-task-transaction.ts`
- Modify: `src/server/tasks/get-completion-celebration.ts`
- Modify: `src/server/types.ts`
- Modify: `tests/integration/complete-task.test.ts`
- Delete: `src/domain/achievements/momentum-three.ts`
- Delete: `src/domain/motivation/focus-complete.ts`

**Interfaces:**

- Consumes: `evaluateAchievements`, `selectPrimaryCompletionEvent`, and `selectMotivationMessage` from Tasks 2 and 3.
- Produces: plural authoritative `CompletionReceipt.achievements`, persisted `message.event/tone/key`, `streakIncremented`, and current presentation flags.
- Preserves: `completeTask(input): Promise<CompletionReceipt>` and the existing task/streak locks, unique receipt, ledger kinds, formulas, and `wasNewCompletion` behavior.

- [ ] **Step 1: Write failing integration tests for grants and snapshots**

Create a test that resets through the normal integration command and exercises
the seeded candidate. Assert the exact reward result plus the two legitimate
new grants:

```ts
expect(receipt).toMatchObject({
  taskTitle: "Prepare launch brief",
  wasNewCompletion: true,
  points: {
    basePoints: 40,
    timingBonus: 8,
    streakBonus: 4,
    finalPoints: 52,
  },
  preCompletionStreak: 2,
  postCompletionStreak: 3,
  streakIncremented: true,
  achievements: [
    { code: "momentum_three", name: "Momentum Three" },
    { code: "ahead_of_schedule", name: "Ahead of Schedule" },
  ],
  message: {
    event: "achievement_unlocked",
    tone: "friendly",
  },
});
```

Then update the profile tone to `minimal`, load the original celebration again,
and assert the original receipt still has `tone: "friendly"`, the same key,
title, body, final points, and task title. Add focused fixtures for:

- first non-Focus completion grants only First Step;
- first Focus completion grants First Step and Focused Finish once;
- a 4-to-5 Focus transition grants Five-Day Flow;
- two concurrent different-task completions for one user produce one First Step
  grant total;
- concurrent same-task completion still produces one receipt/ledger/notification;
- reopen/recomplete produces no new grant or notification.

- [ ] **Step 2: Run the new integration test and observe the expected failure**

Run:

```bash
pnpm test:integration -- tests/integration/achievements-and-motivation.test.ts
```

Expected: FAIL because the receipt is singular, only Momentum Three is
evaluated, and event/tone/task-title snapshots are not populated.

- [ ] **Step 3: Expand shared completion/dashboard types**

Replace the singular achievement field without changing reward property names:

```ts
import type { AchievementCode } from "@/domain/achievements/achievements";
import type {
  MotivationEvent,
  MotivationTone,
} from "@/domain/motivation/types";

export interface AchievementView {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
  grantedAt: string;
}

export interface CompletionReceipt {
  completionId: string;
  taskId: string;
  projectId: string;
  workspaceId: string;
  taskTitle: string;
  wasNewCompletion: boolean;
  points: PointBreakdown;
  preCompletionStreak: number;
  postCompletionStreak: number;
  streakIncremented: boolean;
  achievements: AchievementView[];
  achievementVisibilityEnabled: boolean;
  celebrationAnimationEnabled: boolean;
  message: {
    event: MotivationEvent;
    tone: MotivationTone;
    key: string;
    title: string;
    body: string;
  };
  projectProgress: {
    doneTasks: number;
    totalTasks: number;
    percentComplete: number;
  };
}
```

- [ ] **Step 4: Centralize immutable receipt mapping**

Create `completion-receipt.ts` with a typed row mapper used by both transaction
replay and celebration reload. Its input includes one completion row, all grant
rows ordered by definition order, current presentation flags, and current
derived project progress. The mapper must calculate bonuses exactly as the
existing code does:

```ts
export interface CompletionSnapshotRow {
  id: string;
  task_id: string;
  project_id: string;
  workspace_id: string;
  task_title: string;
  base_points: number;
  timing_multiplier: string;
  streak_multiplier: string;
  pre_completion_streak: number;
  post_completion_streak: number;
  final_points: number;
  message_event: MotivationEvent;
  message_tone: MotivationTone;
  message_template_key: string;
  message_title: string;
  message_body: string;
}

export interface AchievementGrantRow {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
  granted_at: Date;
}

export interface ProjectProgressRow {
  done_tasks: number;
  total_tasks: number;
  percent_complete: number;
}

function mapAchievementGrant(row: AchievementGrantRow): AchievementView {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    icon: row.icon,
    grantedAt: row.granted_at.toISOString(),
  };
}

export function mapCompletionReceipt(input: {
  completion: CompletionSnapshotRow;
  achievements: AchievementGrantRow[];
  progress: ProjectProgressRow;
  wasNewCompletion: boolean;
  achievementVisibilityEnabled: boolean;
  celebrationAnimationEnabled: boolean;
}): CompletionReceipt {
  const timingMultiplier = Number(
    input.completion.timing_multiplier,
  ) as TimingMultiplier;
  const timingBonus =
    Math.round(input.completion.base_points * timingMultiplier) -
    input.completion.base_points;
  return {
    completionId: input.completion.id,
    taskId: input.completion.task_id,
    projectId: input.completion.project_id,
    workspaceId: input.completion.workspace_id,
    taskTitle: input.completion.task_title,
    wasNewCompletion: input.wasNewCompletion,
    points: {
      basePoints: input.completion.base_points,
      timingMultiplier,
      streakMultiplier: Number(input.completion.streak_multiplier),
      timingBonus,
      streakBonus:
        input.completion.final_points -
        input.completion.base_points -
        timingBonus,
      finalPoints: input.completion.final_points,
    },
    preCompletionStreak: input.completion.pre_completion_streak,
    postCompletionStreak: input.completion.post_completion_streak,
    streakIncremented:
      input.completion.post_completion_streak >
      input.completion.pre_completion_streak,
    achievements: input.achievementVisibilityEnabled
      ? input.achievements.map(mapAchievementGrant)
      : [],
    achievementVisibilityEnabled: input.achievementVisibilityEnabled,
    celebrationAnimationEnabled: input.celebrationAnimationEnabled,
    message: {
      event: input.completion.message_event,
      tone: input.completion.message_tone,
      key: input.completion.message_template_key,
      title: input.completion.message_title,
      body: input.completion.message_body,
    },
    projectProgress: {
      doneTasks: input.progress.done_tasks,
      totalTasks: input.progress.total_tasks,
      percentComplete: input.progress.percent_complete,
    },
  };
}
```

Export the row interfaces for typed SQL callers; keep `mapAchievementGrant`
private to this mapper.

- [ ] **Step 5: Extend the transaction without changing reward calculations**

After locking the per-user streak row and before inserting the completion:

```ts
const [historyRows, grantedRows] = await Promise.all([
  sql<Array<{ completion_count: number; focus_completion_count: number }>>`
    select
      count(*)::integer as completion_count,
      count(*) filter (where focus_selection_id is not null)::integer
        as focus_completion_count
    from public.task_completions
    where recipient_id = ${input.actorId}
  `,
  sql<Array<{ achievement_code: AchievementCode }>>`
    select achievement_code
    from public.achievement_grants
    where user_id = ${input.actorId}
  `,
]);

const candidateAchievementCodes = evaluateAchievements({
  priorCompletionCount: historyRows[0]?.completion_count ?? 0,
  priorFocusCompletionCount: historyRows[0]?.focus_completion_count ?? 0,
  completedFocusTask: focusSelection !== null,
  preCompletionStreak,
  postCompletionStreak,
  timingMultiplier: points.timingMultiplier,
  alreadyGranted: new Set(
    grantedRows.map(({ achievement_code }) => achievement_code),
  ),
});

const completionId = crypto.randomUUID();
const messageEvent = selectPrimaryCompletionEvent({
  newAchievementCodes: candidateAchievementCodes,
  achievementVisibilityEnabled: task.achievement_visibility_enabled,
  streakIncremented: streakTransition?.incremented ?? false,
  completedFocusTask: focusSelection !== null,
  timingMultiplier: points.timingMultiplier,
});
const message = selectMotivationMessage({
  event: messageEvent,
  tone: task.motivation_tone,
  sourceId: completionId,
});
```

Extend `CompletionTaskRow` and its locked query to load
`achievement_visibility_enabled` and `celebration_animation_enabled` from the
assignee's preference row. Use conflict-safe defaults only for legacy missing
rows; Task 1 and `ensureProfile` make rows mandatory for normal users.

Insert `task_title`, `message_event`, and `message_tone` with the existing
snapshot fields. Insert each candidate grant with `on conflict do nothing
returning achievement_code`; if the returned codes differ from the candidates,
throw `AppError("INTERNAL", "Achievement state changed unexpectedly.")` so the
transaction rolls back. Map the primary motivation event to the notification
event as follows:

```ts
const notificationEvent =
  message.event === "completed_early" ? "task_completed" : message.event;
```

Insert one notification with `project_id`, `task_id`, and `deadline_at = null`.
Do not alter `calculatePointBreakdown` or `calculateStreakTransition`.

- [ ] **Step 6: Make replay and celebration load plural immutable data**

For existing completions and `getCompletionCelebration`, query the completion
snapshot independently from grants so joins cannot duplicate the receipt:

```sql
select completion.*, progress.done_tasks, progress.total_tasks,
       progress.percent_complete
from public.task_completions as completion
join public.project_progress as progress
  on progress.project_id = completion.project_id
where completion.id = $completion_id
  and completion.recipient_id = $actor_id;
```

```sql
select definition.code, definition.name, definition.description,
       definition.icon, grant.granted_at
from public.achievement_grants as grant
join public.achievement_definitions as definition
  on definition.code = grant.achievement_code
where grant.completion_id = $completion_id
order by case definition.code
  when 'first_step' then 1
  when 'focused_finish' then 2
  when 'momentum_three' then 3
  when 'five_day_flow' then 4
  when 'ahead_of_schedule' then 5
end;
```

Load current visibility/motion flags from `motivation_preferences`, then call
`mapCompletionReceipt`. Recompletion returns the original message snapshot and
`wasNewCompletion: false`.

- [ ] **Step 7: Remove superseded one-off modules and update old assertions**

Delete `momentum-three.ts` and `focus-complete.ts` only after `rg` confirms no
remaining imports. Update `complete-task.test.ts` to assert:

```ts
expect(fresh.achievements.map(({ code }) => code)).toEqual([
  "momentum_three",
  "ahead_of_schedule",
]);
expect(beforeReopen[0]).toMatchObject({
  completion_count: 1,
  ledger_count: 3,
  ledger_points: 52,
  achievement_count: 2,
  notification_count: 1,
  current_count: 3,
  longest_count: 3,
});
```

- [ ] **Step 8: Run focused and full integration regressions**

Run:

```bash
pnpm typecheck
pnpm test:integration -- tests/integration/achievements-and-motivation.test.ts tests/integration/complete-task.test.ts
pnpm test:unit
```

Expected: all tests PASS; seeded completion is 52, new-user unbonused completion
remains 40, and recompletion artifacts remain exactly once.

- [ ] **Step 9: Commit the completion integration**

```bash
git add src/domain/achievements src/domain/motivation src/server/tasks src/server/types.ts tests/integration/achievements-and-motivation.test.ts tests/integration/complete-task.test.ts
git commit -m "feat: persist complete motivation receipts"
```

---

### Task 5: Add authorized personal motivation settings

**Files:**

- Create: `src/server/settings/types.ts`
- Create: `src/server/settings/get-motivation-settings.ts`
- Create: `src/server/settings/update-motivation-settings.ts`
- Create: `src/features/settings/schemas.ts`
- Create: `src/features/settings/schemas.test.ts`
- Create: `src/features/settings/actions.ts`
- Create: `src/features/settings/motivation-settings-form.tsx`
- Create: `src/app/(app)/settings/page.tsx`
- Modify: `src/server/profiles/ensure-profile.ts`
- Create: `tests/integration/motivation-settings.test.ts`

**Interfaces:**

- Produces: `MotivationSettingsView`, `getMotivationSettings`, `updateMotivationSettings`, `motivationSettingsSchema`, and `updateMotivationSettingsAction`.
- Consumes: existing `isIanaTimezone`, current authenticated user, profile tone/timezone, and private three-flag preference row.

- [ ] **Step 1: Write failing schema and ownership tests**

The unit schema must accept all tones and valid IANA zones, coerce checkbox
values deliberately, and reject unknown fields/invalid zones:

```ts
expect(
  motivationSettingsSchema.parse({
    tone: "calm",
    timezone: "America/New_York",
    deadlineNudgesEnabled: true,
    celebrationAnimationEnabled: false,
    achievementVisibilityEnabled: true,
  }),
).toEqual({
  tone: "calm",
  timezone: "America/New_York",
  deadlineNudgesEnabled: true,
  celebrationAnimationEnabled: false,
  achievementVisibilityEnabled: true,
});
expect(() =>
  motivationSettingsSchema.parse({
    tone: "punitive",
    timezone: "Not/AZone",
    deadlineNudgesEnabled: true,
    celebrationAnimationEnabled: true,
    achievementVisibilityEnabled: true,
  }),
).toThrow();
```

The integration test creates two users, updates user A, asserts user B is
unchanged, and attempts `actorId: userB` only through B's service call. No
service accepts a separate target user ID.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm exec vitest run src/features/settings/schemas.test.ts
pnpm test:integration -- tests/integration/motivation-settings.test.ts
```

Expected: FAIL because settings modules and services do not exist.

- [ ] **Step 3: Implement the strict settings schema and contracts**

```ts
export const motivationSettingsSchema = z
  .object({
    tone: z.enum(MOTIVATION_TONES),
    timezone: z
      .string()
      .trim()
      .refine(isIanaTimezone, "Choose a valid timezone."),
    deadlineNudgesEnabled: z.boolean(),
    celebrationAnimationEnabled: z.boolean(),
    achievementVisibilityEnabled: z.boolean(),
  })
  .strict();

export interface MotivationSettingsView {
  tone: MotivationTone;
  timezone: string;
  deadlineNudgesEnabled: boolean;
  celebrationAnimationEnabled: boolean;
  achievementVisibilityEnabled: boolean;
}
```

- [ ] **Step 4: Implement authorized read/update services**

`getMotivationSettings({ actorId })` selects exactly one profile and left joins
the preference row, defaulting missing flags to true. `updateMotivationSettings`
validates the domain input again and performs both updates in one transaction:

```ts
export async function updateMotivationSettings(input: {
  actorId: string;
  tone: MotivationTone;
  timezone: string;
  deadlineNudgesEnabled: boolean;
  celebrationAnimationEnabled: boolean;
  achievementVisibilityEnabled: boolean;
  occurredAt: Date;
}): Promise<MotivationSettingsView> {
  if (!isIanaTimezone(input.timezone)) {
    throw new TypeError("Choose a valid timezone.");
  }
  return database().begin(async (sql) => {
    const profile = await sql<Array<{ id: string }>>`
      update public.profiles
      set timezone = ${input.timezone},
          motivation_tone = ${input.tone},
          updated_at = ${input.occurredAt}
      where id = ${input.actorId}
      returning id
    `;
    if (!profile[0]) throw new AppError("NOT_FOUND", "Profile not found.");
    await sql`
      insert into public.motivation_preferences (
        user_id, deadline_nudges_enabled,
        celebration_animation_enabled,
        achievement_visibility_enabled, updated_at
      ) values (
        ${input.actorId}, ${input.deadlineNudgesEnabled},
        ${input.celebrationAnimationEnabled},
        ${input.achievementVisibilityEnabled}, ${input.occurredAt}
      )
      on conflict (user_id) do update set
        deadline_nudges_enabled = excluded.deadline_nudges_enabled,
        celebration_animation_enabled = excluded.celebration_animation_enabled,
        achievement_visibility_enabled = excluded.achievement_visibility_enabled,
        updated_at = excluded.updated_at
    `;
    return {
      tone: input.tone,
      timezone: input.timezone,
      deadlineNudgesEnabled: input.deadlineNudgesEnabled,
      celebrationAnimationEnabled: input.celebrationAnimationEnabled,
      achievementVisibilityEnabled: input.achievementVisibilityEnabled,
    };
  });
}
```

Extend `ensureProfile` to conflict-safely insert `motivation_preferences`
immediately after the conflict-safe profile insert when repairing a pre-existing
Auth user.

- [ ] **Step 5: Add the authenticated action and accessible page**

The action reads checkbox presence explicitly, validates, requires the current
user, calls the service with `requestNow`, and revalidates Settings, dashboard,
and the app layout. The form uses native labelled checkboxes and a `<select>`
for tone. Timezone remains a labelled text input with examples and server-side
validation; do not ship a hard-coded incomplete timezone list.

```ts
const parsed = motivationSettingsSchema.safeParse({
  tone: formData.get("tone"),
  timezone: formData.get("timezone"),
  deadlineNudgesEnabled: formData.get("deadlineNudgesEnabled") === "on",
  celebrationAnimationEnabled:
    formData.get("celebrationAnimationEnabled") === "on",
  achievementVisibilityEnabled:
    formData.get("achievementVisibilityEnabled") === "on",
});
```

The page loads `requireUser()` and `getMotivationSettings`, then renders one
focused card headed `Motivation settings`. Success copy is `Preferences saved.
Future messages will use these choices.`

- [ ] **Step 6: Run settings tests, type checking, and keyboard-focused lint**

Run:

```bash
pnpm exec vitest run src/features/settings/schemas.test.ts
pnpm test:integration -- tests/integration/motivation-settings.test.ts
pnpm lint
pnpm typecheck
```

Expected: all focused tests PASS; user A cannot read/update B through any
settings service contract.

- [ ] **Step 7: Commit settings**

```bash
git add src/server/settings src/features/settings 'src/app/(app)/settings/page.tsx' src/server/profiles/ensure-profile.ts tests/integration/motivation-settings.test.ts
git commit -m "feat: add personal motivation settings"
```

---

### Task 6: Add the owned in-app notification center

**Files:**

- Create: `src/server/notifications/types.ts`
- Create: `src/server/notifications/cursor.ts`
- Create: `src/server/notifications/get-notification-summary.ts`
- Create: `src/server/notifications/list-notifications.ts`
- Create: `src/server/notifications/mark-notification-read.ts`
- Create: `src/server/notifications/mark-all-notifications-read.ts`
- Create: `src/features/notifications/actions.ts`
- Create: `src/features/notifications/notification-icon.tsx`
- Create: `src/features/notifications/notification-bell.tsx`
- Create: `src/features/notifications/notification-list.tsx`
- Create: `src/app/(app)/notifications/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/features/tasks/task-card.tsx`
- Create: `tests/integration/notifications.test.ts`

**Interfaces:**

- Produces: `NotificationSummary`, `NotificationPage`, `listNotifications`, `getNotificationSummary`, `markNotificationRead`, `markAllNotificationsRead`, and the shell/history UI.
- Consumes: persisted notification rows only; never returns `source_id`.

- [ ] **Step 1: Add failing notification ownership/read/pagination tests**

Extend the integration file with two users and at least 23 notifications for
user A. Assert:

```ts
expect(summary.unreadCount).toBe(23);
expect(summary.recent).toHaveLength(5);
expect("sourceId" in summary.recent[0]!).toBe(false);

const firstPage = await listNotifications({ actorId: userA, cursor: null });
expect(firstPage.items).toHaveLength(20);
expect(firstPage.nextCursor).not.toBeNull();
const secondPage = await listNotifications({
  actorId: userA,
  cursor: firstPage.nextCursor,
});
expect(secondPage.items).toHaveLength(3);

await markNotificationRead({
  actorId: userA,
  notificationId: firstPage.items[0]!.id,
  occurredAt,
});
expect((await getNotificationSummary({ actorId: userA })).unreadCount).toBe(22);

await markAllNotificationsRead({ actorId: userA, occurredAt });
expect((await getNotificationSummary({ actorId: userA })).unreadCount).toBe(0);
expect((await getNotificationSummary({ actorId: userB })).unreadCount).toBe(0);
```

Also assert user B cannot mark A's notification and receives generic
`NOT_FOUND`, while marking an already-read owned row is an idempotent success.

- [ ] **Step 2: Run the focused integration test and verify failure**

Run: `pnpm test:integration -- tests/integration/notifications.test.ts`

Expected: FAIL because notification services do not exist.

- [ ] **Step 3: Define notification view models and opaque cursor**

```ts
export interface NotificationItem {
  id: string;
  eventType:
    | "task_completed"
    | "focus_task_completed"
    | "achievement_unlocked"
    | "streak_extended"
    | "deadline_approaching"
    | "overdue_recovery";
  title: string;
  body: string;
  tone: MotivationTone;
  createdAt: string;
  readAt: string | null;
  destination: {
    workspaceId: string;
    projectId: string;
    taskId: string | null;
  } | null;
}

export interface NotificationSummary {
  timezone: string;
  unreadCount: number;
  recent: NotificationItem[];
}

export interface NotificationPage {
  timezone: string;
  items: NotificationItem[];
  nextCursor: string | null;
}
```

Encode `{ createdAt, id }` with `Buffer.from(JSON.stringify(value)).toString(
"base64url")`. Decode with a strict Zod object containing `z.iso.datetime()` and
`z.uuid()`; invalid cursors throw `TypeError("Invalid notification cursor.")`.
The page validates its search parameter before invoking the service and renders
the existing not-found boundary for invalid cursors.

- [ ] **Step 4: Implement bounded owned read services**

`getNotificationSummary` loads the actor's profile timezone, unread count, and
five rows. `listNotifications` loads the same current timezone, requests 21
rows, returns the first 20, and derives a cursor from item 20 only when row 21
exists:

```sql
select id, event_type, title, body, tone, created_at, read_at,
       workspace_id, project_id, task_id
from public.notifications
where user_id = $actor_id
  and (
    $cursor_created_at::timestamptz is null
    or (created_at, id) < ($cursor_created_at, $cursor_id::uuid)
  )
order by created_at desc, id desc
limit 21;
```

Map destination only when `project_id` exists. Read mutations use explicit
ownership:

```sql
update public.notifications
set read_at = $occurred_at
where id = $notification_id
  and user_id = $actor_id
  and read_at is null
returning id;
```

If update returns no row, select existence for the same actor: an owned already
read row succeeds; every other ID throws generic `NOT_FOUND`. Mark-all updates
only `user_id = actorId and read_at is null`.

- [ ] **Step 5: Add actions, history page, and safe destinations**

Validate notification IDs with `z.uuid()`. Both actions require the current
user and `requestNow`, call their service, then:

```ts
revalidatePath("/", "layout");
revalidatePath("/dashboard");
revalidatePath("/notifications");
```

The history page validates the optional cursor, calls `listNotifications`, and
passes `page.timezone` to `Intl.DateTimeFormat`. A notification
destination is:

```ts
const href = item.destination
  ? `/workspaces/${item.destination.workspaceId}/projects/${item.destination.projectId}${
      item.destination.taskId ? `#task-${item.destination.taskId}` : ""
    }`
  : null;
```

Add `id={`task-${task.id}`}` to the task card root so authorized project links
land on the relevant task. Do not render `source_id` anywhere.

- [ ] **Step 6: Add the bell preview and Settings navigation**

Load `requireUser`, workspace navigation, and `getNotificationSummary` in the
app layout. Render `NotificationBell` with `summary.timezone` and a
Settings link before Sign out. The bell button must expose:

```tsx
<button
  type="button"
  aria-expanded={open}
  aria-controls="notification-preview"
  aria-label={`Notifications, ${summary.unreadCount} unread`}
  onClick={() => setOpen((value) => !value)}
>
  <Bell aria-hidden="true" />
  {summary.unreadCount > 0 ? (
    <span>{Math.min(summary.unreadCount, 99)}</span>
  ) : null}
</button>
```

Implement Escape dismissal, outside-click dismissal, focus return to the bell,
visible focus styles, and a five-row list. Use CSS breakpoints for a compact
desktop anchored panel and full-width mobile sheet. The panel contains mark
one/all controls and `View all notifications`; it never contains pagination.

- [ ] **Step 7: Run notification service, lint, and type checks**

Run:

```bash
pnpm test:integration -- tests/integration/notifications.test.ts
pnpm lint
pnpm typecheck
```

Expected: history is bounded, reads persist, cross-user mutations are hidden,
and no internal source ID enters any view model.

- [ ] **Step 8: Commit the notification center**

```bash
git add src/server/notifications src/features/notifications 'src/app/(app)/notifications/page.tsx' 'src/app/(app)/layout.tsx' src/features/tasks/task-card.tsx tests/integration/notifications.test.ts
git commit -m "feat: add in-app notification center"
```

---

### Task 7: Add idempotent in-app deadline nudges and protected test trigger

**Files:**

- Create: `src/server/notifications/scan-deadline-nudges.ts`
- Create: `src/app/api/jobs/deadline-nudges/route.ts`
- Create: `tests/integration/deadline-nudges.test.ts`
- Modify: `.env.example`
- Modify: `playwright.config.ts`
- Modify: `tests/fixtures/demo.ts`
- Modify: `tests/fixtures/self-service.ts`

**Interfaces:**

- Consumes: `classifyDeadlineEvent`, `selectMotivationMessage`, notification exact-deadline uniqueness, current profile tone, and `deadline_nudges_enabled`.
- Produces: `scanDeadlineNudges({ occurredAt }): Promise<DeadlineNudgeScanReceipt>` and POST `/api/jobs/deadline-nudges`.
- Preserves: no task/reward/streak/grant mutation and no browser-visible job secret.

- [ ] **Step 1: Write failing nudge integration tests**

Create separate users/tasks for these cases:

1. due in exactly 24 hours;
2. due in 24 hours plus 1 millisecond;
3. overdue at the exact scan instant;
4. completed before scan;
5. nudges disabled;
6. one task whose deadline changes after its first due-soon notification.

Run the scanner twice at the same instant and assert:

```ts
const first = await scanDeadlineNudges({ occurredAt });
const retry = await scanDeadlineNudges({ occurredAt });

expect(first).toMatchObject({ createdCount: 2 });
expect(retry).toMatchObject({ createdCount: 0 });

const notifications = await database()<
  Array<{ event_type: string; task_id: string; deadline_at: Date }>
>`
  select event_type::text, task_id, deadline_at
  from public.notifications
  where user_id = ${userId}
  order by created_at, event_type
`;
expect(notifications).toEqual([
  expect.objectContaining({
    event_type: "deadline_approaching",
    task_id: dueSoonTaskId,
  }),
  expect.objectContaining({
    event_type: "overdue_recovery",
    task_id: overdueTaskId,
  }),
]);
```

Update `due_at` to a distinct exact timestamp still inside the window, scan
again, and assert a second due-soon row for that task. Mark a task Done before a
retry and assert no generated row. Assert no ledger, streak, grant, or task
status changes across the scan.

- [ ] **Step 2: Run the focused integration test and verify failure**

Run: `pnpm test:integration -- tests/integration/deadline-nudges.test.ts`

Expected: FAIL because the scanner does not exist.

- [ ] **Step 3: Implement the locked idempotent scanner**

Run one database transaction. Select eligible rows with authoritative joins and
row locks:

```sql
select task.id, task.title, task.due_at, task.assignee_id,
       project.id as project_id, project.workspace_id,
       profile.motivation_tone
from public.tasks as task
join public.projects as project on project.id = task.project_id
join public.profiles as profile on profile.id = task.assignee_id
join public.motivation_preferences as preference
  on preference.user_id = task.assignee_id
where task.status <> 'done'
  and task.due_at is not null
  and task.due_at <= ${input.occurredAt} + interval '24 hours'
  and preference.deadline_nudges_enabled
order by task.due_at, task.id
for update of task skip locked;
```

For every row, classify the exact deadline and build the immutable selector
source:

```ts
const event = classifyDeadlineEvent({
  now: input.occurredAt,
  dueAt: row.due_at,
});
if (!event) continue;
const message = selectMotivationMessage({
  event,
  tone: row.motivation_tone,
  sourceId: `${row.assignee_id}:${row.id}:${event}:${row.due_at.toISOString()}`,
});
```

Insert with `source_id = task.id`, exact `deadline_at`, project/task routing,
and `on conflict do nothing returning id`. Count only returned IDs. Return:

```ts
export interface DeadlineNudgeScanReceipt {
  scannedCount: number;
  createdCount: number;
}
```

- [ ] **Step 4: Add constant-time POST-only route authorization**

```ts
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function matchesSecret(value: string, expected: string): boolean {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.MOMENTUM_JOB_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (!expected || !supplied || !matchesSecret(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const occurredAt = await requestNow();
  const receipt = await scanDeadlineNudges({ occurredAt });
  return NextResponse.json(receipt);
}
```

Do not export GET, do not accept a user/task/deadline from request input, and do
not return notification IDs.

- [ ] **Step 5: Configure test-only server secret without exposing it to the app**

Add to `.env.example`:

```dotenv
MOMENTUM_JOB_SECRET=replace-with-a-long-local-development-secret
```

Export `PLAYWRIGHT_JOB_SECRET = "momentum-playwright-job-secret"` only from the
Node-side test fixture. Add to `playwright.config.ts` `webServer.env`:

```ts
MOMENTUM_ALLOW_TEST_CLOCK: "true",
MOMENTUM_JOB_SECRET: PLAYWRIGHT_JOB_SECRET,
```

Never prefix the variable with `NEXT_PUBLIC_` and never import the fixture into
application code.

- [ ] **Step 6: Run nudge, schema, and security regressions**

Run:

```bash
pnpm test:integration -- tests/integration/deadline-nudges.test.ts
pnpm test:db
pnpm lint
pnpm typecheck
```

Expected: exact boundaries and retries PASS; completed/disabled cases create
nothing; browser-write denial remains green.

- [ ] **Step 7: Commit deadline nudges**

```bash
git add .env.example playwright.config.ts src/server/notifications/scan-deadline-nudges.ts src/app/api/jobs/deadline-nudges/route.ts tests/integration/deadline-nudges.test.ts tests/fixtures/demo.ts tests/fixtures/self-service.ts
git commit -m "feat: add idempotent deadline nudges"
```

---

### Task 8: Upgrade the authoritative celebration and personal dashboard

**Files:**

- Modify: `src/server/types.ts`
- Modify: `src/server/dashboard/get-dashboard.ts`
- Modify: `src/features/tasks/celebration-dialog.tsx`
- Modify: `src/features/dashboard/dashboard-cards.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/momentum-happy-path.spec.ts`
- Modify: `tests/e2e/new-user-self-service.spec.ts`

**Interfaces:**

- Consumes: expanded `CompletionReceipt`, all five definitions/grants, private visibility/motion flags, notification unread count, and immutable message snapshots.
- Produces: `DashboardView.pointActivity`, `DashboardView.achievements`, `DashboardView.achievementsVisible`, `DashboardView.unreadNotificationCount`, and accessible celebration variants.

- [ ] **Step 1: Extend existing browser expectations first**

Keep the seeded flow's exact assertions for 52 points, 2-to-3 streak, total 93,
75 percent progress, reload-safe celebration, and no recompletion replay. Add:

```ts
await expect(celebration.getByText("Prepare launch brief")).toBeVisible();
await expect(celebration).toHaveAttribute(
  "data-message-event",
  "achievement_unlocked",
);
await expect(celebration.getByText("Momentum Three")).toBeVisible();
await expect(celebration.getByText("Ahead of Schedule")).toBeVisible();
await expect(celebration.getByText("40", { exact: true })).toBeVisible();
await expect(celebration.getByText("+8", { exact: true })).toBeVisible();
await expect(celebration.getByText("+4", { exact: true })).toBeVisible();
```

On the dashboard assert five achievement cards, earned/locked labels, recent
point activity, and unread count. In the new-user flow keep exact 40 points and
0-to-1 streak while asserting First Step and Focused Finish.

- [ ] **Step 2: Run both existing Playwright flows and observe UI failures**

Run:

```bash
pnpm test:e2e -- tests/e2e/momentum-happy-path.spec.ts tests/e2e/new-user-self-service.spec.ts
```

Expected: FAIL only on the new celebration/dashboard expectations.

- [ ] **Step 3: Expand the dashboard view model and bounded queries**

Add:

```ts
export interface DashboardPointActivity {
  completionId: string;
  taskTitle: string;
  completedAt: string;
  basePoints: number;
  timingBonus: number;
  streakBonus: number;
  finalPoints: number;
}

export interface DashboardAchievementState {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  grantedAt: string | null;
}
```

Load the five latest completions for point activity, all five definitions left
joined to this user's grants, unread notification count, and latest supportive
notification. Keep projects and Focus queries bounded as they are. If
achievement visibility is false, return `achievementsVisible: false` and an
empty achievement array; do not delete grants.

- [ ] **Step 4: Render supportive dashboard states**

The dashboard keeps total points/current streak at the top. Add:

- recent activity rows showing task title, final points, and expandable or
  visible base/early/streak breakdown;
- five achievement cards when visible;
- `Earned <date>` for grants and `Ready when this fits your work` for locked
  definitions;
- unread count beside Recent encouragement;
- explicit no-reward, no-streak, no-achievement, no-notification, and no-project
  copy.

Do not calculate points in JSX. Use only values supplied by `DashboardView`.

- [ ] **Step 5: Render authoritative celebration variants and reduced motion**

Set safe diagnostic attributes and event-based styles from persisted data:

```tsx
<DialogContent
  data-testid="completion-celebration"
  data-message-event={celebration.message.event}
  data-message-tone={celebration.message.tone}
  data-animate={
    celebration.celebrationAnimationEnabled ? "enabled" : "disabled"
  }
>
```

Display task title, final points, base/timing/streak breakdown, conditional
streak transition, plural achievements when visible, message, and project
progress. Use one decorative pseudo-element or absolutely positioned sparkle
group with `pointer-events: none`; no timer gates the button.

Add restrained CSS only when `data-animate="enabled"`, and suppress it twice:

```css
[data-completion-decoration] {
  pointer-events: none;
}

[data-animate="disabled"] [data-completion-decoration] {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  [data-completion-decoration] {
    animation: none !important;
    transform: none !important;
  }
}
```

- [ ] **Step 6: Run both browser flows at desktop and mobile width**

Run the two specs, then add a focused `page.setViewportSize({ width: 390,
height: 844 })` assertion for the celebration/dashboard without horizontal
overflow. Emulate reduced motion with `page.emulateMedia({ reducedMotion:
"reduce" })` and assert the dialog remains immediately interactive.

Run:

```bash
pnpm test:e2e -- tests/e2e/momentum-happy-path.spec.ts tests/e2e/new-user-self-service.spec.ts
pnpm lint
pnpm typecheck
```

Expected: both original flows PASS with preserved numeric outcomes and enhanced
motivation UI.

- [ ] **Step 7: Commit celebration and dashboard improvements**

```bash
git add src/server/types.ts src/server/dashboard/get-dashboard.ts src/features/tasks/celebration-dialog.tsx src/features/dashboard/dashboard-cards.tsx src/app/globals.css tests/e2e/momentum-happy-path.spec.ts tests/e2e/new-user-self-service.spec.ts
git commit -m "feat: expand celebrations and personal progress"
```

---

### Task 9: Complete the Slice 3 browser flow, documentation, and release gate

**Files:**

- Create: `tests/e2e/motivation-experience.spec.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: every prior Slice 3 vertical path.
- Produces: one end-to-end proof from Settings through completion, persisted message/grants, notification reads, and idempotent nudge display; accurate operator documentation; final validation evidence.

- [ ] **Step 1: Write the complete failing Playwright scenario**

Use a fresh signed-up user to avoid depending on the demo's existing grants:

1. Sign up and create workspace/project.
2. Open Settings, choose Minimal, save, reload, and assert persistence.
3. Create a self-assigned Medium task without a deadline, select it as Focus,
   start, and complete it.
4. Assert 40 points, First Step, Focused Finish,
   `data-message-tone="minimal"`, and one of the two persisted Minimal
   achievement messages.
5. Reload the celebration and assert the identical text.
6. Dismiss, open the bell, open notification history, mark the completion read,
   reload, and assert read state persists.
7. Create a second assigned task due 12 hours after the fixed Playwright clock.
8. POST the job route twice using Playwright's Node-side `request` fixture and
   `Authorization: Bearer ${PLAYWRIGHT_JOB_SECRET}` plus the existing test-clock
   header.
9. Assert first response `createdCount: 1`, second response `createdCount: 0`.
10. Reload notifications and assert exactly one Minimal due-soon notification.
11. Mark all read and verify unread count zero after reload.
12. Disable achievement visibility and verify dashboard achievement cards are
    hidden without changing total points.

Create the nudge task and invoke the route with explicit deterministic values:

```ts
const scanAt = demoWorkdayInstant();
const dueAtValue = new Date(scanAt.getTime() + 12 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 19);
await page.getByLabel("Deadline (optional)").fill(dueAtValue);

const headers = {
  authorization: `Bearer ${PLAYWRIGHT_JOB_SECRET}`,
  "x-momentum-test-now": scanAt.toISOString(),
};
const firstScan = await request.post("/api/jobs/deadline-nudges", { headers });
const retryScan = await request.post("/api/jobs/deadline-nudges", { headers });
expect(await firstScan.json()).toMatchObject({ createdCount: 1 });
expect(await retryScan.json()).toMatchObject({ createdCount: 0 });
```

Use this stable message assertion instead of depending on random completion ID:

```ts
await expect(celebration).toHaveAttribute("data-message-tone", "minimal");
await expect(
  celebration.getByText(/New milestone recorded\.|Achievement added\./),
).toBeVisible();
```

- [ ] **Step 2: Run the new spec and fix behavior, not assertions**

Run: `pnpm test:e2e -- tests/e2e/motivation-experience.spec.ts`

Expected: PASS after prior tasks; any failure indicates an integration or
accessibility defect. Return to the owning task, fix it with its focused test,
and commit that fix before continuing this release task.

- [ ] **Step 3: Update operator and product documentation**

Update README sections to state:

- all five achievements and four deterministic tones are implemented;
- demo completion remains 52 points but now unlocks Momentum Three and Ahead of
  Schedule in one celebration/notification;
- new-user unbonused completion remains 40 points;
- `/notifications` and `/settings` are available;
- the local/test nudge endpoint requires `MOMENTUM_JOB_SECRET` and has no
  production scheduler;
- database reset now applies three migrations;
- validation still uses `pnpm validate`;
- Resend, email/SMS, quiet hours, external workers, production scheduler,
  invitations/member administration, AI, rankings/social, billing, analytics,
  and deployment remain deferred.

Document a local trigger without printing a real secret:

```bash
curl -X POST http://localhost:3000/api/jobs/deadline-nudges \
  -H "Authorization: Bearer $MOMENTUM_JOB_SECRET"
```

- [ ] **Step 4: Run formatting and every focused/full validation command**

Run exactly:

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm validate
```

Expected: every command exits 0. `pnpm validate` must report all unit, pgTAP,
integration, and Playwright tests passing and a successful production build.
Do not claim any command that was skipped or interrupted.

- [ ] **Step 5: Audit the immutable/idempotent acceptance queries**

After the final seeded Playwright flow, query or assert through integration tests
that the candidate task has exactly:

```text
1 task_completions row
3 point_ledger rows totaling 52
2 new achievement_grants rows for that completion
1 completion notification
current streak 3, longest streak 3
```

Reopen/recomplete and confirm those counts do not change. Confirm one due-soon
and one overdue row maximum per exact deadline and event. Confirm user B cannot
read or mark user A's notification/preferences.

- [ ] **Step 6: Commit the completed slice**

```bash
git add README.md tests/e2e/motivation-experience.spec.ts
git commit -m "test: validate Slice 3 motivation experience"
```

- [ ] **Step 7: Prepare the final handoff**

Report:

- every created, modified, and deleted file;
- each validation command actually run and its result;
- the migration, RLS, trigger, index, and authorization changes;
- confirmation of 52 points, 40 points, concurrency, recompletion, ownership,
  and nudge idempotency;
- any deviation from this plan and why;
- every explicitly deferred capability.

Do not merge or push unless the user separately authorizes that repository
operation.
