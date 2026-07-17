# Slice 4: Demo and Closed-Pilot Readiness Design

**Date:** 2026-07-16

**Status:** Approved in design review and written-spec review

**Baseline:** Commit `3266039` on `main`, tagged `momentum-mvp-demo`

## Objective

Slice 4 makes the existing Momentum MVP safe to demonstrate and practical to
operate for a small closed pilot. It prepares the Next.js application for
Vercel and hosted Supabase, adds a repeatable disposable demo environment,
improves production-oriented error visibility, provides authenticated and
tenant-aware feedback collection, and applies bounded polish to the guided
demo flow.

This slice does not add another major product workflow. Momentum remains a
motivation-first project-management product centered on choosing and completing
a Focus Task. Deployment readiness, operator tooling, feedback, error states,
and celebration polish support that workflow; they do not turn the product into
a general-purpose enterprise suite.

## Baseline and preparation

Before this specification was written:

- `AGENTS.md`, the Slice 4 brief, all prior approved designs and plans, tracked
  repository files, package and validation scripts, current migrations, local
  seed, task-completion flow, notification job, authorization boundaries, and
  primary UI components were inspected.
- Slice 2 pull request `#1` and Slice 3 pull request `#2` were reviewed and
  merged into `main`.
- `main` was tagged and published as `momentum-mvp-demo` at commit `3266039`.
- The post-merge `pnpm validate` baseline passed formatting, linting, strict
  type checking, 80 unit tests in 12 files, 52 pgTAP assertions in three files,
  31 integration tests in seven files, three Playwright flows, and the
  production build.
- The local database was reset by the validation suite, and the working tree
  was clean before the documentation-only design branch was created.
- The repository's current `next.config.ts` is already compatible with Vercel;
  no configuration change is required merely to appear deployment-ready.

Implementation must start from this confirmed baseline, remain within the
approved file scope below, and preserve all Slice 1-3 behavior.

## Confirmed decisions

- Keep the existing Next.js App Router modular monolith and PostgreSQL-backed
  server services.
- Use Vercel's normal Next.js build and runtime. Do not run database migrations
  or demo resets as part of `next build` or a deployment build hook.
- Use four explicit environments: local, test, preview/demo, and production.
  Preview/demo and production use separate hosted Supabase projects and
  separate Vercel environment-variable scopes.
- Preserve the approved workday rule throughout the demo fixture and tests: no
  Focus selection pauses, an incomplete selected Focus Task breaks, and
  weekends neither increment nor break a streak.
- Treat the hosted demo database as dedicated and disposable. The demo reset
  command must refuse to target production, require an explicit typed
  confirmation and project reference, and never be exposed as a public route.
- Preserve the committed local seed for existing tests. Hosted demo users are
  created through the Supabase Admin API with operator-supplied credentials,
  while application data is provisioned transactionally through PostgreSQL.
- Keep the deadline-nudge route's bearer-secret boundary. Add a server-side CLI
  wrapper for manual preview/demo scans; do not put the secret in a browser or
  implement a production scheduler.
- Use native platform logs with a small structured logger and request IDs. Do
  not add an observability SaaS dependency in this slice.
- Store authenticated feedback in PostgreSQL. The server derives the user,
  verifies workspace membership, validates page context, and makes retries
  idempotent with a per-user idempotency key.
- Add a globally available feedback dialog to the authenticated application
  shell. Do not build an administrator dashboard; provide a reviewed SQL query
  for internal retrieval.
- Add `canvas-confetti` for the approved loud completion celebration: a bright
  Momentum-color burst plus flying emoji shapes. This production dependency is
  justified because it provides a bounded, canvas-based particle engine and
  accessible reduced-motion controls without introducing a general animation
  framework. Add its TypeScript declarations as a development dependency.
- A successful move to In Progress receives a short CSS glow/pulse. The full
  burst and emoji celebration fires only for a newly persisted completion.
- Use the immutable completion ID plus `sessionStorage` to prevent the same
  celebration from replaying after reload in a browser session.
- Respect both the user's celebration preference and the operating system's
  reduced-motion setting. Reduced or disabled animation still presents the
  complete persisted celebration content and a static celebratory accent.
- Make only bounded responsive, loading, empty, keyboard, terminology, and
  legibility fixes that materially improve the demo. Do not redesign the
  application.

## Preserved product and security invariants

Slice 4 must not change any reward, streak, achievement, motivation,
authorization, or completion-idempotency semantics:

- Base points remain Small 20, Medium 40, Large 70, and Extra Large 100.
- Timing multipliers remain 1.20 at least 24 hours early, 1.10 before the
  deadline, and 1.00 otherwise or when no deadline exists.
