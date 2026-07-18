import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthErrorNotice } from "@/features/auth/auth-error-notice";
import { GitHubOAuthButton } from "@/features/auth/github-oauth-button";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string | string[] }>;
}) {
  const { authError } = await searchParams;
  const authErrorCode =
    typeof authError === "string" ? authError : authError?.[0];

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
            <Sparkles className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold tracking-[0.24em] text-violet-700 uppercase">
            Momentum
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Start with one clear focus
          </h1>
          <p className="mt-2 text-slate-600">
            Create your profile, then shape a workspace around the work that
            matters today.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <AuthErrorNotice code={authErrorCode} />
            <GitHubOAuthButton />
            <div
              className="flex items-center gap-3 text-xs font-medium text-slate-500"
              role="separator"
              aria-label="or continue with email"
            >
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              <span>or continue with email</span>
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>
            <SignUpForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-violet-700 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
