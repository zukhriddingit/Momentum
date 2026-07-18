import { type NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readApplicationOrigin } from "@/server/auth/application-origin";
import { extractVerifiedGitHubIdentity } from "@/server/auth/github-identity";
import { requestNow } from "@/server/clock";
import { claimCohortSeats } from "@/server/cohort/claim-cohort-seats";
import { logServerEvent } from "@/server/observability/logger";

function destination(path: string): URL {
  return new URL(path, readApplicationOrigin());
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(destination("/sign-in?authError=github-code"));
  }

  const supabase = await createServerSupabaseClient();
  try {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) {
      throw new Error("GitHub code exchange failed.");
    }

    const authenticated = await supabase.auth.getUser();
    if (authenticated.error || !authenticated.data.user) {
      throw new Error("GitHub user verification failed.");
    }

    const identity = extractVerifiedGitHubIdentity(
      authenticated.data.user.identities,
    );
    await claimCohortSeats({
      actorId: authenticated.data.user.id,
      identity,
      occurredAt: await requestNow(),
    });

    return NextResponse.redirect(destination("/dashboard"));
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      // Continue to the safe sign-in destination even if revocation is unavailable.
    }

    logServerEvent({
      level: "error",
      event: "github_oauth_failed",
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
      route: "/auth/callback",
      routeType: "route",
      code: "UNAUTHORIZED",
    });
    return NextResponse.redirect(
      destination("/sign-in?authError=github-claim"),
    );
  }
}
