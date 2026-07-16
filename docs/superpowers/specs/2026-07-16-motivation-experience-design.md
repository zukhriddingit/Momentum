# Slice 3: Motivation Experience Design

**Date:** 2026-07-16

**Status:** Approved in design review; awaiting written-spec review

**Baseline:** Commit `7292f2d` on `agent/slice-2-self-service-core`, published as
draft pull request `zukhriddingit/Momentum#1`

## Objective

Slice 3 implements Momentum's core motivational experience without changing
the trusted reward workflow delivered by Slices 1 and 2. It adds the complete
five-achievement system, deterministic supportive messaging in four tones, an
improved authoritative completion celebration, an actionable in-app
notification center, in-app deadline nudges, personal motivation settings, and
a richer personal dashboard.

This remains a bounded slice of a motivation-first project-management product.
It does not introduce generic enterprise features, external notification
delivery, employee comparison, or AI-generated decisions.

## Baseline and preparation

Before this design was written:

- `AGENTS.md`, the approved MVP design, both completed slice plans, the current
  migrations, seed, domain modules, server services, routes, and tests were
  inspected.
- The working branch was pushed and confirmed at the same local and remote
  commit.
- `pnpm validate` passed formatting, linting, strict type checking, 53 unit
  tests, 32 pgTAP assertions, 19 integration tests, both existing Playwright
  flows, and the production build.
- The existing UI was manually exercised for sign-up, onboarding, workspace and
  project creation, task creation/edit/reassignment, first completion,
  persistence, tenant isolation, recompletion, and mobile layout.
- The branch was clean before this documentation-only design commit.

Implementation must recheck the clean baseline and name every intended source
file before modifying application code.

## Confirmed decisions

- Keep the existing Next.js App Router modular monolith.
- Use validated Server Actions for authenticated browser mutations and
  server-only application services for trusted writes.
- Use a shared pure motivation engine from both the completion workflow and the
  separate deadline-nudge workflow. Do not add a generic event bus or
  asynchronous outbox architecture in this slice.
- Keep one combined notification for a completion. When several events apply,
  choose one primary message with this priority:
  `achievement unlock`, `streak extension`, `Focus completion`, `at least 24
hours early`, then `ordinary completion`.
- The celebration still displays every applicable persisted fact and all newly
  inserted achievement grants.
- Ship two reviewed variants for every event-and-tone pair: seven events, four
  tones, and 56 templates in total.
- Use a bell preview plus a dedicated notification-history page. The desktop
  preview is compact; the mobile treatment is a roomy full-width sheet.
- Show the five most recent notifications in the bell preview and load 20 at a
  time on the history page with keyset pagination.
- Achievement visibility is a reversible presentation preference. Grants
  remain immutable and become visible again when the preference is re-enabled.
- A user who hides achievements still receives points and generic supportive
  completion feedback. Achievement details are omitted from future visible
  completion presentation while hidden; historical copy is never rewritten.
- The job endpoint is a protected development/test trigger only. Production
  scheduler configuration remains deferred.
- No new production dependency is expected.

## Preserved product invariants

Slice 3 must not alter these established rules:

- Base points are Small 20, Medium 40, Large 70, and Extra Large 100.
- Timing multipliers are 1.20 at least 24 hours early, 1.10 before the deadline,
  and 1.00 otherwise or when no deadline exists.
- The streak multiplier is `1 + min(0.20, 0.04 * preCompletionStreak)`.
- Reward rounding remains unchanged.
- Late tasks receive full base points.
- Priority does not affect points and negative points do not exist.
- A workday without a Focus selection pauses the streak.
- A workday with an incomplete selected Focus Task breaks the streak.
- Weekends neither increment nor break the streak.
- One Focus Task is allowed globally per user per workday.
- A task has at most one immutable completion receipt for its lifetime.
- Ledger entries remain positive, immutable, and unique by completion and kind.
- Reopening and recompleting a task may restore Done status but creates no new
  points, streak transition, grant, notification, or celebration.
- The seeded completion remains exactly 52 points and extends the streak from 2
  to 3.
- An unbonused new-user Medium completion remains exactly 40 points.
- Trusted calculations remain on the server.

## Architecture

Momentum continues to use four explicit layers:

