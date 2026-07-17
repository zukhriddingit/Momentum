# Momentum

Momentum is a motivation-first project-management application. A person chooses
one Focus Task for the workday, moves it through a three-column board, completes
it, and sees exactly-once points, streak progress, achievements, supportive
messages, notifications, and visible project progress. The application includes
self-service workspace/project/task management and deployment-ready operations
for a guided demo and small closed pilot; it is deliberately not a general
enterprise project-management suite.

## Local setup

Requirements: Node.js 20.9 or newer, pnpm 11, Docker Desktop, and the Supabase CLI installed through the project dependencies.

```bash
pnpm install
cp .env.example .env.local
pnpm supabase:start
pnpm dev:local
```

Keep only local placeholder or local Supabase values in `.env.local`; it is
ignored by Git. Never commit a populated environment file.

Open `http://localhost:3000` and sign in with:

- Email: `demo@momentum.local`
- Password: `momentum-demo`

Alternatively, open `/sign-up` and create a local account with a display name, email, password of at least 12 characters, and valid IANA timezone such as `America/New_York`. Local email signup is enabled, email confirmation is disabled, and the new account receives an immediate session. The onboarding flow then creates an owner workspace and first project.

The first start intentionally launches only the Supabase services needed by this slice (PostgreSQL, Auth, PostgREST, and the API gateway). Reset the deterministic demo data with `pnpm supabase:reset`, and stop the local stack with `pnpm supabase:stop`.

Database resets apply all migrations in order. The first creates the Slice 1 collaboration and reward model. The second adds atomic Auth-profile initialization, workspace-assignee validation, completed-assignee protection, indexes, and browser-role guardrails. The third adds immutable completion-message snapshots, motivation preferences, notification routing and deadline identities, and the complete MVP achievement catalog. The fourth adds append-only feedback submissions with per-user idempotency, validated field constraints, own-row RLS reads, and no browser writes. The conflict-safe seed then restores the demo workspace.

## Environments and hosted setup

