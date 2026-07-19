# Closed-Pilot Readiness Checklist

Use this checklist for each authorized hosted pilot environment. An unchecked
box is not a passed check; attach real evidence and request IDs where useful.

Production environment reviewed July 17–18, 2026:
<https://momentum-bay-two.vercel.app>. Only checks actually exercised against
that hosted environment are marked complete below.

## Environment and data safety

- [ ] Preview/demo and Production use separate Supabase projects.
- [ ] Preview and Production variables are stored in distinct Vercel scopes.
- [ ] `MOMENTUM_ENVIRONMENT` matches each scope; Production has no demo
      reset/provision configuration.
- [ ] Supabase Auth Site URL and the local, Production, and restricted team
      preview redirect patterns were reviewed.
- [x] The Production GitHub OAuth App uses homepage
      `https://momentum-bay-two.vercel.app` and authorization callback
      `https://mggneeapcgozymqnsjlk.supabase.co/auth/v1/callback`.
- [x] The GitHub client ID and secret are stored only in the matching Supabase
      provider, and
      `https://momentum-bay-two.vercel.app/auth/callback` is an allowed redirect.
- [x] Production `NEXT_PUBLIC_APP_URL` is the exact HTTPS application origin;
      the optional `GITHUB_DIRECTORY_TOKEN` contract remains server-only.
- [x] Migration `202607180005_cohort_assignment_github_oauth.sql` was dry-run,
      reviewed, and applied before the application build that consumes it.
- [ ] Migration `202607180006_project_archive.sql` was dry-run, reviewed, and
      applied before the application build that consumes it.
- [x] Password signup/sign-in still works after GitHub OAuth is enabled; GitHub
      is additive rather than a replacement.
- [x] On July 17, 2026, Production password signup worked with email
      confirmation disabled; the GitHub provider had not yet been enabled in
      the hosted Supabase project.
- [x] The linked Supabase project reference is the intended target.
- [x] `supabase db push --linked --dry-run` output was reviewed before the
      migration push.
- [x] Database URLs, service-role keys, demo passwords, and job secrets are
      stored only in approved server/operator secret stores.
- [ ] Demo credentials were shared only through the approved secret-sharing
      channel and were not placed in source, tickets, chat, or screenshots.
- [ ] `pnpm demo:reset` displayed the expected project reference, received the
      exact typed confirmation, and produced the canonical verified summary.
- [ ] The exact **2 → 3** guided completion is scheduled Monday through Friday
      in the demo owner's `America/New_York` timezone; no weekend override is
      enabled.

## Application smoke checks

- [x] `GET /api/health` returned HTTP 200 with only
      status/environment/release/requestId and an `x-request-id` header.
- [x] After the cohort OAuth deployment, `GET /api/health` returned HTTP 200 and
      its sanitized release value matched commit `e303995` under review.
- [x] A fresh user signed up, created a workspace and project, then reloaded the
      hosted project URL with the authenticated session and data preserved.
- [x] The public repository was accessible without credentials, and a fresh
      clone exposed the README, AGENTS.md, auth path, and task-assignment source.
- [x] Open self-service `/sign-up` created a fresh password account without
      staff assistance.
- [x] An owner added the second tester's exact handle from the Hult cohort
      directory.
- [ ] An ordinary member was unable to add a cohort participant in the hosted
      UI.
- [x] A task assigned to the pending handle stayed in To Do, displayed its
      **@handle** with **Waiting for GitHub sign-in**, and exposed no Focus,
      Start, or Complete action.
- [x] The assignee filter showed the pending participant's task and cleared back
      to the complete board without changing task state.
- [ ] A Production owner archived a disposable project; it disappeared from
      active workspace cards, navigation, dashboard summaries, and selectors.
- [ ] The archived project's direct URL returned the safe unavailable
      experience while its existing task and completion history remained
      preserved in the database.
- [ ] An ordinary member saw no archive control and could not invoke the
      archive action for the project.
- [x] In a separate browser session, the matching real GitHub account signed in
      and atomically claimed the workspace seat and assigned task.
- [x] After claim, the second account started, completed, and reloaded; the
      20-point receipt, First Step achievement, 100% project progress,
      supportive message, notification, and celebration persisted.
- [ ] The claimed account selected Focus and advanced its streak in Production.
      The July 18 smoke test ran on a weekend, so Focus/streak progression was
      correctly left unchanged and must be exercised on a workday.
- [ ] The complete guided demo in [demo-script.md](demo-script.md) passed at a
      desktop width.
- [x] At 390×844, the claimed task and its controls remained reachable with no
      horizontal overflow.
- [ ] At 390×844, Team discovery, task assignment, assignee filtering,
      navigation, task controls, feedback, and celebration dialogs remained
      reachable without horizontal overflow.
- [ ] Keyboard-only navigation, Focus selection, Start, Complete, dialog focus
      trap/return, feedback submission, and notification navigation passed with
      visible focus.
- [ ] OS reduced motion produced the full static celebration with no pulse or
      canvas movement.
- [ ] Disabling Celebration animation in Settings independently produced the
      static celebration.
- [ ] An inaccessible workspace/project URL returned the safe not-found
      experience without revealing tenant existence.
- [x] The claimed second account tried an unrelated workspace URL and received
      the same safe not-found experience.
- [ ] A second authorized tenant could not read or mutate the pilot workspace.
- [x] Reopening and recompleting a task created no additional points, streak
      transition, achievement, notification, or visual effect.

## Feedback and deadline operations

- [ ] Valid feedback was submitted from the pilot UI and displayed a supportive
      success result.
- [ ] A controlled identical feedback retry created exactly one database row;
      changed content with the same key returned a safe conflict.
- [ ] An authorized operator reviewed feedback with
      [feedback-review.sql](feedback-review.sql) and an explicit `since` value.
- [ ] Another user could not read the submitter's feedback through the
      browser-facing Supabase boundary.
- [ ] `pnpm demo:nudges` created the expected due-soon notification.
- [ ] Repeating `pnpm demo:nudges` for the same task and exact deadline created
      zero duplicates.
- [ ] Deadline-job logs contain a request-correlated start and completed or
      failed outcome without task content, credentials, or raw errors.

## Release, incidents, and exclusions

- [x] `pnpm check:secrets` passed against the exact tracked release commit.
- [x] `pnpm validate` passed, and its actual suite/assertion counts were saved.
- [x] The current release commit passed `pnpm check:secrets` after OAuth
      configuration, and no OAuth secret or directory token appeared in source,
      pull-request text, logs, or screenshots.
- [x] The cohort-specific browser test passed with
      `pnpm test:e2e -- tests/e2e/cohort-assignment.spec.ts`; real OAuth was
      verified separately with two accounts because automated tests do not
      contact GitHub OAuth.
- [ ] Pilot participants were told the known exclusions: no Resend/production
      email, SMS/phone collection, quiet hours, production scheduler or delivery
      workers, deadline-job scheduling, invitation delivery, manual GitHub
      identity linking, member removal or role-management UI, GitHub
      organization enforcement, public leaderboard/social feed, billing,
      AI-authored motivation or AI decisions, complex analytics, native mobile
      app, feedback admin dashboard, broad redesign, observability vendor, or
      automatic Production migration/deployment.
- [ ] The incident procedure records the safe `x-request-id` without copying
      request bodies, credentials, personal data, task content, or feedback
      text.
- [ ] An application rollback owner and database forward-migration owner are
      named and reachable during the pilot window.
- [ ] The rollback owner reviewed the rule: roll back application code first;
      never reverse immutable completion/point data; correct schema with a
      forward migration.
