import { describe, expect, it } from "vitest";

import { serializeServerEvent } from "./logger";

describe("structured server logs", () => {
  it("serializes only the safe event contract", () => {
    const payload = JSON.parse(
      serializeServerEvent(
        {
          level: "info",
          event: "deadline_scan_completed",
          requestId: "request-1",
          route: "/api/jobs/deadline-nudges",
          method: "POST",
          status: 200,
          durationMs: 12,
          scannedCount: 3,
          createdCount: 1,
        },
        { name: "preview", release: "abc123" },
        new Date("2026-07-16T15:00:00.000Z"),
      ),
    );

    expect(payload).toEqual({
      timestamp: "2026-07-16T15:00:00.000Z",
      level: "info",
      event: "deadline_scan_completed",
      environment: "preview",
      release: "abc123",
      requestId: "request-1",
      route: "/api/jobs/deadline-nudges",
      method: "POST",
      status: 200,
      durationMs: 12,
      scannedCount: 3,
      createdCount: 1,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /authorization|email|password|message|stack|query/i,
    );
  });
});