- The streak multiplier remains
  `1 + min(0.20, 0.04 * preCompletionStreak)`.
- Late tasks receive full base points. Priority never affects points. Negative
  points do not exist.
- A workday with no Focus Task selected pauses the streak.
- A workday where a Focus Task was selected but not completed breaks the
  streak.
- Weekends neither increment nor break the streak.
- One Focus Task is allowed globally per user per workday.
- A task has at most one immutable completion receipt for its lifetime.
- Point-ledger rows remain positive, immutable, and unique by completion and
  ledger kind.
- Reopening and recompleting a task may return it to Done but never creates
  additional points, a streak transition, an achievement grant, a notification,
  or another completion celebration.
- The seeded guided completion remains exactly 52 points, changes the Focus
  Streak from two to three, and unlocks Momentum Three under the existing
  achievement rules.
- Motivation messages remain deterministic, reviewed, supportive, and selected
  from the existing event-and-tone template set. AI makes no reward,
  performance, message, or notification-timing decisions.
- Trusted values are calculated on the server from authoritative rows. Browser
  inputs never choose points, grants, assignees, user IDs, or notification
  recipients.
- Existing membership and ownership authorization remains server-side, with
  RLS as defense in depth. Slice 4 may strengthen visibility but may not broaden
  access.

## Architecture

Momentum continues to use four application layers:

1. Server Components load authorized view models.
2. Client Components provide accessible interaction and visual effects without
   owning domain or authorization decisions.
3. Validated Server Actions authenticate the actor and call server-only
   application services for trusted writes.
4. Server-only PostgreSQL adapters own transactions, uniqueness, row locks, and
   persistence.

Slice 4 adds three narrow supporting areas:

- environment and health helpers for deployment verification;
- allow-listed structured observability and request correlation;
- an authenticated feedback service plus an operator-only demo toolchain.

These are supporting modules inside the current application. There is no new
microservice, event bus, queue, analytics pipeline, or background worker.

## Environment and deployment design

### Environment separation

The deployment model is:

| Environment  | Application       | Database and auth                   | Data policy                        |
| ------------ | ----------------- | ----------------------------------- | ---------------------------------- |
| Local        | `next dev`        | Local Supabase CLI                  | Committed deterministic seed       |
| Test         | Vitest/Playwright | Reset local Supabase                | Disposable fixtures and test clock |
| Preview/demo | Vercel Preview    | Dedicated hosted demo Supabase      | Explicit operator reset/provision  |
| Production   | Vercel Production | Separate hosted production Supabase | Migrations only; never demo reset  |

`MOMENTUM_ENVIRONMENT` is the explicit application classification with allowed
values `local`, `test`, `preview`, and `production`. Local helpers set a safe
default, test runners set `test`, and Vercel scopes set `preview` or
`production`. Operator scripts require the value and refuse destructive demo
operations when it is missing or `production`.

The runtime reads environment variables at the boundary where they are needed,
validates them, and emits safe configuration errors without logging values.
Validation must not force database access during module import or an unrelated
static build step.

### Environment-variable contract

The application contract documented in `.env.example`, `README.md`, and
`docs/deployment.md` is:

- `NEXT_PUBLIC_SUPABASE_URL`: environment-specific Supabase API URL; safe for
  browser use.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: environment-specific publishable key;
  safe for browser use and never a service-role credential.
- `DATABASE_URL`: server-only direct PostgreSQL connection string, preferably
  the hosted Supabase transaction-pooler URL for Vercel runtime connections.
- `MOMENTUM_JOB_SECRET`: long, server-only random secret protecting the manual
  deadline scan.
- `MOMENTUM_ENVIRONMENT`: `local`, `test`, `preview`, or `production`.
- `MOMENTUM_RELEASE`: optional safe release identifier. Vercel's commit SHA may
  be used when this value is absent.
- `MOMENTUM_ALLOW_TEST_CLOCK`: `true` only in automated test processes; false
  or absent everywhere else.

Operator-only demo provisioning additionally requires:

- `SUPABASE_SERVICE_ROLE_KEY`: service-role key used only by the local operator
  process to create confirmed demo auth users; it is never prefixed `NEXT_PUBLIC`
  and is not needed in the deployed browser bundle.
- `MOMENTUM_DEMO_EMAIL`: demo user's email.
- `MOMENTUM_DEMO_PASSWORD`: runtime demo password, never committed or logged.
- `MOMENTUM_DEMO_TEAMMATE_EMAIL`: teammate auth identity used by the demo
  fixture.

The demo password is shared only through the pilot's approved secret-sharing
channel. Documentation uses placeholders and never includes a usable password,
service-role key, database credential, or bearer secret.

