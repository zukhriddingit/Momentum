import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppError } from "@/server/errors";

export async function requireUser(): Promise<{
  id: string;
  email: string | null;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppError("UNAUTHORIZED", "Please sign in to continue.");
  }

  return { id: user.id, email: user.email ?? null };
}
