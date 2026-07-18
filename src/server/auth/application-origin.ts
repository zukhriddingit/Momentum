import "server-only";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function readApplicationOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env.NEXT_PUBLIC_APP_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_APP_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be an absolute URL.");
  }

  const isLoopbackHttp =
    url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !isLoopbackHttp) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must use HTTPS outside local development.",
    );
  }

  return url.origin;
}
