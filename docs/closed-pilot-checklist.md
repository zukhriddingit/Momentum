# Closed-Pilot Readiness Checklist

Use this checklist for each authorized hosted pilot environment. An unchecked
box is not a passed check; attach real evidence and request IDs where useful.

## Environment and data safety

- [ ] Preview/demo and Production use separate Supabase projects.
- [ ] Preview and Production variables are stored in distinct Vercel scopes.
- [ ] `MOMENTUM_ENVIRONMENT` matches each scope; Production has no demo
      reset/provision configuration.
- [ ] Supabase Auth Site URL and the local, Production, and restricted team
      preview redirect patterns were reviewed.
- [ ] Password auth works; email confirmation, magic links, and OAuth remain
      disabled while no callback route exists.
- [ ] The linked Supabase project reference is the intended target.
- [ ] `supabase db push --linked --dry-run` output was reviewed before the
      migration push.
- [ ] Database URLs, service-role keys, demo passwords, and job secrets are
      stored only in approved server/operator secret stores.
- [ ] Demo credentials were shared only through the approved secret-sharing
      channel and were not placed in source, tickets, chat, or screenshots.
- [ ] `pnpm demo:reset` displayed the expected project reference, received the
      exact typed confirmation, and produced the canonical verified summary.

## Application smoke checks

- [ ] `GET /api/health` returned HTTP 200 with only
      status/environment/release/requestId and an `x-request-id` header.
- [ ] The complete guided demo in [demo-script.md](demo-script.md) passed at a
      desktop width.
- [ ] At 390×844, navigation, task controls, feedback, and celebration dialogs
      remained reachable without horizontal overflow.
- [ ] Keyboard-only navigation, Focus selection, Start, Complete, dialog focus
      trap/return, feedback submission, and notification navigation passed with
      visible focus.
- [ ] OS reduced motion produced the full static celebration with no pulse or
      canvas movement.
- [ ] Disabling Celebration animation in Settings independently produced the
      static celebration.
- [ ] An inaccessible workspace/project URL returned the safe not-found
      experience without revealing tenant existence.
- [ ] A second authorized tenant could not read or mutate the pilot workspace.
- [ ] Reopening and recompleting a task created no additional points, streak
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

## Release, incidents, and exclusions

- [ ] `pnpm check:secrets` passed against the exact tracked release commit.
- [ ] `pnpm validate` passed, and its actual suite/assertion counts were saved.
- [ ] Pilot participants were told the known exclusions: no Resend/production
      email, SMS/phone collection, quiet hours, production scheduler or delivery
      workers, deadline-job scheduling, invitations/member administration,
      public leaderboard/social feed, billing, AI-authored motivation or AI
      decisions, complex analytics, native mobile app, feedback admin dashboard,
      broad redesign, observability vendor, or automatic Production
      migration/deployment.
- [ ] The incident procedure records the safe `x-request-id` without copying
      request bodies, credentials, personal data, task content, or feedback
      text.
- [ ] An application rollback owner and database forward-migration owner are
      named and reachable during the pilot window.
- [ ] The rollback owner reviewed the rule: roll back application code first;
      never reverse immutable completion/point data; correct schema with a
      forward migration.
