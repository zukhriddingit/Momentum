import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { createClient } from "@supabase/supabase-js";

import {
  EXPECTED_DEMO_FIXTURE_SUMMARY,
  provisionDemoData,
} from "./lib/demo-fixture.mjs";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "MOMENTUM_DEMO_EMAIL",
  "MOMENTUM_DEMO_PASSWORD",
  "MOMENTUM_DEMO_TEAMMATE_EMAIL",
];

export function requireDemoEnvironment(env, { allowLocal }) {
  const value = env.MOMENTUM_ENVIRONMENT;
  if (!value) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (value === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  if (value === "local" && allowLocal) {
    return value;
  }
  if (value !== "preview" && value !== "test") {
    throw new Error("Demo provisioning requires preview or test.");
  }
  return value;
}

function isLoopbackHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function verifyLocalDemoTargets({ supabaseUrl, databaseUrl }) {
  let api;
  try {
    api = new URL(supabaseUrl);
  } catch {
    throw new Error("Local Supabase API URL is invalid.");
  }
  if (
    (api.protocol !== "http:" && api.protocol !== "https:") ||
    api.username ||
    api.password ||
    !isLoopbackHostname(api.hostname)
  ) {
    throw new Error("Local demo API target must be loopback.");
  }

  let database;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("Local demo database URL is invalid.");
  }
  if (
    (database.protocol !== "postgres:" &&
      database.protocol !== "postgresql:") ||
    !isLoopbackHostname(database.hostname)
  ) {
    throw new Error("Local demo database target must be loopback.");
  }

  return true;
}

export function requireGuidedDemoWorkday(now = new Date()) {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Guided demo date is invalid.");
  }
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);
  if (weekday === "Sat" || weekday === "Sun") {
    throw new Error(
      "The guided demo must run on a Monday through Friday workday.",
    );
  }
  return now;
}

function identityContainsProjectRef(identity, projectRef) {
  return identity.split(/[._-]/u).includes(projectRef);
}

export function verifyHostedDemoProject({
  projectRef,
  supabaseUrl,
  databaseUrl,
}) {
  if (!projectRef) {
    throw new Error("MOMENTUM_SUPABASE_PROJECT_REF is required.");
  }
  if (!/^[a-z0-9]{8,64}$/u.test(projectRef)) {
    throw new Error("Supabase project reference is invalid.");
  }

  let api;
  try {
    api = new URL(supabaseUrl);
  } catch {
    throw new Error("Supabase API URL is invalid.");
  }
  if (api.protocol !== "https:") {
    throw new Error("Supabase API URL is invalid.");
  }
  if (
    api.username ||
    api.password ||
    api.port ||
    api.hostname !== `${projectRef}.supabase.co`
  ) {
    throw new Error(
      "Supabase API project does not match the confirmed demo project.",
    );
  }

  let database;
  let databaseUsername;
  try {
    database = new URL(databaseUrl);
    databaseUsername = decodeURIComponent(database.username);
  } catch {
    throw new Error("Demo database URL is invalid.");
  }
  if (
    database.protocol !== "postgres:" &&
    database.protocol !== "postgresql:"
  ) {
    throw new Error("Demo database URL is invalid.");
  }
  const isSupabaseDatabaseHost =
    database.hostname.endsWith(".supabase.co") ||
    database.hostname.endsWith(".pooler.supabase.com");
  const hasProjectIdentity =
    identityContainsProjectRef(database.hostname, projectRef) ||
    identityContainsProjectRef(databaseUsername, projectRef);
  if (!isSupabaseDatabaseHost || !hasProjectIdentity) {
    throw new Error(
      "Demo database project does not match the confirmed demo project.",
    );
  }

  return projectRef;
}

export async function safeFetch(
  input,
  init,
  fetchImplementation = globalThis.fetch,
) {
  try {
    return await fetchImplementation(input, init);
  } catch {
    throw new Error("Demo Supabase request failed.");
  }
}

function requiredValue(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error("Could not inspect demo auth users.");
    }
    const match = data.users.find((user) => user.email === email);
    if (match) {
      return match;
    }
    if (data.users.length < 200) {
      return null;
    }
  }
}

async function ensureUser(admin, input) {
  const existing = await findUserByEmail(admin, input.email);
  if (existing) {
    const { data, error } = await admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: input.metadata,
    });
    if (error || !data.user) {
      throw new Error("Could not update a demo auth user.");
    }
    return data.user;
  }
  const { data, error } = await admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.metadata,
  });
  if (error || !data.user) {
    throw new Error("Could not create a demo auth user.");
  }
  return data.user;
}

export async function provisionDemoApplicationData(
  input,
  provisionData = provisionDemoData,
) {
  try {
    return await provisionData(input);
  } catch {
    throw new Error("Could not provision demo application data.");
  }
}

export function verifyDemoFixtureSummary(
  summary,
  expected = EXPECTED_DEMO_FIXTURE_SUMMARY,
) {
  if (!isDeepStrictEqual(summary, expected)) {
    throw new Error("Demo fixture verification failed.");
  }
  return summary;
}

export function reportVerifiedDemoFixtureSummary(summary, log = console.info) {
  const verified = verifyDemoFixtureSummary(summary);
  log(JSON.stringify(verified));
  return verified;
}

export async function provisionDemo({ allowLocal = false } = {}) {
  const environment = requireDemoEnvironment(process.env, { allowLocal });
  for (const name of required) {
    requiredValue(name);
  }
  const supabaseUrl = requiredValue("NEXT_PUBLIC_SUPABASE_URL");
  const databaseUrl = requiredValue("DATABASE_URL");
  const now = new Date();
  if (environment === "local") {
    verifyLocalDemoTargets({ supabaseUrl, databaseUrl });
  } else {
    verifyHostedDemoProject({
      projectRef: requiredValue("MOMENTUM_SUPABASE_PROJECT_REF"),
      supabaseUrl,
      databaseUrl,
    });
  }
  if (environment === "preview") {
    requireGuidedDemoWorkday(now);
  }
  const client = createClient(
    supabaseUrl,
    requiredValue("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: safeFetch },
    },
  );
  const metadata = (displayName) => ({
    display_name: displayName,
    timezone: "America/New_York",
  });
  const owner = await ensureUser(client.auth.admin, {
    email: requiredValue("MOMENTUM_DEMO_EMAIL"),
    password: requiredValue("MOMENTUM_DEMO_PASSWORD"),
    metadata: metadata("Maya Chen"),
  });
  const teammate = await ensureUser(client.auth.admin, {
    email: requiredValue("MOMENTUM_DEMO_TEAMMATE_EMAIL"),
    password: randomBytes(32).toString("base64url"),
    metadata: metadata("Alex Rivera"),
  });
  return reportVerifiedDemoFixtureSummary(
    await provisionDemoApplicationData({
      databaseUrl,
      ownerId: owner.id,
      teammateId: teammate.id,
      now,
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const cliArguments = process.argv.slice(2);
  const allowedArguments = cliArguments.every(
    (value) => value === "--allow-local",
  );
  if (!allowedArguments || cliArguments.length > 1) {
    throw new Error("Only --allow-local is supported.");
  }
  await provisionDemo({ allowLocal: cliArguments[0] === "--allow-local" });
}