The sign-in page's existing seeded credential hint is rendered only in local or
test environments. Preview/demo users receive the operator-supplied credential
out of band; the hosted page and source code do not reveal it.

### Vercel and Supabase procedure

Deployment documentation must specify this safe sequence:

1. Create separate hosted Supabase projects for Preview/demo and Production.
2. Configure exact Supabase Auth Site URL and redirect allow-list entries for
   the production domain, local development URL, and the controlled Vercel
   preview pattern.
3. Set Vercel variables in the correct Preview or Production scope. Never copy
   preview database credentials into Production.
4. Link the Supabase CLI to the intended project and verify its project
   reference before any mutation.
5. Run the migration dry run, review the output, and then run the explicit
   linked `supabase db push`. Migration is an operator action, not a build step.
6. Deploy the standard Next.js application through Vercel.
7. Verify `GET /api/health`, password authentication and the configured
   redirect policy, an authenticated page, and the intended demo flow.

No code in this slice performs a real deployment or claims live hosted success
without supplied hosted credentials and manual verification.

The documented URL examples are exact in shape:

- Site URL: `https://<production-domain>` in Production and the stable demo URL
  in the dedicated Preview/demo project;
- allowed local redirect: `http://localhost:3000/**`;
- allowed production redirect: `https://<production-domain>/**`;
- allowed preview redirects: the team's restricted
  `https://*-<vercel-team>.vercel.app/**` pattern, never a blanket unrelated
  domain.

The current MVP uses password authentication and has no OAuth, magic-link, or
email-confirmation callback route. Documentation says this explicitly rather
than publishing a fictional callback. Hosted demo accounts are created already
confirmed by the operator tool. Enabling email confirmation or an external auth
provider remains blocked until a real callback route is implemented and its
exact URL is added to the allow-list; production email delivery is deferred.

### Health route

`GET /api/health` is public and non-mutating. It performs a bounded `select 1`
through the server database connection and returns only:

- `status`: `ok` or `degraded`;
- safe environment classification;
- safe release identifier when available;
- request ID.

It returns HTTP 200 when healthy and 503 when the database check fails. It must
not reveal hostnames, connection strings, Supabase keys, exception messages,
schema details, user data, or stack traces.

## Repeatable demo environment

### Fixture contract

Both the committed local seed and hosted demo provisioner represent the same
semantic guided state:

- one demo owner and one teammate profile;
- one workspace with valid owner/member memberships;
- one project;
- tasks distributed across To Do, In Progress, and Done;
- the demo owner has a current two-workday Focus Streak;
- there is no Focus selection for the current workday, so the streak is paused
  until the demo user makes a selection;
- one assigned Medium To Do task is the completion candidate and will produce
  the established 52-point result, two-to-three streak progression, Momentum
  Three grant, deterministic supportive message, updated project progress,
  notification, and persisted celebration receipt;
- at least one incomplete task assigned to the demo owner is due within the
  nudge window;
- representative existing achievement grants and in-app notifications are
  visible before the guided completion;
- tasks and timestamps remain deterministic relative to the provisioner's
  server-controlled reference instant.

The seed must never preselect today's Focus Task. A missing selection pauses the
streak exactly as the approved product rule requires. The demo script explicitly
selects the candidate before completing it.

### Shared fixture builder

`scripts/lib/demo-fixture.mjs` owns the semantic IDs, titles, relative dates,
and application-data inserts used by operator provisioning and repeatability
tests. It accepts authoritative auth user IDs and a reference instant, performs
the application-data setup in one PostgreSQL transaction, and returns a small
canonical summary for verification. It does not contain a password or service
key. Prior streak dates are calculated as workdays rather than calendar-day
subtraction so a reset performed near a weekend still produces the approved
two-workday history.

`supabase/seed.sql` remains the source for normal local resets because existing
integration and Playwright flows depend on SQL-created local auth identities.
It is adjusted only where needed to mirror the approved demo semantics, such as
the due-soon task and representative notification, without changing the
candidate task, 52-point outcome, project counts, or existing test identities.

### Provision and reset commands

`scripts/provision-demo.mjs`:

1. validates preview/demo environment and all required configuration;
2. verifies the explicitly supplied/linked Supabase project reference;
3. creates or reconciles the two confirmed auth users through the Admin API;
   the teammate receives a cryptographically generated password that is not
   printed or retained because the guided demo does not sign in as that user;
4. passes their IDs to the transactional fixture builder;
5. verifies the canonical fixture summary;
6. prints only safe IDs/counts and next-step guidance.

`scripts/reset-demo.mjs` is deliberately destructive only to a dedicated demo
project. It:

1. refuses `MOMENTUM_ENVIRONMENT=production` and refuses an absent or
   unrecognized environment;
2. displays the project reference and requires the operator to type the exact
   confirmation phrase including that reference;
3. invokes the linked Supabase reset with migrations and `--no-seed`;
4. calls the provisioner to create runtime demo auth users and application
   data;
5. verifies the same canonical summary before reporting completion.

There is no HTTP reset or provision endpoint. These scripts run on an
operator's machine with secrets in process environment variables. They never
print credential values or place them in command arguments that documentation
would encourage copying into shell history.

### Reproducibility

The demo reproducibility test provisions a clean local database twice from the
same semantic input and asserts the same canonical structure and expected
guided result each time. It verifies the two users, membership roles, project,
status distribution, two-day streak, absence of today's Focus selection,
candidate effort/deadline, representative grant/notification, due-soon task,
and expected post-completion totals. Database-generated UUIDs and timestamps are
normalized out of the comparison.

## Deadline-nudge operator flow

The existing `POST /api/jobs/deadline-nudges` remains the only application
entry point for a scan. Its design remains:

1. require `Authorization: Bearer <MOMENTUM_JOB_SECRET>`;
2. compare the supplied and expected secrets with timing-safe equality;
3. use the server-controlled clock;
4. run the existing idempotent scanner;
5. return only aggregate created/skipped counts.

The route is extended to attach a request ID and emit structured start/outcome
logs. Logs include the safe environment, request ID, result status, duration,
and aggregate counts. They exclude authorization headers, secrets, emails,
names, task titles, notification copy, and source identifiers.

`scripts/trigger-deadline-nudges.mjs` is the documented operator command. It
reads the base URL and secret from environment variables, sends the bearer
header from the server-side process, fails clearly on non-success responses,
and prints the request ID and safe aggregate receipt. It never renders the
secret. Repeating it against the same task and exact deadline creates no
duplicate notification because the current database identity is preserved.

Production scheduler selection and configuration remain explicitly deferred.

## Operational visibility and error handling

### Request IDs

The Next.js proxy accepts an incoming `x-request-id` only when it matches a
strict bounded token format; otherwise it creates a UUID. It passes the value to
the downstream request and returns it in the response. Supabase session-cookie
refresh must preserve these headers when it replaces the response object.

Public pages, authenticated pages, the health route, and the deadline route all
receive request IDs. The identifier is diagnostic metadata, not authentication
or authorization data.

### Structured logger

`src/server/observability/logger.ts` writes one JSON object per server event
using an explicit field allow-list. Supported fields are limited to safe values
such as:

- timestamp, level, event, request ID, environment, release;
- route template, HTTP method, route type, status, duration;
- safe application error code, error digest/reference;
- aggregate created/skipped/processed counts.

Arbitrary metadata spreading is forbidden. Raw error messages, stack traces in
the structured payload, request/response bodies, query strings, headers,
cookies, bearer tokens, emails, phone numbers, database URLs, task titles, and
feedback messages are never logged. Local development may retain framework
stack output outside structured production events, but the application logger
does not serialize sensitive error objects.

Unexpected Server Action failures use the logger and return the existing
supportive safe message plus a short diagnostic reference. Expected `AppError`
codes continue to return their deliberate user-facing messages without noisy
error logging.

### Framework error capture

`src/instrumentation.ts` registers Next.js `onRequestError`. It records a safe
structured event containing the route template supplied by Next.js, method,
route type, digest/reference, request ID when available, and deployment
metadata. It never logs the raw URL, query string, headers, error message, error
cause, or request body.

### User-facing states

- `src/app/(app)/loading.tsx` supplies a responsive skeleton for authenticated
  route transitions.
- `src/app/not-found.tsx` gives a clear Momentum-styled return path without
  disclosing whether an inaccessible tenant resource exists.
- `src/app/error.tsx` handles route-segment failures with supportive copy, a
  retry control, and a safe reference when available.
- `src/app/global-error.tsx` provides the minimal root fallback with the same
  no-blame language.

Error and not-found states remain keyboard accessible and do not expose raw
errors or tenant information.

## Feedback collection

### Database design

One additive migration,
`supabase/migrations/202607170004_demo_pilot_readiness.sql`, adds:

`feedback_category` enum:

- `bug`
- `confusing`
- `motivation_feedback`
- `feature_request`
- `other`

