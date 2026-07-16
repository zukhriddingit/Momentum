# Momentum

Momentum is a motivation-first project-management application. The implemented self-service core lets a new user sign up, create a workspace and project, create and assign tasks, choose a Focus Task, move it across a three-column board, complete it once, and see persisted rewards and progress. The motivation experience adds five achievement definitions, deterministic supportive messages in four personal tones, preference controls, persisted celebrations, in-app notification history, and an idempotent in-app deadline-nudge scanner. The deterministic seeded Slice 1 path remains a permanent regression flow.

## Local setup

Requirements: Node.js 20.9 or newer, pnpm 11, Docker Desktop, and the Supabase CLI installed through the project dependencies.

```bash
pnpm install
pnpm supabase:start
pnpm dev:local
```

Open `http://localhost:3000` and sign in with:

- Email: `demo@momentum.local`
- Password: `momentum-demo`

Alternatively, open `/sign-up` and create a local account with a display name, email, password of at least 12 characters, and valid IANA timezone such as `America/New_York`. Local email signup is enabled, email confirmation is disabled, and the new account receives an immediate session. The onboarding flow then creates an owner workspace and first project.

The first start intentionally launches only the Supabase services needed by this slice (PostgreSQL, Auth, PostgREST, and the API gateway). Reset the deterministic demo data with `pnpm supabase:reset`, and stop the local stack with `pnpm supabase:stop`.

Database resets apply all migrations in order. The first creates the Slice 1 collaboration and reward model. The second adds atomic Auth-profile initialization, workspace-assignee validation, completed-assignee protection, indexes, and browser-role guardrails. The third adds immutable completion-message snapshots, motivation preferences, notification routing and deadline identities, and the complete MVP achievement catalog. The conflict-safe seed then restores the demo workspace.

## Completion results

The demo user starts with a two-workday Focus Streak and 41 historical points. Completing the medium Focus Task at least 24 hours early yields 52 points: 40 base, 8 early-completion bonus, and 4 streak bonus. The persisted result is 93 total points, a streak of three, the Momentum Three achievement, 75% project progress, one supportive notification, and a reload-safe celebration receipt.

A new user who completes a self-assigned medium Focus Task without a deadline earns 40 points: 40 base with no timing or prior-streak bonus. The persisted result is 40 total points, a streak progression from zero to one, 100% progress for a one-task project, one supportive notification, and a reload-safe celebration receipt. Reopening and recompleting returns the original receipt and does not create another reward.

Streak behavior follows the approved amendment: a weekday without a selected Focus Task pauses the streak, a weekday with a selected but incomplete Focus Task breaks it, and weekends neither increment nor break it.

## Motivation and deadline nudges

Each user can select Calm, Friendly, Energetic, or Minimal messages under `/settings`. Tone, animation, achievement visibility, deadline-nudge preference, and timezone are personal settings; none of them change trusted reward calculations. Completion messages are selected deterministically and persisted with the completion receipt, so a reload shows the same wording.

The protected deadline scanner creates only in-app notifications and is safe to retry for the same task and exact deadline. For local development, set `MOMENTUM_JOB_SECRET` in `.env.local`, then trigger a scan with:

```bash
curl -X POST http://localhost:3000/api/jobs/deadline-nudges \
  -H "Authorization: Bearer $MOMENTUM_JOB_SECRET"
```

This slice intentionally does not include a production scheduler. The endpoint must be invoked by a trusted caller, and the secret must never be exposed to browser code.

## Validation

With the local Supabase stack running:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

The CI-equivalent release gate is:

```bash
pnpm validate
```

The integration and end-to-end commands reset the local database before running. Do not point them at shared or production data. Playwright covers the seeded 52-point path, the clean-user 40-point path, and the personal-settings/notification/deadline-nudge path.

## Dependency rationale

- Next.js, React, TypeScript, Tailwind CSS, and the Tailwind PostCSS plugin provide the requested application foundation.
- `@supabase/supabase-js` and `@supabase/ssr` provide local authentication and server-cookie integration; `postgres` is used only by trusted server-side services for atomic transactions.
- Radix Dialog, `class-variance-authority`, `clsx`, `tailwind-merge`, and Lucide provide small shadcn/ui-compatible, accessible interface primitives.
- Zod validates server-action input.
- Vitest, pgTAP through the Supabase CLI, and Playwright cover pure domain rules, database-backed integration, and the main browser flow.
- Prettier, ESLint, and the Tailwind Prettier plugin provide formatting and lint foundations.

## Deliberately deferred

This slice does not include Resend or email delivery, SMS adapters or phone-number collection, quiet-hour scheduling, external notification-delivery workers, a production deadline scheduler, production deployment configuration, invitations, membership removal or role-management UI, AI-authored motivation, public leaderboards, kudos or social feeds, billing, or analytics. See the approved design and implementation plan under `docs/superpowers/` for those later slices.
