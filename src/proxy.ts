import { NextResponse, type NextRequest } from "next/server";

import { updateSupabaseSession } from "@/lib/supabase/proxy";
import { copyResponseCookies } from "@/server/auth/proxy-cookies";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/server/observability/request-id";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const finish = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };

  if (pathname === "/api/health" || pathname === "/api/jobs/deadline-nudges") {
    return finish(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const { response, user } = await updateSupabaseSession(
    request,
    requestHeaders,
  );
  const redirect = (destination: URL) => {
    const redirectResponse = NextResponse.redirect(destination);
    copyResponseCookies(response.cookies.getAll(), (cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return finish(redirectResponse);
  };
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const isPublic = pathname === "/" || isAuthPage;

  if (!user && !isPublic) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/sign-in";
    destination.searchParams.set("next", pathname);
    return redirect(destination);
  }
  if (user && isAuthPage) {
    return redirect(new URL("/dashboard", request.url));
  }
  return finish(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