`feedback_submissions`:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id)`
- `workspace_id uuid null references workspaces(id)`
- `page_context text null`
- `category feedback_category not null`
- `rating smallint not null check (rating between 1 and 5)`
- `message text not null` with normalized length from 10 through 1,000
  characters
- `idempotency_key uuid not null`
- `created_at timestamptz not null default now()`
- unique `(user_id, idempotency_key)`

`page_context` is a normalized application pathname only, has a bounded length,
and cannot include a query or fragment. `workspace_id` is nullable for an
authenticated page without workspace context; when supplied it must name a
workspace where the current actor has a membership.

Feedback rows are append-only through application behavior. Authenticated
browser roles receive an RLS policy permitting a user to select only their own
rows as defense in depth, but there is no feedback-history UI in this slice.
Browser insert, update, and delete grants are not provided. The authorized
server service performs inserts after identity and membership checks. No user
can list or infer another user's feedback.

The migration also adds the minimum indexes needed for internal review by
creation time, category, and workspace without introducing an analytics model.

### Submission boundary

The feedback dialog submits to a validated Server Action. The client provides
only category, rating, message, optional current pathname/workspace context, and
a UUID idempotency key. The server:

1. requires the current authenticated user;
2. validates and normalizes all fields;
3. verifies workspace membership when context is present;
4. rejects query strings, fragments, unbounded text, and unsupported categories;
5. inserts with the authenticated actor's user ID in one transaction;
6. on a unique-key conflict, loads the actor's existing row;
7. returns the original success for an identical normalized retry, or a safe
   conflict when the same key is reused with different content.

The dialog creates one idempotency key when a draft begins, retains it across
network retries, and replaces it only after successful submission or a full
draft reset. Pending state disables duplicate clicks, but the database unique
constraint remains the authoritative duplicate protection.

No feedback content enters server logs. Success copy thanks the user without
promising a response or implying employee evaluation.

### Feedback experience

An accessible `Feedback` control is added to the authenticated application
shell. It opens a shadcn/ui-compatible Radix dialog with:

- five clearly labeled category options;
- an accessible one-to-five rating control;
- a 10-1,000 character textarea and visible character guidance;
- optional current-page context shown transparently;
- inline validation, pending, success, and recoverable failure states;
- focus trapping, Escape-to-close, labelled controls, and mobile-safe sizing.

The dialog is deliberately lightweight. It does not add file attachments,
screenshots, public voting, chat, triage workflow, administrator screens, or
automated outbound messaging.

`docs/feedback-review.sql` provides an internal, parameterized review query for
authorized operators. It intentionally omits auth email addresses and returns
only stored feedback fields and safe workspace context.

## Completion celebration and bounded demo polish

### Full completion effect

The persisted `CompletionReceipt` remains the sole authority for whether the
client may celebrate. On `wasNewCompletion: true` and when animation is allowed,
`CompletionCelebrationEffect` dynamically invokes `canvas-confetti` with three
short finite waves:

- a bright central Momentum-color burst behind the celebration dialog;
- emoji shapes such as celebration, star, and lightning marks rising around the
  dialog;
- a final lighter sparkle wave.

The effect is decorative (`aria-hidden`, pointer-transparent), has a bounded
particle count and lifetime, and cleans up timers/canvas state on unmount. On
smaller screens it uses fewer particles and a narrower spread. It never loops
indefinitely.

Before firing, the component writes a key derived from the immutable completion
ID to `sessionStorage`. A reload or rerender in the same browser session cannot
replay the burst. A recompletion already returns `wasNewCompletion: false`, so
it also cannot trigger the effect. Failure to access storage or initialize the
canvas must never block or dismiss the persisted celebration dialog.

### Start-task effect

After an authorized task-status mutation successfully changes an assigned task
to In Progress, the affected card receives a roughly one-second CSS
glow/pulse. Failure responses, optimistic-only state, and unrelated rerenders do
not trigger it. The effect carries no points or reward implication and does not
change task semantics.

### Motion and accessibility

The existing `celebration_animation_enabled` preference is loaded in the
project board view model and remains a presentation preference only.
`prefers-reduced-motion: reduce` always wins over an enabled user preference.
When either control disables motion:

- no canvas particles or card animation run;
- the celebration dialog, exact point breakdown, achievement, streak, message,
  and progress remain visible;
- a static emoji/sparkle treatment provides celebratory character without
  movement.

Canvas content is never announced by assistive technology. Focus remains in the
dialog and is returned to the invoking control on close. Effects do not capture
pointer events or obscure keyboard controls.

### Bounded polish review

The implementation reviews only the primary dashboard, project board,
celebration, notification/achievement presentation, feedback dialog, and new
system states for:

- mobile width and dialog viewport fit;
- keyboard operation and visible focus;
- reduced motion;
- loading and empty states;
- exact reward explanation and consistent Focus terminology;
- obvious routes between dashboard, project, settings, notifications, and
  feedback;
- legible notification and achievement content.

Changes outside this bounded list require a concrete demo blocker. There is no
new visual design system or broad page rewrite.

## Application and operator boundaries

### Public HTTP routes

- `GET /api/health`: public, read-only, sanitized health result.
- `POST /api/jobs/deadline-nudges`: server-secret protected, idempotent, returns
  aggregates only.

### Authenticated browser mutations

- Existing task, Focus, notification, settings, workspace, project, and auth
  actions retain their current boundaries.
- New feedback Server Action authenticates the actor, validates input, verifies
  workspace membership, and calls `submitFeedback`.

### Operator-only commands

- `pnpm demo:provision`: reconcile a dedicated demo fixture without a public
  endpoint.
- `pnpm demo:reset`: explicitly reset and reprovision a dedicated non-production
  demo project after typed confirmation.
- `pnpm demo:nudges`: manually call the protected deadline scan from a trusted
  shell.

Operator scripts fail closed when required environment classification, project
identity, or secrets are absent. They emit safe counts and IDs only.

## Security and authorization rules

- Public Supabase configuration contains only the URL and publishable key.
- Database URLs, service-role keys, demo passwords, and job secrets are
  server/operator-only and must never use a `NEXT_PUBLIC_` prefix.
- Preview/demo and production projects, passwords, secrets, and Vercel scopes
  are distinct.
- No migration, demo reset, or provisioning command runs implicitly during a
  build or ordinary application request.
- Demo reset refuses production and requires explicit project-reference
  confirmation.
- The job secret is timing-safely compared and never logged or returned.
- Feedback identity comes from the authenticated session, not the browser.
- Feedback workspace context requires current membership. RLS prevents
  cross-user reads and browser writes remain unavailable.
- Health responses and error logs reveal no topology, credentials, raw errors,
  PII, task content, feedback content, or tenant-existence information.
- Request IDs are validated, bounded correlation tokens and confer no trust.
- The source secret scan checks tracked application, script, test,
  configuration, and documentation files for high-confidence credential
  patterns while allowing explicit placeholders and test-only fixtures.

## Testing strategy

### Unit tests

- Environment classification and required-variable validation, including
  production/demo refusal.
- Request-ID acceptance, replacement, and bounded format.
- Structured logger allow-list and redaction-by-construction.
- Job-secret parsing and timing-safe authorization outcomes.
- Feedback schema categories, rating bounds, normalization, message length,
  rejection of blank/control-only content, pathname restrictions, and
  idempotency-key validation.
- Celebration preset selection for desktop, mobile, disabled preference, and
  reduced motion. Tests cover configuration only; trusted reward logic remains
  in its existing suites.
- Existing streak-transition tests must continue to prove that a day without a
  Focus selection pauses, an incomplete selected Focus Task breaks, and a
  weekend does neither.

### Database tests

The fourth pgTAP file verifies:

- feedback category and column constraints;
- per-user idempotency uniqueness;
- append-only/no browser-write grants;
- a user can select only their own feedback row;
- users cannot select another user's row;
- workspace/user foreign keys and expected indexes;
- all prior completion, ledger, achievement, notification, and tenant
  invariants still pass.

### Integration tests

Feedback integration tests verify:

- an authenticated member can submit feedback as themselves;
- user ID cannot be spoofed;
- a valid workspace context requires membership;
- cross-workspace context is rejected without disclosing tenant details;
- identical retries return the original row and create exactly one submission;
- reuse of an idempotency key with changed content is rejected;
- one user cannot read another user's feedback through the browser-facing
  Supabase boundary.

Existing reward, streak, achievement, notification, onboarding, authorization,
and task-completion integration tests remain unchanged and mandatory.

### Demo reproducibility and end-to-end tests

- `tests/demo/demo-reproducibility.mjs` resets/provisions a local demo twice and
  compares canonical fixture summaries.
- The three existing Playwright specs continue to run.
- Existing specs use a shared fixture module rather than duplicating credentials
  or semantic demo IDs.
- `tests/demo-e2e/demo-smoke.spec.ts` starts from a clean provisioned demo and
  verifies sign-in, project open, Focus selection, move to In Progress, move to
  Done, exact 52 points, streak two-to-three, Momentum Three, deterministic
  supportive message, notification, updated progress, celebration dialog, and
  persisted dashboard state after reload.
- The demo smoke also verifies no animation replay after reload. Visual particle
  geometry is not asserted; the authoritative receipt and accessible dialog are
  asserted to avoid flaky canvas tests.
- Job-route tests retain unauthorized and authorized cases and add safe receipt,
  request-ID, and repeat-idempotency assertions.
- The demo smoke checks `GET /api/health` before authenticating. Error-boundary
  rendering is verified through the production build and manual fault
  injection; the repository has no DOM component-test harness, and adding one
  solely for the four static fallback components is not justified in this
  bounded slice.

### Manual verification

Before completion, manually verify at desktop and mobile widths:

- sign-in and the complete documented demo path;
- Focus selection, start glow, completion burst plus emojis, reward breakdown,
  streak, achievement, message, notification, and reload persistence;
- reduced-motion and disabled-animation fallbacks;
- keyboard focus through the board, celebration, navigation, and feedback
  dialog;
- feedback success and recoverable validation errors;
- not-found, route error, loading, and degraded health experiences where safely
  reproducible;
- another workspace URL remains inaccessible;
- reopened/recompleted tasks do not award or celebrate again.

Live Vercel/Supabase deployment verification is reported only if real hosted
credentials are supplied and the environment is actually deployed.

## Exact validation commands

The completed slice must document and run every available command below:

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
pnpm validate
```

