import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { requestNow } from "@/server/clock";
import { scanDeadlineNudges } from "@/server/notifications/scan-deadline-nudges";

function matchesSecret(value: string, expected: string): boolean {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.MOMENTUM_JOB_SECRET;
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!expected || !supplied || !matchesSecret(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const occurredAt = await requestNow();
  const receipt = await scanDeadlineNudges({ occurredAt });
  return NextResponse.json(receipt);
}
