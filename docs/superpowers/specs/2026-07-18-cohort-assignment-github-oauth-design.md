# Cohort Assignment and GitHub OAuth Design

**Status:** Approved on July 18, 2026

## Purpose

Close the Project 1 ballot-eligibility gap identified by staff: an authorized
workspace owner must be able to add and assign work to any Hult cohort member by
GitHub username without an operator editing production data. A cohort member
must be able to prove ownership of that GitHub identity, join the workspace,
and act on the assigned task without the workspace owner coordinating a
database change.

This slice also adds the assignee filter required by the Project 1 baseline.
It preserves Momentum's motivation-first product loop and does not turn the
application into a broad member-administration suite.

## Confirmed decisions

- Email/password authentication remains available.
- GitHub OAuth is added as an optional, first-class authentication path.
- A task may be assigned to a cohort GitHub identity before that person creates
  a Momentum account.
- An unclaimed assignment remains in To Do and cannot become a Focus Task,
  start, complete, award points, update a streak, unlock an achievement, or
  create a completion notification.
- Supabase's verified GitHub provider identity is the only evidence accepted
  when claiming a GitHub identity. A username typed into a form is not proof of
  identity ownership.
- Only workspace owners and admins may add cohort participants. Ordinary
  members may assign tasks only to people already present in their workspace.
- The cohort directory is loaded server-side from Project 1 pull requests in
  `rogerSuperBuilderAlpha/hult-cohort-program`, cached for 15 minutes, and
  backed by a committed snapshot.
- An owner may look up an exact GitHub username that is absent from the synced
  directory. The server must resolve it to a real GitHub account before adding
  it.
- The project board adds an assignee filter. The existing project switcher and
  three Kanban columns continue to provide the project and status views.
- Member removal, role editing, manual identity linking, email invitations,
  SMS, and outbound delivery remain outside this slice.

## User outcomes

### Workspace owner or admin

1. Open the workspace overview and find the Team section.
2. Search the current Hult directory by display name or GitHub handle.
3. Add a participant as a member of the workspace.
4. Immediately assign a To Do task to that participant, even if the participant
   has not registered with Momentum.
5. Filter the board to that participant and see the pending assignment.

### Cohort participant

1. Choose Continue with GitHub on Momentum's sign-in or sign-up surface.
2. Complete GitHub authorization through Supabase Auth.
3. Return through Momentum's OAuth callback with a verified GitHub identity.
4. Automatically claim every pending workspace seat tied to the stable GitHub
   user ID.
5. See the relevant workspaces, projects, and tasks on the dashboard.
6. Select, start, and complete the now-active assignment through the normal
   Momentum workflow.

## Architecture

The feature has four bounded units:

1. **Cohort directory:** a server-only GitHub adapter that converts public
   Project 1 pull-request data into normalized cohort entries. It uses Next.js
   server caching and falls back to a committed snapshot when GitHub is
   unavailable or rate-limited.
2. **Workspace cohort seats:** a persistence and service boundary representing
   a GitHub participant added to a workspace before or after registration.
3. **Verified identity claim:** an OAuth callback service that extracts the
   verified GitHub user ID and handle from the authenticated Supabase identity,
   then activates matching seats transactionally.
4. **Assignable task view:** task services and UI that support either an active
   profile assignee or an unclaimed cohort seat while keeping pending tasks out
   of trusted reward operations.

GitHub API calls and database writes remain server-side. Browser components
receive only display-ready directory entries, assignee options, and action
results.

## Database design

### Profile identity

Add nullable GitHub identity columns to `public.profiles`:

- `github_user_id bigint`
- `github_handle text`

`github_user_id` has a unique partial index when non-null. `github_handle` is
stored in normalized lowercase form and has a unique partial lowercase index.
The stable numeric user ID is authoritative for claims; the handle is display
and lookup metadata because GitHub usernames can change.

Update `public.initialize_auth_profile()` so GitHub OAuth users can be created
without the email-signup metadata currently required by the trigger. It chooses
the first non-empty value from verified GitHub full name, verified GitHub
handle, email local part, and `Momentum member` for `display_name`. It uses a
validated submitted timezone when present and otherwise defaults to `UTC`.
Email/password signup continues to submit and validate the user's selected
timezone.

### Workspace cohort seats

Create `public.workspace_cohort_seats`:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id) on delete cascade`
- `github_user_id bigint not null`
- `github_handle text not null`
- `user_id uuid references profiles(id) on delete restrict`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null`
- `claimed_at timestamptz`

Constraints and indexes:

- unique `(workspace_id, github_user_id)`;
- partial unique `(workspace_id, user_id)` when `user_id is not null`;
- normalized GitHub-handle format and length checks;
- `claimed_at` is null exactly when `user_id` is null.

A seat with no `user_id` is pending. A claimed seat retains its original GitHub
identity as an audit record. Claiming also creates the existing
`workspace_memberships` row with role `member`; authorization continues to use
`workspace_memberships`, not cohort seats.