`pnpm validate` is extended to include all new local, demo, security, and build
checks. Individual commands are still run or their output captured so no
subsuite is claimed solely by inference. Failures are fixed before completion;
unavailable live-hosted checks are named as limitations, not successes.

## Documentation deliverables

- `README.md` remains the concise entry point for local setup, normal
  development, the complete validation command, environment-variable summary,
  deployment links, demo commands, manual nudge command, known MVP limitations,
  and pilot checklist.
- `docs/deployment.md` contains the exact environment matrix, Supabase Auth URL
  settings, migration dry-run/push procedure, Vercel steps, health verification,
  rollback considerations, and explicit prohibition on build-time migrations.
- `docs/demo-script.md` provides a short guided sequence covering dashboard,
  Focus selection, In Progress, completion, reward breakdown, streak,
  achievement, supportive message, notifications, manual deadline nudge, and
  reload persistence.
- `docs/closed-pilot-checklist.md` covers pre-pilot environment/security checks,
  account handling, smoke verification, feedback review, incident references,
  and the existing feature limitations.
- `docs/feedback-review.sql` provides the internal review query without user
  email addresses or a new dashboard.

## Expected tracked-file scope

No application implementation begins until this design and its subsequent
implementation plan are reviewed. The approved expected scope is below.

### Modified files