1. Server Components load authorized view models.
2. Client Components provide accessible interaction without owning domain
   decisions.
3. Validated Server Actions authenticate users and call server-only application
   services.
4. Pure TypeScript domain modules calculate achievements, message-event
   priority, deterministic template selection, and deadline classification.

The server-only PostgreSQL adapter remains responsible for transactions, row
locks, and trusted writes. Supabase Auth provides the current identity, and RLS
remains defense in depth for browser-readable relations.

### Completion flow

The existing task-completion transaction remains the atomic authority:

1. Validate the task ID and authenticated actor.
2. Lock and load the assigned task, project, membership, profile, and motivation
   preferences.
3. If an immutable completion exists, set the current status back to Done when
   necessary and return the original receipt with `wasNewCompletion: false`.
4. Create when absent and lock the assignee's streak row, which preserves the
   existing streak serialization and also serializes achievement evaluation for
   concurrent completions by the same user. Lock today's Focus selection.
5. Resolve the pre-completion streak with the established pause/break/weekend
   rules.
6. Calculate the existing reward breakdown without accepting browser values.
7. After acquiring the per-user lock, load prior completion/grant state and
   evaluate all five achievement conditions from authoritative state and the
   pending completion.
8. Determine the primary visible motivation event and select a deterministic
   reviewed message using the current tone and immutable completion ID.
9. Update the task and, when applicable, the Focus selection and streak.
10. Insert the immutable completion receipt and positive point-ledger entries.
11. Insert eligible achievement grants with conflict-safe unique enforcement and
    collect only rows actually inserted as newly earned achievements. A
    mismatch between evaluated and returned grants is an invariant failure that
    rolls back the transaction rather than persisting misleading copy.
12. Insert one combined in-app completion notification.
13. Commit and return the persisted receipt, including task title, reward
    breakdown, streak result, newly inserted grants, rendered message, primary
    event, and project progress.

Any missing template, invalid domain result, or persistence error rolls back the
entire transaction. Concurrent completions of the same task remain serialized
by the task lock and protected by the unique completion constraint.

### Deadline-nudge flow

Deadline nudges are a separate synchronous server workflow:

1. A protected development/test endpoint authenticates a server-only bearer
   secret and invokes the scanner with a server-controlled instant.
2. The scanner loads incomplete assigned tasks whose exact deadline is due
   within 24 hours or overdue, along with the assignee's tone and nudge
   preference.
3. A pure classifier selects `deadline_approaching` or `overdue_recovery`.
4. The shared message selector renders a deterministic message from event,
   tone, and immutable nudge source identity.
5. The service inserts generated notifications with `on conflict do nothing`.
6. The endpoint returns aggregate created/skipped counts, not internal source
   identifiers.

The workflow never changes task status, points, Focus state, streaks, or
achievements.

## Database design

One additive migration, expected as
`supabase/migrations/202607160003_motivation_experience.sql`, contains the
minimum schema support for this slice. Existing migrations are not rewritten.

### Motivation and notification events

Add `motivation_event_type` with the seven domain events:

- `task_completed`
- `completed_early`
- `focus_task_completed`
- `streak_extended`
- `achievement_unlocked`
- `deadline_approaching`
- `overdue_recovery`

Extend `notification_event_type` from its existing `focus_task_completed` value
to support:

- `task_completed`
- `focus_task_completed`
- `achievement_unlocked`
- `streak_extended`
- `deadline_approaching`
- `overdue_recovery`

An early completion uses `task_completed` as its notification event while the
immutable completion receipt stores `completed_early` as the more specific
motivation event. This distinguishes ordinary and at-least-24-hours-early
messages without creating another notification category.

### Completion snapshot additions

Add to `task_completions`:

- `message_event motivation_event_type not null`
- `message_tone motivation_tone not null`

Existing `message_template_key`, `message_title`, and `message_body` remain the
authoritative rendered snapshot. Existing seeded rows are backfilled as
Friendly Focus completions. The existing immutable trigger protects all new
snapshot fields automatically.

### Motivation preferences

Keep `profiles.timezone` and `profiles.motivation_tone` as their existing source
of truth. Add `motivation_preferences`:

- `user_id uuid primary key references profiles(id) on delete cascade`
- `deadline_nudges_enabled boolean not null default true`
- `celebration_animation_enabled boolean not null default true`
- `achievement_visibility_enabled boolean not null default true`
- `updated_at timestamptz not null default now()`

The settings view model aggregates the profile tone/timezone and the three
private preference flags. A single server transaction updates both relations.
An auth-profile trigger or conflict-safe server initializer creates the
preference row for new and existing users.

RLS allows a user to select only their own preference row. Authenticated and
anonymous browser roles receive no insert, update, or delete grant. All updates
use the server-only application service.

### Notification additions and constraints

Keep the existing persisted rendered copy and add nullable routing/context
fields:

- `project_id uuid references projects(id)`
- `task_id uuid references tasks(id)`
- `deadline_at timestamptz`

`source_id` remains an internal UUID and is never rendered. Completion
notifications use their completion ID as `source_id`. Nudge notifications use
the task ID as `source_id` and include the exact deadline in `deadline_at`.

Replace the existing broad uniqueness constraint with two explicit identities:

- Completion and non-deadline events: unique
  `(user_id, event_type, source_id)` when `deadline_at is null`.
- Deadline events: unique `(user_id, task_id, event_type, deadline_at)` when
  `deadline_at is not null`.

Changing a deadline intentionally creates a new nudge identity. The service
must derive `user_id` from the authoritative assignee rather than accept it from
the endpoint.

Add indexes for:

- `(user_id, created_at desc, id desc)` for recent history and keyset
  pagination;
- `(user_id, created_at desc, id desc) where read_at is null` for unread count
  and the bell;
- task deadline/status/assignee access used by the nudge scan.

Notification content and routing fields are immutable after insertion. A
trigger permits only the one-way transition of `read_at` from null to a
timestamp and rejects content changes, reversing a read, or deletion. Browser
writes remain forbidden; authorized server services perform read mutations.

### Achievement definitions and grants

Seed these stable definitions:

1. `first_step`: complete the first task.
2. `focused_finish`: complete the first Focus Task.
3. `momentum_three`: reach a three-workday Focus Streak.
4. `five_day_flow`: reach a five-workday Focus Streak.
5. `ahead_of_schedule`: complete a task at least 24 hours early.

`achievement_grants` remains immutable and unique by `(user_id,
achievement_code)`. The transaction uses conflict-safe inserts with `returning`
so concurrent completions cannot report a grant that another transaction
inserted first.

### Seed behavior

The reproducible demo is updated consistently with the completed achievement
system:

- The first historical Focus completion owns the seeded First Step and Focused
  Finish grants.
- The second historical completion preserves the seeded two-day streak.
- Completing `Prepare launch brief` still awards exactly 52 points and moves the
  streak from 2 to 3.
- Because that task is at least 24 hours early, the same first completion
  legitimately inserts both Momentum Three and Ahead of Schedule.
- The completion still creates only one combined notification.
- Demo point total after the completion remains 93 and project progress remains
  3 of 4 tasks, or 75 percent.

No seed row is allowed to manufacture Five-Day Flow; that condition is covered
by focused tests.

## Domain boundaries

### Achievement evaluation

`evaluateAchievements` is a pure function over:

- prior lifetime completion count;
- prior completed-Focus count;
- whether this completion completes today's Focus selection;
- pre- and post-completion streak;
- timing multiplier;
- already granted achievement codes.

It returns stable candidate codes. Persistence determines which candidates are
new under concurrency. The existing per-user streak-row lock is acquired before
prior completion/grant reads, so simultaneous completions for one user cannot
both classify themselves as that user's first achievement event. The unique
grant constraint remains the final defense. Achievement definitions,
thresholds, and descriptions live outside React components.

### Motivation-event classification

The completion classifier chooses one visible event in this order:

1. achievement unlock;
2. streak extension;
3. Focus completion;
4. at least 24 hours early;
5. ordinary completion.

When achievement visibility is disabled, the grant is still persisted but the
achievement event is removed from the visible-message candidate set. The next
applicable event provides generic supportive feedback, and achievement details
are omitted from the celebration. Re-enabling visibility reveals all persisted
grants on the dashboard; it does not regenerate or rewrite historical
completion messages.

### Deterministic message selection

The message catalog has seven event groups:

- ordinary task completion;
- at least 24 hours early;
- Focus Task completion;
- streak extension;
- achievement unlock;
- deadline approaching;
- overdue recovery.

Each group contains two reviewed variants in each tone:

- Calm: steady, low-intensity, reassuring.
- Friendly: warm, conversational, and concise.
- Energetic: upbeat without pressure, comparison, or excessive punctuation.
- Minimal: direct and brief.

A small versioned stable hash maps `event + tone + immutable source ID` to one
of the two variants. It must not use `Math.random`, current time, mutable task
fields, a browser value, an LLM, or an external service. Persisted
`template_key`, title, body, event, and tone prevent future catalog changes from
rewriting history.

Automated language checks reject shame, threats, punishment, employee
comparison, manipulative urgency, and configured prohibited phrases. Human
review remains required because a word list alone cannot prove supportive copy.

### Deadline classification

For scan instant `now` and exact deadline `dueAt`:

- `deadline_approaching` applies when `now < dueAt <= now + 24 hours`.
- `overdue_recovery` applies when `dueAt <= now`.
- At the exact deadline, overdue recovery wins.
- A task may receive one due-soon message and later one overdue-recovery
  message for the same exact deadline.
- If the first scan occurs after the deadline, no retroactive due-soon
  notification is created.
- Completed tasks, tasks without deadlines, and users with nudges disabled are
  excluded.

Overdue copy emphasizes recovery and a manageable next action. It never alters
rewards or characterizes the user as failing.

## Server-service boundaries

The slice adds or expands these server-only responsibilities:

- Complete a task atomically while evaluating all achievements and snapshotting
  one deterministic message.
- Load an authorized completion celebration from immutable persisted data.
- Read and update the current user's motivation settings.
- Load the five most recent notifications and unread count for the app shell.
- Load a keyset-paginated notification history for the current user.
- Mark one owned notification read.
- Mark all current-user notifications read.
- Scan eligible deadline nudges and insert them idempotently.
- Expand the dashboard view model with recent point activity, achievement
  states, latest supportive notification, and unread count.

Every public service accepts an explicit `actorId` or is invoked only from a
secret-protected server endpoint. Services derive workspace, project, task,
assignee, and reward context from locked authoritative rows.

## Routes and interaction design

The authenticated route tree becomes:

```text
/
├── dashboard
├── notifications
├── settings
├── onboarding
├── workspaces/[workspaceId]
└── workspaces/[workspaceId]/projects/[projectId]

/api/jobs/deadline-nudges  (POST, development/test secret only)
```

### Application header and bell

The authenticated header adds:

- a notification bell with an accessible unread-count label;
- a five-item recent preview;
- event icon/type, rendered title and body, user-timezone timestamp, and read
  state;
- mark-one and mark-all-read controls;
- a `View all notifications` link;
- a Settings link.

The desktop panel is compact and does not displace the dashboard. At mobile
width it becomes a full-width sheet with the same native tab order. The bell
uses `aria-expanded`, a labelled region/dialog as appropriate, visible focus,
Escape dismissal, and focus return. No interaction depends on pointer input.

### Notification history

`/notifications` loads 20 newest rows at a time using `(created_at, id)` as the
stable descending cursor. It never uses an unbounded offset query. Each row
shows a safe event indicator and an authorized destination when a task/project
still exists and remains accessible. Internal `source_id` is absent from the
view model and markup.

Marking one notification read updates only that owned row. Marking all read
updates only unread rows for the current user. Read state survives reload.

### Motivation settings

`/settings` contains only:

- motivation tone;
- IANA timezone;
- deadline nudges enabled;
- celebration animation enabled;
- achievement visibility enabled.

The existing timezone utility validates external input. Tone and timezone
changes affect future workday/message calculations and current display
formatting only. Historical notifications, completion receipts, ledger rows,
grants, and stored work dates are not changed.

Email, phone, SMS, and quiet-hour inputs are intentionally absent.

### Completion celebration

The persisted completion ID remains the celebration key. A first completion
adds `?celebration=<completionId>` to the authorized project URL. Reloading
before dismissal reloads the same authoritative receipt. Dismissal removes the
query parameter without mutating reward history. A recompletion receipt has
`wasNewCompletion: false` and never adds the parameter.

