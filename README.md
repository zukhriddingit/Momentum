# Momentum

Momentum is a motivation-first project-management application. This repository currently implements only the first approved vertical slice: a seeded user can choose a Focus Task, move it through the board, complete it once, and see persisted rewards and progress.

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

The first start intentionally launches only the Supabase services needed by this slice (PostgreSQL, Auth, PostgREST, and the API gateway). Reset the deterministic demo data with `pnpm supabase:reset`, and stop the local stack with `pnpm supabase:stop`.

## Seeded result

The demo user starts with a two-workday Focus Streak and 41 historical points. Completing the medium Focus Task at least 24 hours early yields 52 points: 40 base, 8 early-completion bonus, and 4 streak bonus. The persisted result is 93 total points, a streak of three, the Momentum Three achievement, 75% project progress, one supportive notification, and a reload-safe celebration receipt.

Streak behavior follows the approved amendment: a weekday without a selected Focus Task pauses the streak, a weekday with a selected but incomplete Focus Task breaks it, and weekends neither increment nor break it.

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

The integration and end-to-end commands reset the local database before running. Do not point them at shared or production data.

## Dependency rationale

- Next.js, React, TypeScript, Tailwind CSS, and the Tailwind PostCSS plugin provide the requested application foundation.
- `@supabase/supabase-js` and `@supabase/ssr` provide local authentication and server-cookie integration; `postgres` is used only by trusted server-side services for atomic transactions.
- Radix Dialog, `class-variance-authority`, `clsx`, `tailwind-merge`, and Lucide provide small shadcn/ui-compatible, accessible interface primitives.
- Zod validates server-action input.
- Vitest, pgTAP through the Supabase CLI, and Playwright cover pure domain rules, database-backed integration, and the main browser flow.
- Prettier, ESLint, and the Tailwind Prettier plugin provide formatting and lint foundations.

## Deliberately deferred

This slice does not include Resend or email delivery, SMS adapters, quiet-hour scheduling, deadline-nudge jobs, notification-delivery workers, the full settings UI, achievements beyond Momentum Three, production deployment configuration, or the remaining full-MVP flows. See the approved design and implementation plan under `docs/superpowers/` for those later slices.
