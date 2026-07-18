"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { actionFailure, type ActionResult } from "@/features/action-result";
import { signInSchema, signUpSchema } from "@/features/auth/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readApplicationOrigin } from "@/server/auth/application-origin";
import { ensureProfile } from "@/server/profiles/ensure-profile";

export type SignInState = ActionResult<null> | null;
export type SignUpState = ActionResult<null> | null;

export async function startGitHubOAuthAction(): Promise<never> {
  let redirectTo: string;
  try {
    redirectTo = `${readApplicationOrigin()}/auth/callback`;
  } catch {
    redirect("/sign-in?authError=github-start");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo,
      scopes: "read:user user:email",
    },
  });

  if (error || !data.url) {
    redirect("/sign-in?authError=github-start");
  }
  redirect(data.url);
}

export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check your email and password, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Those sign-in details did not match. Check them and try again.",
    };
  }

  redirect("/dashboard");
}

export async function signUpAction(
  _previousState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Check the highlighted details, then try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        timezone: parsed.data.timezone,
      },
    },
  });

  if (error || !data.user) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message:
        "We could not create that account. Check your details or try another email.",
    };
  }

  try {
    await ensureProfile({
      actorId: data.user.id,
      displayName: parsed.data.displayName,
      timezone: parsed.data.timezone,
    });
  } catch (error) {
    return actionFailure(error);
  }

  redirect("/onboarding");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
