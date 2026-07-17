interface SerializableCookies {
  toString(): string;
}

export function synchronizeRequestCookieHeader(
  headers: Headers,
  cookies: SerializableCookies,
): void {
  const serialized = cookies.toString();
  if (serialized) {
    headers.set("cookie", serialized);
    return;
  }
  headers.delete("cookie");
}

export function copyResponseCookies<Cookie>(
  cookies: readonly Cookie[],
  setCookie: (cookie: Cookie) => unknown,
): void {
  cookies.forEach((cookie) => setCookie(cookie));
}