```text
.env.example
README.md
package.json
playwright.config.ts
pnpm-lock.yaml
scripts/with-local-supabase.mjs
src/app/(app)/layout.tsx
src/app/(auth)/sign-in/page.tsx
src/app/api/jobs/deadline-nudges/route.ts
src/app/globals.css
src/features/action-result.ts
src/features/settings/motivation-settings-form.tsx
src/features/tasks/celebration-dialog.tsx
src/features/tasks/kanban-board.tsx
src/features/tasks/task-card.tsx
src/lib/supabase/proxy.ts
src/proxy.ts
src/server/projects/get-project-board.ts
src/server/types.ts
supabase/seed.sql
tests/e2e/momentum-happy-path.spec.ts
tests/e2e/motivation-experience.spec.ts
tests/e2e/new-user-self-service.spec.ts
tests/fixtures/demo.ts
tests/integration/deadline-nudges.test.ts
vitest.config.ts
```

### Created files

```text
docs/superpowers/specs/2026-07-16-demo-pilot-readiness-design.md
docs/superpowers/plans/2026-07-16-demo-pilot-readiness.md
docs/deployment.md
docs/demo-script.md
docs/closed-pilot-checklist.md
docs/feedback-review.sql

playwright.demo.config.ts
scripts/check-source-secrets.mjs
scripts/lib/demo-fixture.mjs
scripts/provision-demo.mjs
scripts/reset-demo.mjs
scripts/trigger-deadline-nudges.mjs

src/instrumentation.ts
src/app/(app)/loading.tsx
src/app/api/health/route.ts
src/app/error.tsx
src/app/global-error.tsx
src/app/not-found.tsx
src/components/ui/skeleton.tsx

src/features/feedback/actions.ts
src/features/feedback/feedback-dialog.tsx
src/features/feedback/schemas.ts
src/features/feedback/schemas.test.ts
src/features/tasks/celebration-preset.ts
src/features/tasks/celebration-preset.test.ts
src/features/tasks/completion-celebration-effect.tsx

src/server/environment.ts
src/server/environment.test.ts
src/server/feedback/submit-feedback.ts
src/server/feedback/types.ts
src/server/health/check-health.ts
src/server/health/check-health.test.ts
src/server/jobs/verify-job-secret.ts
src/server/jobs/verify-job-secret.test.ts
src/server/observability/logger.ts
src/server/observability/logger.test.ts
src/server/observability/request-id.ts
src/server/observability/request-id.test.ts

supabase/migrations/202607170004_demo_pilot_readiness.sql
supabase/tests/database/fourth_slice.test.sql

tests/demo/demo-reproducibility.mjs
tests/demo-e2e/demo-smoke.spec.ts
tests/integration/feedback.test.ts
```

