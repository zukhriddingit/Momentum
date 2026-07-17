import {
  readRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/server/environment";

export interface SafeServerEvent {
  level: "info" | "error";
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  routeType?: "render" | "route" | "action" | "proxy";
  status?: number;
  durationMs?: number;
  code?: string;
  digest?: string;
  scannedCount?: number;
  createdCount?: number;
  processedCount?: number;
}

function optional<T>(value: T | undefined): T | undefined {
  return value;
}

export function serializeServerEvent(
  input: SafeServerEvent,
  environment: RuntimeEnvironment = readRuntimeEnvironment(),
  now = new Date(),
): string {
  return JSON.stringify({
    timestamp: now.toISOString(),
    level: input.level,
    event: input.event,
    environment: environment.name,
    release: environment.release ?? undefined,
    requestId: optional(input.requestId),
    route: optional(input.route),
    method: optional(input.method),
    routeType: optional(input.routeType),
    status: optional(input.status),
    durationMs: optional(input.durationMs),
    code: optional(input.code),
    digest: optional(input.digest),
    scannedCount: optional(input.scannedCount),
    createdCount: optional(input.createdCount),
    processedCount: optional(input.processedCount),
  });
}

export function logServerEvent(input: SafeServerEvent): void {
  const serialized = serializeServerEvent(input);
  if (input.level === "error") {
    console.error(serialized);
    return;
  }
  console.info(serialized);
}
