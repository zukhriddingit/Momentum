const AUTH_ERRORS = {
  "github-start": "GitHub sign-in could not start. Please try again.",
  "github-code": "GitHub did not return a usable sign-in. Please try again.",
  "github-claim":
    "We signed you in, but could not connect your pending work yet. Please try GitHub again.",
} as const;

export function getAuthErrorMessage(code?: string): string | null {
  return code && Object.hasOwn(AUTH_ERRORS, code)
    ? AUTH_ERRORS[code as keyof typeof AUTH_ERRORS]
    : null;
}

export function AuthErrorNotice({ code }: { code?: string }) {
  const message = getAuthErrorMessage(code);

  return message ? (
    <p
      className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  ) : null;
}
