import { describe, expect, it, vi } from "vitest";

import {
  copyResponseCookies,
  synchronizeRequestCookieHeader,
} from "./proxy-cookies";

describe("proxy cookie propagation", () => {
  it("synchronizes refreshed request cookies into downstream headers", () => {
    const headers = new Headers({ cookie: "sb-token=stale" });

    synchronizeRequestCookieHeader(headers, {
      toString: () => "sb-token=refreshed; theme=calm",
    });
    expect(headers.get("cookie")).toBe("sb-token=refreshed; theme=calm");

    synchronizeRequestCookieHeader(headers, { toString: () => "" });
    expect(headers.has("cookie")).toBe(false);
  });

  it("copies complete response cookie records to redirects", () => {
    const cookies = [
      {
        name: "sb-token",
        value: "refreshed",
        httpOnly: true,
        maxAge: 3600,
        path: "/",
        sameSite: "lax" as const,
        secure: true,
      },
      { name: "theme", value: "calm", path: "/dashboard" },
    ];
    const set = vi.fn();

    copyResponseCookies(cookies, set);

    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenNthCalledWith(1, cookies[0]);
    expect(set).toHaveBeenNthCalledWith(2, cookies[1]);
  });
});