Production is live at
[momentum-bay-two.vercel.app](https://momentum-bay-two.vercel.app). On July 17,
2026, the production health endpoint returned HTTP 200 and a fresh-user browser
smoke test verified immediate password signup, workspace creation, project
creation, and persisted authentication/data after reload.

Momentum distinguishes `local`, `test`, `preview`, and `production` with
`MOMENTUM_ENVIRONMENT`. Preview/demo and Production require separate Supabase
projects and separate Vercel variable scopes. Browser code receives only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
`DATABASE_URL`, `MOMENTUM_JOB_SECRET`, service-role keys, and demo credentials
are server/operator-only.

Follow [the deployment runbook](docs/deployment.md) for exact Supabase Auth
URLs, environment variables, migration dry-run/push, [Vercel](https://vercel.com/)
setup, health verification, and rollback. Database migrations are reviewed
operator actions: never run migrations, provisioning, or resets from `pnpm
build` or a Vercel build hook. A successful local build is not proof of a live
hosted deployment.

The public, non-mutating health endpoint is `GET /api/health`. It returns only
status, environment, release, and request-ID metadata. Capture the
`x-request-id` header for incident correlation without copying request bodies or
credentials.

Share the runtime demo password only through the pilot's approved secret
channel. Never place a database URL, service-role key, demo password, or job
secret in source, tickets, chat, screenshots, client code, or command output.

## Completion results

The demo user starts with a two-workday Focus Streak and 41 historical points. Completing the medium Focus Task at least 24 hours early yields 52 points: 40 base, 8 early-completion bonus, and 4 streak bonus. The persisted result is 93 total points, a streak of three, the Momentum Three achievement, 75% project progress, one supportive notification, and a reload-safe celebration receipt.

A new user who completes a self-assigned medium Focus Task without a deadline earns 40 points: 40 base with no timing or prior-streak bonus. The persisted result is 40 total points, a streak progression from zero to one, 100% progress for a one-task project, one supportive notification, and a reload-safe celebration receipt. Reopening and recompleting returns the original receipt and does not create another reward.

Streak behavior follows the approved amendment: a weekday without a selected Focus Task pauses the streak, a weekday with a selected but incomplete Focus Task breaks it, and weekends neither increment nor break it.

## Guided demo and deadline nudges

The exact **2 → 3** streak walkthrough is a workday demo. Run it Monday through
Friday in the demo owner's `America/New_York` timezone. Preview provision/reset
refuses weekends before any mutation because weekends must neither increment nor
break a streak. Automated demo tests use the request clock only when the runtime
is classified as `test`; a browser header cannot change trusted time in Local,
Preview, or Production.

Each user can select Calm, Friendly, Energetic, or Minimal messages under `/settings`. Tone, animation, achievement visibility, deadline-nudge preference, and timezone are personal settings; none of them change trusted reward calculations. Completion messages are selected deterministically and persisted with the completion receipt, so a reload shows the same wording.

Provisioning and reset are operator-only commands. They require the environment
and project identity described in the deployment runbook; reset refuses
Production and requires an exact typed confirmation.

```bash
pnpm demo:provision
pnpm demo:reset
```

The protected deadline scanner creates only in-app notifications and is safe to
retry for the same task and exact deadline. Set `MOMENTUM_DEMO_BASE_URL` and the
server-only `MOMENTUM_JOB_SECRET` in the trusted operator process, then run:

```bash
pnpm demo:nudges
```

This slice intentionally does not include a production scheduler. The endpoint must be invoked by a trusted caller, and the secret must never be exposed to browser code.

Use the exact [guided demo script](docs/demo-script.md), then record hosted and
manual results in the [closed-pilot checklist](docs/closed-pilot-checklist.md).
Authorized database operators can review submissions with the parameterized
[feedback query](docs/feedback-review.sql); it intentionally omits Auth email
addresses.

## Validation

With the local Supabase stack running:

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
```

Install Chromium once on a new machine with `pnpm exec playwright install
chromium` before running browser tests.

The CI-equivalent release gate is:

```bash
pnpm validate
```

The database, integration, end-to-end, and demo commands reset the local
database so every suite starts from its declared fixture. Never point them at a
shared or Production database. The release gate covers
formatting, lint, strict types, unit tests, pgTAP, integration tests, existing
Playwright flows, demo reproducibility, the clean guided demo, tracked-source
secret scanning, and the Production build.

## Dependency rationale

- Next.js, React, TypeScript, Tailwind CSS, and the Tailwind PostCSS plugin provide the requested application foundation.
- `@supabase/supabase-js` and `@supabase/ssr` provide local authentication and server-cookie integration; `postgres` is used only by trusted server-side services for atomic transactions.
- Radix Dialog, `class-variance-authority`, `clsx`, `tailwind-merge`, and Lucide provide small shadcn/ui-compatible, accessible interface primitives.
- Pinned `canvas-confetti` provides the approved finite Momentum-color burst and
  emoji waves without adding a general animation framework. The application
  gates it with the persisted completion receipt, session storage, the user's
  celebration preference, reduced motion, bounded particles/timers, and a full
  static fallback; `@types/canvas-confetti` supplies development-only types.
- Zod validates server-action input.
- Vitest, pgTAP through the Supabase CLI, and Playwright cover pure domain rules, database-backed integration, and the main browser flow.
- Prettier, ESLint, and the Tailwind Prettier plugin provide formatting and lint foundations.

## Deliberately deferred

The closed-pilot slice does not include Resend or production email delivery;
SMS or phone collection; quiet hours; a production scheduler, deadline job
scheduling, or notification-delivery workers; workspace invitations or member
administration; public leaderboards or social feeds; billing; AI-generated
motivation or AI decisions; complex analytics; native mobile applications; a
feedback administration dashboard; a broad UI redesign; an observability
vendor; or automatic Production migration/deployment. See the approved design
and implementation plan under `docs/superpowers/` for the exact boundaries.

The hosted production smoke test covers self-service signup and onboarding. The
seeded 52-point guided-demo identity and reset workflow remain local/controlled
demo operations and were not provisioned into the Production database.
