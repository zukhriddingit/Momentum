import { NextResponse } from "next/server";

import { readRuntimeEnvironment } from "@/server/environment";
import { checkHealth } from "@/server/health/check-health";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/server/observability/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const environment = readRuntimeEnvironment();
  const health = await checkHealth();
  const response = NextResponse.json(
    {
      status: health.ok ? "ok" : "degraded",
      environment: environment.name,
      release: environment.release,
      requestId,
    },
    { status: health.ok ? 200 : 503 },
  );
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
