import assert from "node:assert/strict";

import { EXPECTED_DEMO_FIXTURE_SUMMARY } from "../../scripts/lib/demo-fixture.mjs";
import {
  provisionDemoApplicationData,
  reportVerifiedDemoFixtureSummary,
  safeFetch,
  verifyHostedDemoProject,
} from "../../scripts/provision-demo.mjs";

function assertSafeError(error, message, rawValue) {
  assert.equal(error.message, message);
  assert.equal(String(error), `Error: ${message}`);
  assert.equal("cause" in error, false);
  assert.equal(String(error).includes(rawValue), false);
  assert.equal(error.stack?.includes(rawValue), false);
  return true;
}

const rawDatabaseError =
  "postgresql://admin:secret@db.internal/momentum relation pilot_feedback does not exist";
await assert.rejects(
  provisionDemoApplicationData({}, async () => {
    throw new Error(rawDatabaseError);
  }),
  (error) =>
    assertSafeError(
      error,
      "Could not provision demo application data.",
      rawDatabaseError,
    ),
);

const rawFetchError =
  "request to https://abcdefghijklmnopqrst.supabase.co/auth/v1/admin/users?token=secret rejected";
await assert.rejects(
  safeFetch("https://safe.invalid", undefined, async () => {
    throw new Error(rawFetchError);
  }),
  (error) =>
    assertSafeError(error, "Demo Supabase request failed.", rawFetchError),
);

const projectRef = "abcdefghijklmnopqrst";
assert.throws(
  () =>
    verifyHostedDemoProject({
      projectRef: "",
      supabaseUrl: `https://${projectRef}.supabase.co`,
      databaseUrl: `postgresql://postgres:password@db.${projectRef}.supabase.co:5432/postgres`,
    }),
  (error) =>
    assertSafeError(
      error,
      "MOMENTUM_SUPABASE_PROJECT_REF is required.",
      "password",
    ),
);
assert.equal(
  verifyHostedDemoProject({
    projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co`,
    databaseUrl: `postgresql://postgres:password@db.${projectRef}.supabase.co:5432/postgres`,
  }),
  projectRef,
);
assert.equal(
  verifyHostedDemoProject({
    projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co`,
    databaseUrl: `postgresql://postgres.${projectRef}:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  }),
  projectRef,
);

const rawApiCredential = "api-user:api-password";
assert.throws(
  () =>
    verifyHostedDemoProject({
      projectRef,
      supabaseUrl: `https://${rawApiCredential}@differentprojectref.supabase.co`,
      databaseUrl: `postgresql://postgres:password@db.${projectRef}.supabase.co:5432/postgres`,
    }),
  (error) =>
    assertSafeError(
      error,
      "Supabase API project does not match the confirmed demo project.",
      rawApiCredential,
    ),
);

const invalidApiUrl = `not-a-url-with-${rawApiCredential}`;
assert.throws(
  () =>
    verifyHostedDemoProject({
      projectRef,
      supabaseUrl: invalidApiUrl,
      databaseUrl: `postgresql://postgres:password@db.${projectRef}.supabase.co:5432/postgres`,
    }),
  (error) =>
    assertSafeError(error, "Supabase API URL is invalid.", rawApiCredential),
);

const rawDatabaseCredential = "database-password";
assert.throws(
  () =>
    verifyHostedDemoProject({
      projectRef,
      supabaseUrl: `https://${projectRef}.supabase.co`,
      databaseUrl: `postgresql://postgres:${rawDatabaseCredential}@db.differentprojectref.supabase.co:5432/postgres`,
    }),
  (error) =>
    assertSafeError(
      error,
      "Demo database project does not match the confirmed demo project.",
      rawDatabaseCredential,
    ),
);

const invalidDatabaseUrl = `not-a-url-with-${rawDatabaseCredential}`;
assert.throws(
  () =>
    verifyHostedDemoProject({
      projectRef,
      supabaseUrl: `https://${projectRef}.supabase.co`,
      databaseUrl: invalidDatabaseUrl,
    }),
  (error) =>
    assertSafeError(
      error,
      "Demo database URL is invalid.",
      rawDatabaseCredential,
    ),
);

const noncanonicalSecret = "postgresql://admin:secret@private.invalid/db";
let mismatchWasLogged = false;
assert.throws(
  () =>
    reportVerifiedDemoFixtureSummary(
      {
        ...EXPECTED_DEMO_FIXTURE_SUMMARY,
        userCount: 999,
        noncanonicalSecret,
      },
      () => {
        mismatchWasLogged = true;
      },
    ),
  (error) =>
    assertSafeError(
      error,
      "Demo fixture verification failed.",
      noncanonicalSecret,
    ),
);
assert.equal(mismatchWasLogged, false);

const safeLogs = [];
assert.equal(
  reportVerifiedDemoFixtureSummary(EXPECTED_DEMO_FIXTURE_SUMMARY, (value) =>
    safeLogs.push(value),
  ),
  EXPECTED_DEMO_FIXTURE_SUMMARY,
);
assert.deepEqual(safeLogs, [JSON.stringify(EXPECTED_DEMO_FIXTURE_SUMMARY)]);