The dialog displays:

- completed task title;
- final points;
- base, timing, and streak point breakdown;
- streak transition only when applicable;
- every grant actually inserted by this completion when achievement
  presentation is enabled;
- persisted deterministic title and body;
- updated project progress.

Ordinary, early, Focus, streak, and achievement cases use restrained visual
emphasis within one component. Decorative motion never blocks controls. The
user setting can disable it, and `prefers-reduced-motion` always wins.

### Dashboard

The dashboard remains personal and focused on today's work. It contains:

- today's Focus Task or a clear selection prompt;
- total points and recent point activity grouped by completion with transparent
  base/timing/streak values;
- current and longest Focus Streak;
- all five achievement definitions, with earned dates for grants and supportive
  locked states for unearned achievements;
- the latest visible supportive notification;
- notification unread count;
- project progress cards.

Empty states cover users without rewards, streaks, grants, notifications, or
projects. Locked achievements describe what they recognize without guilt,
punishment, or employee comparison. When achievement visibility is disabled,
the achievement section and celebration details are absent while grants remain
stored.

No team ranking, leaderboard, comparative employee metric, or public score is
introduced.

## Security and authorization

- Server Actions validate every ID, cursor, setting, and form value with Zod.
- Settings services update only `actorId` and never accept another user ID from
  the browser.
- Notification read services include `user_id = actorId` in the mutation and
  return generic not-found behavior for inaccessible IDs.
- Notification list and unread queries include `user_id = actorId` even though
  RLS also protects browser reads.
- Task/project links are derived from persisted routing fields and reauthorized
  by their destination route. Missing, inaccessible, and cross-tenant
  destinations resolve identically.
- Browser roles retain no trusted write grants on completions, ledger, streaks,
  grants, or generated notifications.
- The preference relation is readable only by its owner and browser-writable by
  nobody.
- Notification content is immutable; only authorized one-way read transitions
  are allowed.
- The nudge endpoint accepts POST only, requires a server-only
  `MOMENTUM_JOB_SECRET`, and is unavailable when the secret is missing. Secrets
  are never embedded in client bundles, logs, URLs, or response bodies.
- The nudge endpoint is not a production scheduler and has no user-facing
  trigger.

## Error handling and concurrency

- Invalid external input returns existing safe action errors without exposing
  database details.
- Completion domain or persistence failure rolls back every trusted write.
- Duplicate completion returns the original immutable receipt.
- Concurrent achievement candidates rely on the grant uniqueness constraint;
  only inserted rows are reported as newly earned.
- Duplicate nudge retries use partial unique indexes and `on conflict do
nothing`.
- A changed exact deadline intentionally creates another eligible identity.
- A failed nudge scan rolls back its batch and can be retried safely.
- Empty notification or dashboard data is a normal state, not an exception.
- Unknown or inaccessible cursors, notifications, tasks, projects, and
  workspaces produce validation or generic not-found outcomes as appropriate.

## Testing strategy

### Unit tests

Add pure tests for:

- every achievement threshold and non-qualifying boundary;
- already-granted filtering and stable achievement codes;
- primary event priority for overlapping completion conditions;
- all 56 event/tone templates;
- stable selection for the same event, tone, and source ID;
- deterministic variation across controlled source IDs;
- rendered template shape and versioned keys;
- prohibited shame, threats, punishment, manipulative urgency, and employee
  comparison language;
- setting validation and all four tones;
- valid and invalid IANA timezones through the existing utility;
- due-soon lower/upper boundaries and exact-deadline overdue behavior;
- existing point and streak regression cases, including pause/break/weekends.

### Database tests

Add pgTAP coverage for:

- all five seeded achievement definitions;
- new event values, completion snapshot columns, and preference relation;
- completion and nudge uniqueness indexes;
- notification history and unread indexes;
- immutable completion, ledger, and grant behavior;
- one-way notification read-state protection;
- RLS ownership for preferences and notifications;
- denied browser writes to trusted relations;
- deterministic seed grants and reproducible reset behavior.

### Integration tests

Cover:

- all five achievement grants;
- concurrent first-completion grant safety;
- no grants, notification, streak, or ledger changes after recompletion;
- multiple new grants from one completion with one combined notification;
- persisted tone/event/template/title/body after a later tone change;
- current-user-only preference reads and updates;
- current-user-only notification history, mark-one-read, and mark-all-read;
- due-soon idempotency across retries;
- overdue idempotency across retries;
- a changed deadline producing a new identity;
- completed tasks excluded from scans;
- disabled nudge preference;
- exact deadline and just-inside/outside window boundaries;
- the existing seeded 52-point completion;
- the existing unbonused new-user 40-point completion;
- concurrent completion and reopen/recomplete exactly-once behavior.

### Playwright

Retain the Slice 1 seeded happy path and Slice 2 self-service path. Extend browser
coverage to:

1. Change the motivation tone in Settings.
2. Complete an eligible task.
3. Assert the persisted tone-specific message and authoritative celebration.
4. Assert the earned achievement and supportive locked states.
5. Open the bell and full notification center.
6. Mark one notification read, reload, and verify persistence.
7. Trigger the protected nudge route through Playwright's server-side request
   context using a test-only secret.
8. Verify one due-soon notification appears after repeated job requests.
9. Verify mark-all-read, achievement hiding, keyboard operation, mobile layout,
   and reduced-motion behavior in focused cases.

Tests must not expose the job secret to browser JavaScript.

## Implementation increments

The later implementation plan will decompose the slice into reviewable vertical
increments:

1. Add migration, seed support, and database tests.
2. Add pure achievements, event priority, message catalog/selector, deadline
   classification, and unit tests.
3. Integrate achievements and motivation snapshots into the existing completion
   transaction with exactly-once integration tests.
4. Add notification query/read services, bell preview, history route, and
   ownership tests.
5. Add settings service/page and authorization tests.
6. Add protected deadline-nudge service/route and idempotency tests.
7. Expand celebration and dashboard view models/components.
8. Extend Playwright coverage and run the full regression pipeline.

Each increment must preserve a buildable branch and keep application logic out
of React components.

## Explicitly deferred

Slice 3 does not implement:

- Resend or production email delivery;
- SMS, phone fields, or phone verification;
- quiet-hour scheduling or UI;
- external delivery workers;
- production scheduler or deployment configuration;
- workspace invitations;
- member removal or role-management UI;
- AI-generated messages or AI decisions;
- leaderboards, rankings, comparative employee metrics, kudos, or social feeds;
- billing;
- analytics integrations.

## Risks and mitigations

- **Completion regression:** Keep the existing task lock, unique receipt, reward
  functions, and transaction boundary; add exact 52/40/concurrency/recompletion
  regressions before UI work.
- **Message drift:** Persist rendered copy, tone, event, and versioned template
  key; test the full catalog and never rerender history.
- **Achievement races:** Use immutable unique grants and report only rows
  returned from conflict-safe inserts.
- **Nudge duplication:** Use the exact deadline in a database-enforced identity,
  not only application checks.
- **Cross-user reads or mutations:** Apply both explicit actor predicates and
  RLS, then test with two authenticated users.
- **Dashboard bloat:** Keep recent point activity bounded and preserve today's
  Focus and visible progress as the primary hierarchy.
- **Scope expansion:** Keep external delivery, scheduling, social features, and
  production deployment outside the slice.

## Validation commands

Run focused tests during implementation, then run the documented complete
pipeline before declaring the slice complete:

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

`pnpm validate` already includes every command except the mutating `pnpm format`.
Run formatting first, then use the full validation command as the final proof.

## Definition of done

Slice 3 is complete only when:

- all five achievement definitions and grants behave exactly once under
  concurrency and recompletion;
- the 56 reviewed templates are deterministic, tone-specific, concise, and
  supportive;
- celebration, notification, settings, dashboard, and nudge experiences meet
  the approved responsive and accessible behavior;
- historical completion and notification copy remains immutable after setting
  changes;
- notification reads, settings, and generated notifications are user-isolated;
- deadline and overdue notifications are exact-deadline idempotent;
- seeded completion remains 52 points, new-user unbonused completion remains 40
  points, and existing streak/reward formulas remain unchanged;
- all original and new unit, database, integration, Playwright, and build
  validation actually pass;
- every changed file, migration/authorization change, deviation, limitation,
  and deferred capability is reported accurately;
- no success is claimed for a command that was not run.
