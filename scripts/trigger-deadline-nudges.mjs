import { pathToFileURL } from "node:url";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "::1", "localhost"]);
const NUDGE_ENVIRONMENTS = new Set(["local", "test", "preview"]);

export function rejectNudgeArguments(args) {
  if (args.length > 0) {
    throw new Error(
      "Deadline nudge trigger does not accept command arguments.",
    );
  }
}

export function requireNudgeConfiguration(env) {
  const environment = env.MOMENTUM_ENVIRONMENT;
  if (!environment) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (environment === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  if (!NUDGE_ENVIRONMENTS.has(environment)) {
    throw new Error("MOMENTUM_ENVIRONMENT is invalid for deadline nudges.");
  }

  const baseUrl = env.MOMENTUM_DEMO_BASE_URL;
  if (!baseUrl) {
    throw new Error("MOMENTUM_DEMO_BASE_URL is required.");
  }
  const secret = env.MOMENTUM_JOB_SECRET;
  if (!secret) {
    throw new Error("MOMENTUM_JOB_SECRET is required.");
  }

  let endpoint;
  try {
    const parsed = new URL(baseUrl);
    const loopback = LOOPBACK_HOSTS.has(parsed.hostname);
    const localHttp =
      parsed.protocol === "http:" &&
      (environment === "local" || environment === "test") &&
      loopback;
    const secureHttps = parsed.protocol === "https:";
    const unsafePort =
      Boolean(parsed.port) && (environment === "preview" || !loopback);
    if (
      (!localHttp && !secureHttps) ||
      parsed.username ||
      parsed.password ||
      unsafePort
    ) {
      throw new Error("invalid");
    }
    endpoint = new URL("/api/jobs/deadline-nudges", parsed);
  } catch {
    throw new Error("MOMENTUM_DEMO_BASE_URL is invalid.");
  }
  return { endpoint, secret };
}

function safeRequestId(value) {
  return value && REQUEST_ID_PATTERN.test(value) ? value : "unavailable";
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function triggerDeadlineNudges({
  env = process.env,
  fetchImplementation = globalThis.fetch,
  log = console.info,
} = {}) {
  const { endpoint, secret } = requireNudgeConfiguration(env);

  let response;
  try {
    response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
  } catch {
    throw new Error("Deadline scan request failed.");
  }

  let requestId;
  let responseOk;
  let responseStatus;
  try {
    requestId = safeRequestId(response.headers.get("x-request-id"));
    responseOk = response.ok;
    responseStatus = response.status;
    if (typeof responseOk !== "boolean") {
      throw new Error("invalid");
    }
  } catch {
    throw new Error("Deadline scan returned an invalid response.");
  }
  if (!responseOk) {
    const status = Number.isInteger(responseStatus)
      ? responseStatus
      : "unavailable";
    throw new Error(
      `Deadline scan failed with status ${status}; request ${requestId}.`,
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Deadline scan returned an invalid response.");
  }
  const scannedCount = safeCount(body?.scannedCount);
  const createdCount = safeCount(body?.createdCount);
  if (scannedCount === null || createdCount === null) {
    throw new Error("Deadline scan returned an invalid response.");
  }

  const receipt = { requestId, scannedCount, createdCount };
  log(JSON.stringify(receipt));
  return receipt;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  rejectNudgeArguments(process.argv.slice(2));
  await triggerDeadlineNudges();
}
