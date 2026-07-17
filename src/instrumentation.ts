import type { Instrumentation } from "next";

import { logServerEvent } from "@/server/observability/logger";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/server/observability/request-id";

export function register(): void {}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const requestId = resolveRequestId(
    Array.isArray(incoming) ? incoming[0] : incoming,
  );
  const digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;
  logServerEvent({
    level: "error",
    event: "request_failed",
    requestId,
    route: context.routePath,
    method: request.method,
    routeType: context.routeType,
    digest,
  });
};
