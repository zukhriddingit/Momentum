export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function resolveRequestId(
  value: string | null | undefined,
  create: () => string = crypto.randomUUID,
): string {
  return value && REQUEST_ID_PATTERN.test(value) ? value : create();
}
