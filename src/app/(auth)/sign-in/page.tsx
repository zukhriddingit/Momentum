import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthErrorNotice } from "@/features/auth/auth-error-notice";
import { GitHubOAuthButton } from "@/features/auth/github-oauth-button";
import { SignInForm } from "@/features/auth/sign-in-form";
import {
  isLocalCredentialHintVisible,
  readRuntimeEnvironment,
} from "@/server/environment";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string | string[] }>;
}) {
  const { authError } = await searchParams;
  const authErrorCode =
    typeof authError === "string" ? authError : authError?.[0];
  const showLocalCredentials = isLocalCredentialHintVisible(
    readRuntimeEnvironment().name,
  );

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
            Make today count
          </h1>
          <p className="mt-2 text-slate-600">
            One clear focus, visible progress, and encouragement that meets you
            where you are.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Open the demo workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <AuthErrorNotice code={authErrorCode} />
            <GitHubOAuthButton />
            <div
              className="flex items-center gap-3 text-xs font-medium text-slate-500"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              <span>or continue with email</span>
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>
            <SignInForm />
          </CardContent>
        </Card>
        {showLocalCredentials ? (
          <p className="text-center text-xs text-slate-500">
            Seeded locally: demo@momentum.local / momentum-demo
          </p>
        ) : null}
        <p className="text-center text-sm text-slate-600">
          New to Momentum?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-violet-700 underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
