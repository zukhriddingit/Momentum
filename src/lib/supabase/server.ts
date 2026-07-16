import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function publicSupabaseEnvironment(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Local Supabase URL and publishable key are required.");
  }

  return { url, key };
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, key } = publicSupabaseEnvironment();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The proxy refreshes them.
        }
      },
    },
  });
}
