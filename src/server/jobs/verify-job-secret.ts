import { timingSafeEqual } from "node:crypto";

export function verifyJobSecret(
  authorization: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const supplied = authorization.slice("Bearer ".length);
  if (!supplied || supplied.includes(" ")) {
    return false;
  }
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}