### Task assignees

Change `tasks.assignee_id` from required to nullable and add:

- `cohort_seat_id uuid references workspace_cohort_seats(id) on delete restrict`

A check constraint requires exactly one of `assignee_id` and `cohort_seat_id`
to be non-null. Existing tasks retain their current `assignee_id`; no reward or
completion history is rewritten.

The task-assignee trigger is extended to enforce:

- an active `assignee_id` belongs to the task's workspace;
- a `cohort_seat_id` belongs to the task's workspace and is still pending;
- a task with a pending seat has status `todo`;
- a first-completed task cannot change either assignee representation.

### Claim transaction

Given the authenticated profile ID and verified GitHub user ID, one transaction:

1. locks the profile and all matching pending cohort seats;
2. rejects a conflicting profile already linked to that GitHub user ID;
3. stores the normalized verified GitHub identity on the profile;
4. creates each missing `workspace_memberships` row as `member`;
5. updates every pending task for each seat to set `assignee_id` to the profile
   and clear `cohort_seat_id`;
6. marks each seat claimed by that profile and records `claimed_at`;
7. returns the claimed workspace and task counts.

The transaction is idempotent. A repeated OAuth callback returns the already
claimed result without duplicating memberships or changing task history.

## Cohort directory

The GitHub adapter requests pull requests from
`rogerSuperBuilderAlpha/hult-cohort-program`, includes open and merged Project 1
submissions, and recognizes participant branches under
`participants/summer26/phase-1-project-1/`. It normalizes and deduplicates by
GitHub's stable numeric user ID.

Each directory entry contains only public data:

- stable GitHub user ID;
- normalized handle;
- GitHub profile URL;
- source pull-request URL;
- display name when GitHub provides one.

The adapter uses a 15-minute server cache. An optional server-only GitHub token
may increase rate limits, but no browser code receives it and the feature must
remain usable without it. The committed fallback snapshot contains the same
typed fields and a synchronization timestamp.

Exact username lookup is server-only. A successful lookup returns the same
normalized entry type. Network failure returns a supportive retry result and
does not create an unverified seat. The public PR directory is a convenience,
not the security boundary; the verified OAuth user ID is the claim boundary.

## Authentication flow

Add Continue with GitHub beside the existing email/password forms. A server
action begins Supabase GitHub OAuth with a redirect to Momentum's
`/auth/callback` route.

The callback:

1. validates and exchanges the OAuth code through the server Supabase client;
2. requires a GitHub identity in `user.identities`;
3. extracts the stable provider user ID and verified current handle;
4. ensures a valid profile exists;
5. runs the claim transaction;
6. redirects to `/dashboard` on success.

Authentication failures redirect to sign-in with a non-sensitive, supportive
error code. The callback never accepts a GitHub handle from query parameters or
form data. Existing email/password accounts remain valid. Linking an existing
email/password user to GitHub manually is not part of this slice.

## Server boundaries

### Directory services

- fetch and normalize cohort pull requests;
- resolve an exact GitHub username;
- fall back to the committed snapshot;
- never expose tokens or raw upstream errors.

### Workspace services

- list active members and pending cohort seats for an authorized workspace;
- add a cohort seat after locking and checking owner/admin membership;
- immediately activate the seat when the GitHub user ID is already linked to a
  Momentum profile;
- return the same safe not-found response for unknown and unauthorized
  workspaces.

### Task services

Task input becomes a discriminated assignee reference:

- `{ kind: "member", userId: string }`; or
- `{ kind: "cohort", seatId: string }`.

Create and update services resolve the reference inside the transaction and
verify workspace ownership. Pending assignees force status `todo`. Focus,
movement, completion, reward, streak, achievement, and notification services
continue to require an active `assignee_id` matching the actor.

## User interface

### Workspace Team section

The workspace overview shows active members and pending cohort participants.
Owners and admins see Add cohort member with directory search and exact-username
lookup. Ordinary members see the team list without mutation controls.

Pending rows use supportive copy such as `Waiting for @handle to join` and link
to the public GitHub profile. The interface does not shame or repeatedly nudge
an unregistered participant.

### Task dialog and cards

Assignee options combine active members and workspace cohort seats. Pending
options are labeled `@handle — awaiting GitHub sign-in`. Selecting one forces
the task to To Do and removes unavailable Done or In Progress choices.

Pending task cards show the handle and a small awaiting-sign-in state. They do
not show Focus, Start, or Complete actions. Authorized creators, owners, and
admins may still edit or reassign the task.

### Assignee filter

The board adds a labeled native select with:

- All assignees;
- Me;
- each active workspace member;
- each pending cohort handle.

Filtering is client-side over the authorized board payload and does not change
trusted calculations. The empty state explains that no tasks match the current
assignee filter and offers a clear reset.

## Authorization and security

