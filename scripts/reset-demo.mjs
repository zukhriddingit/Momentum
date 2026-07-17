import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { provisionDemo } from "./provision-demo.mjs";

const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/u;
const LINKED_PROJECT_REF_URL = new URL(
  "../supabase/.temp/project-ref",
  import.meta.url,
);

export function requireLinkedResetEnvironment(env) {
  const environment = env.MOMENTUM_ENVIRONMENT;
  if (!environment) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (environment === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  if (environment !== "preview") {
    throw new Error("Linked demo reset requires MOMENTUM_ENVIRONMENT=preview.");
  }

  const expectedRef = env.MOMENTUM_SUPABASE_PROJECT_REF;
  if (!expectedRef) {
    throw new Error("MOMENTUM_SUPABASE_PROJECT_REF is required.");
  }
  if (!PROJECT_REF_PATTERN.test(expectedRef)) {
    throw new Error("Supabase project reference is invalid.");
  }
  return expectedRef;
}

export function rejectResetArguments(args) {
  if (args.length > 0) {
    throw new Error("Demo reset does not accept command arguments.");
  }
}

async function readLinkedProjectRef() {
  try {
    return await readFile(LINKED_PROJECT_REF_URL, "utf8");
  } catch {
    throw new Error("Could not verify linked Supabase project.");
  }
}

async function requestResetConfirmation(expectedRef) {
  const prompt = createInterface({ input, output });
  try {
    return await prompt.question(`Type RESET ${expectedRef} to continue: `);
  } catch {
    throw new Error("Could not read demo reset confirmation.");
  } finally {
    prompt.close();
  }
}

export function executeLinkedReset(spawn = spawnSync) {
  try {
    const result = spawn(
      "pnpm",
      ["exec", "supabase", "db", "reset", "--linked", "--no-seed"],
      { stdio: "inherit", shell: false },
    );
    if (result.status !== 0) {
      throw new Error("reset failed");
    }
  } catch {
    throw new Error("Linked demo reset failed before provisioning.");
  }
}

export async function resetDemo({
  env = process.env,
  readLinkedRef = readLinkedProjectRef,
  askForConfirmation = requestResetConfirmation,
  runLinkedReset = executeLinkedReset,
  provision = provisionDemo,
  log = console.info,
} = {}) {
  const expectedRef = requireLinkedResetEnvironment(env);

  let linkedRef;
  try {
    linkedRef = (await readLinkedRef()).trim();
  } catch {
    throw new Error("Could not verify linked Supabase project.");
  }
  if (linkedRef !== expectedRef) {
    throw new Error(
      "Linked Supabase project does not match the confirmed demo project.",
    );
  }

  let confirmation;
  try {
    confirmation = await askForConfirmation(expectedRef);
  } catch {
    throw new Error("Could not read demo reset confirmation.");
  }
  if (confirmation !== `RESET ${expectedRef}`) {
    log("Demo reset cancelled; no database command ran.");
    return { status: "cancelled" };
  }

  try {
    await runLinkedReset();
  } catch {
    throw new Error("Linked demo reset failed before provisioning.");
  }
  try {
    await provision();
  } catch {
    throw new Error("Demo provisioning failed after linked reset.");
  }

  log(`Demo reset verified for project ${expectedRef}.`);
  return { status: "reset", projectRef: expectedRef };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  rejectResetArguments(process.argv.slice(2));
  await resetDemo();
}