`next.config.ts` is intentionally absent because the existing standard Next.js
configuration is already Vercel-compatible. Any additional validation-driven
file change must be necessary, disclosed before broadening scope when material,
and listed in the final handoff.

## Dependency decision

The only new production dependency is pinned `canvas-confetti@1.9.4`, with
`@types/canvas-confetti@1.9.0` as a development dependency. The implementation
uses it only inside a client-side decorative adapter. It does not receive
trusted domain values, make network calls, or change persistence. The package
addition and rationale are documented in `README.md`.

No logging, deployment, feedback, validation, or demo-provisioning framework is
added. Existing Next.js, Supabase, PostgreSQL, Zod, Vitest, and Playwright
capabilities cover those areas.

## Risks and controls

- **Destructive demo reset:** restricted to a dedicated non-production project,
  explicit environment classification, visible project reference, and typed
  confirmation. There is no public endpoint.
- **Environment crossover:** preview and production use separate Supabase
  projects and Vercel scopes; scripts fail closed on missing classification.
- **Secret or PII leakage:** structured logs are allow-listed, health responses
  are minimal, operator output is sanitized, and tracked-source secret scanning
  is part of validation.
- **Feedback tenant leakage:** actor identity is server-derived, workspace
  membership is verified, RLS permits own-row reads only, and tests use two
  users and two workspaces.
- **Duplicate feedback:** database uniqueness is authoritative; identical
  retries are successful and changed-payload key reuse is a conflict.
- **Celebration regressions or discomfort:** the effect is finite,
  pointer-transparent, reduced on mobile, disabled by OS/user motion settings,
  and never substitutes for accessible persisted content.
- **Flaky visual tests:** automation asserts receipts, dialog content, effect
  gating, and persistence, not random canvas particle positions.
- **False deployment confidence:** documentation distinguishes readiness from an
  actual live deployment, and the final report names any hosted checks that
  could not be executed.

## Deliberate exclusions

Slice 4 does not implement:

- Resend or production email delivery;
- SMS or phone collection;
- quiet hours;
- production scheduler selection or notification-delivery workers;
- deadline-nudge job scheduling;
- workspace invitations or member administration;
- public leaderboards or social feeds;
- billing;
- AI-generated motivation or AI decisions;
- complex analytics;
- native mobile applications;
- a feedback administration dashboard;
- a broad UI redesign;
- an observability vendor;
- automatic production migration or deployment.

## Definition of done

Slice 4 is complete only when:

1. The documented environment matrix, Vercel/Supabase setup, redirect URLs,
   safe migration procedure, and health verification are implemented without
   committed secrets or build-time database mutation.
2. A dedicated preview/demo Supabase project can be explicitly reset and
   provisioned from operator tooling, and the process refuses production.
3. The guided demo begins with the exact approved two-user, one-workspace,
   one-project state, two-day paused streak, no current Focus Task, completion
   candidate, due-soon task, representative achievements, and notifications.
4. The guided completion still produces 52 points, streak three, Momentum
   Three, deterministic supportive content, updated progress, one notification,
   and persisted reload state exactly once.
5. The protected manual deadline scan remains secret-only and idempotent, with
   safe aggregate logs and no scheduler.
6. Request IDs, allow-listed structured logs, health output, error boundaries,
   and not-found experience are present and do not leak secrets, PII, raw
   credentials, or tenant existence.
7. Authenticated feedback validates all fields, derives actor identity,
   verifies workspace membership, prevents accidental duplicates, and prevents
   cross-user reads.
8. The approved completion burst, flying emojis, start-task pulse, and static
   reduced-motion/disabled fallback work without changing trusted domain logic
   or replaying after reload.
9. Existing Slice 1-3 tests and all new unit, pgTAP, integration,
   reproducibility, Playwright, secret-scan, and production-build checks pass.
10. Manual desktop, mobile, keyboard, reduced-motion, tenant-isolation,
    recompletion, and primary demo checks are performed and reported.
11. Every created and modified file, deployment-related change, validation
    result, deviation, deferral, and live-hosted limitation is listed in the
    final handoff.
12. No production deployment, migration, reset, test, or manual verification is
    claimed unless it actually ran successfully against the named environment.