- Owner/admin checks execute inside the seat-creation transaction.
- GitHub identity claims trust only Supabase's verified provider identity.
- Stable GitHub user IDs, not mutable handles, match pending seats.
- Browser input cannot create memberships, claim seats, or select a foreign
  workspace assignee without server validation.
- Cross-workspace IDs use safe not-found responses that do not reveal tenant
  existence.
- Cohort-seat and task constraints provide defense in depth against direct SQL
  mistakes.
- Browser-facing Supabase roles receive no direct insert, update, or delete
  access to cohort seats.
- GitHub OAuth client secrets remain in Supabase provider configuration and are
  never placed in source, Vercel browser variables, logs, or screenshots.
- Existing immutable point-ledger and exactly-once completion constraints remain
  unchanged.

## Error handling

- GitHub directory failure uses the committed snapshot and displays its last
  synchronization time.
- Exact lookup failure returns a supportive retry message and performs no write.
- Adding an existing seat returns the existing seat as a successful idempotent
  result.
- Adding an already registered GitHub user activates a normal membership
  immediately.
- OAuth without a usable GitHub identity returns to sign-in without partially
  claiming data.
- Identity conflicts, cross-tenant references, and pending-task completion
  attempts fail atomically with non-sensitive user-facing messages.

## Testing strategy

### Unit tests

- GitHub-handle normalization and validation;
- pull-request parsing, branch filtering, and stable-ID deduplication;
- fallback selection and synchronization metadata;
- verified Supabase GitHub-identity extraction;
- assignee-option construction and board filtering;
- pending-task permission decisions.

### Database tests

- exactly-one-assignee constraint;
- same-workspace active and pending assignee enforcement;
- pending tasks remain To Do;
- unique workspace/GitHub seats;
- claim membership creation and task conversion;
- repeated claims are idempotent;
- completed assignments remain immutable;
- browser roles cannot mutate cohort seats directly.

### Integration tests

- owner and admin can add a cohort participant;
- ordinary member and outsider receive safe failures;
- adding an already linked GitHub identity activates membership immediately;
- pending tasks reject Focus, movement, completion, and rewards;
- verified claim activates all matching workspaces and tasks atomically;
- cross-workspace seat references are rejected;
- active claimed tasks preserve existing exactly-once completion behavior.

### End-to-end tests

The local Playwright flow covers owner directory search, pending-seat creation,
pending task assignment, pending card restrictions, and assignee filtering.
Integration tests cover the verified-identity claim transaction because local
CI must not depend on external GitHub OAuth.

A production manual smoke test uses two real GitHub accounts to verify OAuth,
automatic claim, cross-account workspace access, task progression, refresh
persistence, and no duplicate reward after reopen/recomplete.

## Deployment and operations

Production rollout order:

1. Create a GitHub OAuth application with Supabase's hosted Auth callback URL.
2. Configure the GitHub client ID and secret in production Supabase Auth.
3. Add Momentum's production `/auth/callback` URL to Supabase redirect URLs.
4. Review and apply the database migration manually.
5. Deploy the application and verify `/api/health` before user testing.
6. Run the two-account OAuth and assignment smoke test.
7. Update README setup instructions, architecture, deployed testing steps, and
   known limitations.
8. Update both pull-request descriptions and add a concise staff-review comment
   with the public repository, production URL, and five-minute test path.

No migration, OAuth provisioning, or production secret mutation runs from the
application build.

## Five-minute staff demonstration

1. Sign in as the workspace owner.
2. Open Team and add a visible cohort GitHub handle.
3. Create a task assigned to the pending handle.
4. Filter the board to that assignee and show the pending restrictions.
5. In a separate browser, choose Continue with GitHub as that participant.
6. Open the claimed workspace and move the task to In Progress.
7. Complete it and reload to show persisted progress and exactly-once rewards.

## Acceptance criteria

- The repository is publicly readable and documents the production URL.
- Open self-service email/password signup still works.
- GitHub OAuth creates or restores an authenticated session.
- Owners/admins can add a participant from the cohort directory without an
  operator or database edit.
- A task can be assigned to an unregistered cohort GitHub identity.
- The pending task cannot enter trusted completion or reward workflows.
- Verified GitHub sign-in claims pending seats and tasks automatically.
- The claimed participant can access and complete the task.
- The board filters by active or pending assignee.
- Cross-tenant access and identity impersonation are rejected.
- Existing reward, streak, achievement, notification, and idempotency tests
  remain green.
- Formatting, linting, strict type checking, unit tests, database tests,
  integration tests, relevant Playwright tests, secret scanning, and the
  production build all pass before deployment.

## Deliberate exclusions

- Workspace member removal and role-management UI;
- email or SMS invitation delivery;
- GitHub organization membership enforcement;
- manual linking of an existing email/password account to GitHub;
- comments, social feeds, public leaderboards, billing, and analytics;
- automatic production migrations or deployment;
- changes to trusted reward formulas or streak rules.
