import "server-only";

import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function database(): ReturnType<typeof postgres> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for server-side database access.",
    );
  }

  client ??= postgres(connectionString, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 5,
  });

  return client;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
  }
}
