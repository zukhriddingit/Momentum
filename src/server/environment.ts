export const MOMENTUM_ENVIRONMENTS = [
  "local",
  "test",
  "preview",
  "production",
] as const;

export type MomentumEnvironment = (typeof MOMENTUM_ENVIRONMENTS)[number];

export interface RuntimeEnvironment {
  name: MomentumEnvironment;
  release: string | null;
}

const RELEASE_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

function isMomentumEnvironment(
  value: string | undefined,
): value is MomentumEnvironment {
  return MOMENTUM_ENVIRONMENTS.some((candidate) => candidate === value);
}

function runtimeName(env: Partial<NodeJS.ProcessEnv>): MomentumEnvironment {
  if (env.MOMENTUM_ENVIRONMENT !== undefined) {
    if (!isMomentumEnvironment(env.MOMENTUM_ENVIRONMENT)) {
      throw new Error("MOMENTUM_ENVIRONMENT is not recognized.");
    }
    return env.MOMENTUM_ENVIRONMENT;
  }
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    return env.VERCEL_ENV;
  }
  if (env.NODE_ENV === "test") {
    return "test";
  }
  return "local";
}

function safeRelease(env: Partial<NodeJS.ProcessEnv>): string | null {
  const candidate = env.MOMENTUM_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA;
  return candidate && RELEASE_PATTERN.test(candidate) ? candidate : null;
}

export function readRuntimeEnvironment(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): RuntimeEnvironment {
  return { name: runtimeName(env), release: safeRelease(env) };
}

export function requireDemoOperatorEnvironment(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): "local" | "test" | "preview" {
  const explicit = env.MOMENTUM_ENVIRONMENT;
  if (!explicit) {
    throw new Error("MOMENTUM_ENVIRONMENT is required for demo operations.");
  }
  if (!isMomentumEnvironment(explicit)) {
    throw new Error("MOMENTUM_ENVIRONMENT is not recognized.");
  }
  if (explicit === "production") {
    throw new Error("Demo operations are forbidden in production.");
  }
  return explicit;
}

export function isLocalCredentialHintVisible(
  environment: MomentumEnvironment,
): boolean {
  return environment === "local" || environment === "test";
}
