# Deployment and Environment Operations

This guide describes deployment readiness for Momentum. It is not evidence that
a hosted deployment, hosted migration, or hosted smoke test has run. Perform
every hosted step against reviewed project and deployment scopes, and record the
result separately.

## Environment separation

| Environment  | Application       | Database and auth                   | Data policy                         |
| ------------ | ----------------- | ----------------------------------- | ----------------------------------- |
| Local        | `next dev`        | Local Supabase CLI                  | Committed deterministic seed        |
| Test         | Vitest/Playwright | Reset local Supabase                | Disposable fixtures and test clock  |
| Preview/demo | Vercel Preview    | Dedicated hosted demo Supabase      | Explicit operator reset/provision   |
| Production   | Vercel Production | Separate hosted production Supabase | Migrations only; never a demo reset |

Preview/demo and Production must use different Supabase projects and different
Vercel environment-variable scopes. Never copy a Preview database URL, key, or
job secret into Production. `MOMENTUM_ENVIRONMENT` must be set explicitly to
`preview` or `production` in the matching Vercel scope. Local helpers default to
`local`; automated test processes set `test`.

`--allow-local` is an automated/local-test escape hatch, not an
environment-label trust decision. It additionally requires both the Supabase
API and PostgreSQL hosts to be loopback (`localhost`, `127.0.0.1`, or `::1`)
before any service-role request or database write.

## Environment-variable contract

Copy `.env.example` to an ignored local environment file and replace its
placeholders locally. Do not commit populated environment files.

| Variable                               | Exposure        | Purpose                                                                 |
| -------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public          | Environment-specific Supabase API URL.                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public          | Browser-safe publishable key; never use a service-role credential.      |
| `NEXT_PUBLIC_APP_URL`                  | Public          | Exact canonical application origin used for the OAuth return URL.       |
| `GITHUB_DIRECTORY_TOKEN`               | Server only     | Optional GitHub API token for higher cohort-directory rate limits.      |
| `DATABASE_URL`                         | Server only     | PostgreSQL connection, preferably the transaction pooler on Vercel.     |
| `MOMENTUM_ENVIRONMENT`                 | Server/operator | One of `local`, `test`, `preview`, or `production`.                     |
| `MOMENTUM_RELEASE`                     | Server          | Optional safe release label; Vercel commit SHA is the fallback.         |
| `MOMENTUM_JOB_SECRET`                  | Server/operator | Long random bearer secret for the manual deadline-nudge route.          |
| `MOMENTUM_ALLOW_TEST_CLOCK`            | Server/test     | `true` only in automated tests; false or absent elsewhere.              |
| `SUPABASE_SERVICE_ROLE_KEY`            | Operator only   | Creates confirmed demo Auth users; never expose or add to browser code. |
| `MOMENTUM_DEMO_EMAIL`                  | Operator only   | Runtime email for the guided demo owner.                                |
| `MOMENTUM_DEMO_PASSWORD`               | Operator only   | Runtime demo password; never commit or log it.                          |
| `MOMENTUM_DEMO_TEAMMATE_EMAIL`         | Operator only   | Runtime identity for the fixture teammate.                              |
| `MOMENTUM_SUPABASE_PROJECT_REF`        | Operator only   | Exact dedicated demo project reference checked by reset/provision.      |
| `MOMENTUM_DEMO_BASE_URL`               | Operator only   | Base URL used by `pnpm demo:nudges`.                                    |

Set the three `NEXT_PUBLIC_` values plus the server runtime values in the
appropriate Vercel Preview or Production scope. Keep the service-role key,
demo identities, demo password, and project reference in the approved operator
environment rather than the deployed browser bundle. Production never receives
demo reset/provision configuration.

`NEXT_PUBLIC_APP_URL` is public but must still be scoped correctly: Production
uses `https://momentum-bay-two.vercel.app`; Preview uses the exact stable Preview
origin allowed by its dedicated Supabase project. Do not use an arbitrary
request `Host` header to construct OAuth callbacks. `GITHUB_DIRECTORY_TOKEN` is
optional, server-only, and separate from the GitHub OAuth client secret stored
in Supabase.

Share the demo password only through the pilot's approved secret-sharing
channel. Never paste a database URL, service-role key, password, publishable key
from a private project, or job secret into source, tickets, chat transcripts,
screenshots, or command output.

## GitHub OAuth and Supabase Auth URLs

Use environment-specific Auth settings and keep the redirect allow-list narrow:

- Production Site URL: `https://<production-domain>`
- Preview/demo Site URL: `https://<stable-demo-domain>` for the dedicated demo
  deployment
- Local redirect: `http://localhost:3000/**`
- Production redirect: `https://<production-domain>/**`
- Preview redirects: `https://*-<vercel-team>.vercel.app/**` for the team's
  controlled Vercel scope only

Do not add a blanket redirect for unrelated domains. Momentum supports
email/password authentication alongside GitHub OAuth. Hosted demo accounts are
created already confirmed by the operator provisioner. Production email
delivery remains deliberately deferred.

Provision Production GitHub OAuth in this order. These are operator steps, not
evidence that the current hosted environment has already been configured:

1. Create a GitHub OAuth App. Set its homepage URL to
   `https://momentum-bay-two.vercel.app` and its authorization callback URL to
   `https://mggneeapcgozymqnsjlk.supabase.co/auth/v1/callback`.
2. In Supabase Dashboard → Authentication → Providers → GitHub, enter the
   GitHub client ID and client secret. Store them only there; neither belongs in
   application environment variables or source.
3. In Supabase Dashboard → Authentication → URL Configuration, add
   `https://momentum-bay-two.vercel.app/auth/callback` to the redirect URLs.
4. In Vercel Production, set
   `NEXT_PUBLIC_APP_URL=https://momentum-bay-two.vercel.app`. In Preview, set it
   to the exact stable Preview origin authorized by the dedicated Preview
   Supabase project. Optionally set `GITHUB_DIRECTORY_TOKEN` as a server-only
   variable in the scopes that need higher GitHub API rate limits.
5. Apply migrations `202607180005_cohort_assignment_github_oauth.sql` and
   `202607180006_project_archive.sql` manually to the Production Supabase
   project before deploying the application builds that consume them.
6. Never paste the GitHub OAuth client secret or directory token into GitHub
   source, Vercel public variables, pull-request text, logs, or screenshots.

A separate Preview Supabase project needs its own reviewed provider callback,
application redirect URL, and stable Preview origin. Do not point a Preview
deployment at the Production Auth project merely to reuse the OAuth App.

## Apply migrations deliberately

Link and inspect the exact target before mutation:

```bash
pnpm exec supabase link --project-ref "your-reviewed-project-ref"
pnpm exec supabase db push --linked --dry-run
pnpm exec supabase db push --linked
```

Review the project reference and complete dry-run output before the final push.
Migrations are operator actions. Never add `supabase db push`, demo provisioning,
or demo reset to `next build`, a Vercel build command, or an application request.

For the dedicated Preview/demo project only, provision or reset the fixture
after migrations and after loading the required operator variables:

```bash
pnpm demo:provision
pnpm demo:reset
```

Run these Preview commands Monday through Friday in `America/New_York`. They
refuse weekends before mutation so the canonical **2 → 3** walkthrough never
contradicts the rule that weekends leave streaks unchanged.

`pnpm demo:reset` refuses Production, verifies the linked project reference,
and requires the operator to type the displayed confirmation phrase. It is
destructive and must never target shared or Production data.

## Deploy on Vercel

1. Create separate Supabase projects for Preview/demo and Production.
2. Configure the Auth Site URL, restricted redirect patterns, and GitHub
   provider above in each project without disabling password authentication.
3. Add the matching variables to the Vercel Preview and Production scopes;
   verify the scope before saving every secret.
4. Apply migrations explicitly with the reviewed Supabase CLI sequence,
   including `202607180005_cohort_assignment_github_oauth.sql` and
   `202607180006_project_archive.sql` before the application builds that
   consume them.
5. Deploy with Vercel's normal Next.js install and `pnpm build` flow. Momentum
   needs no build-time migration hook.
6. Verify health, password sign-in, GitHub OAuth with two real accounts, an
   authenticated page, tenant isolation, and the appropriate guided or
   Production smoke flow.

Use [Vercel's project dashboard](https://vercel.com/dashboard) for deployment
and environment-scope management. This repository does not create a deployment
or hosted project automatically.

## Verify health

```bash
curl -i https://your-domain.example/api/health
```

A healthy deployment returns HTTP 200 and JSON containing only these sanitized
keys:

```json
{
  "status": "ok",
  "environment": "preview",
  "release": "reviewed-release-id",
  "requestId": "safe-request-id"
}
```

`release` can be `null`. A database probe failure returns HTTP 503 with
`status: "degraded"` and the same safe metadata. The response must not include
hostnames, connection strings, keys, raw errors, schema details, or user data.
Capture the response `x-request-id` when investigating an incident.
The public probe has a two-second response deadline and returns degraded rather
than waiting indefinitely; database connection attempts are also bounded.

## Rollback

Roll the application deployment back first when a release is unhealthy. Never
reverse, delete, or rewrite immutable task-completion receipts or point-ledger
rows. If a schema correction is necessary, write and review a forward migration
that preserves existing completion and reward history. Name an application
rollback owner and a database-migration owner before beginning a pilot deploy.

## Hosted checks that remain manual

The following require real hosted projects, secrets, URLs, and authorization,
so a local validation run cannot claim them:

- Vercel Preview and Production deployment success;
- linked Supabase dry-run and migration output against each hosted project;
- hosted Auth Site URL and redirect enforcement;
- GitHub OAuth App, Supabase provider, application callback, and Vercel
  `NEXT_PUBLIC_APP_URL` configuration;
- operator provisioning/reset against the dedicated demo project;
- hosted password sign-in, two-account GitHub claim, health, authenticated
  pages, tenant isolation, project archive authorization/history preservation,
  and guided demo smoke checks;
- live request-ID correlation in Vercel logs; and
- rollback execution against a real deployment.

Record those checks in the [closed-pilot checklist](closed-pilot-checklist.md)
only after they actually run.
