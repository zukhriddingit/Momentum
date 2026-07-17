import { NextResponse } from "next/server";

import { requestNow } from "@/server/clock";
import { verifyJobSecret } from "@/server/jobs/verify-job-secret";
import { scanDeadlineNudges } from "@/server/notifications/scan-deadline-nudges";
import { logServerEvent } from "@/server/observability/logger";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/server/observability/request-id";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  if (
    !verifyJobSecret(
      request.headers.get("authorization"),
      process.env.MOMENTUM_JOB_SECRET,
    )
  ) {
    logServerEvent({
      level: "info",
      event: "deadline_scan_rejected",
      requestId,
      route: "/api/jobs/deadline-nudges",
      method: "POST",
      status: 401,
      durationMs: Math.round(performance.now() - startedAt),
    });
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  logServerEvent({
    level: "info",
    event: "deadline_scan_started",
    requestId,
    route: "/api/jobs/deadline-nudges",
    method: "POST",
  });

  try {
    const occurredAt = await requestNow(
      request.headers.get("x-momentum-test-now"),
    );
    const receipt = await scanDeadlineNudges({ occurredAt });
    logServerEvent({
      level: "info",
      event: "deadline_scan_completed",
      requestId,
      route: "/api/jobs/deadline-nudges",
      method: "POST",
      status: 200,
      durationMs: Math.round(performance.now() - startedAt),
      scannedCount: receipt.scannedCount,
      createdCount: receipt.createdCount,
    });
    const response = NextResponse.json(receipt);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch {
    logServerEvent({
      level: "error",
      event: "deadline_scan_failed",
      requestId,
      route: "/api/jobs/deadline-nudges",
      method: "POST",
      status: 500,
      durationMs: Math.round(performance.now() - startedAt),
    });
    const response = NextResponse.json(
      { error: "Deadline scan failed." },
      { status: 500 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
