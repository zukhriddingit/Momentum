import { describe, expect, it } from "vitest";

import { readApplicationOrigin } from "./application-origin";

describe("readApplicationOrigin", () => {
  it("returns only the trusted origin", () => {
    expect(
      readApplicationOrigin({
        NODE_ENV: "test",
        NEXT_PUBLIC_APP_URL: "https://momentum.example/path?q=1#section",
      }),
    ).toBe("https://momentum.example");
  });

  it.each([
    "http://localhost:3000/path",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("allows HTTP for a loopback development URL: %s", (value) => {
    expect(
      readApplicationOrigin({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: value }),
    ).toBe(new URL(value).origin);
  });

  it("requires HTTPS outside local development", () => {
    expect(() =>
      readApplicationOrigin({
        NODE_ENV: "test",
        NEXT_PUBLIC_APP_URL: "http://momentum.example",
      }),
    ).toThrow("NEXT_PUBLIC_APP_URL must use HTTPS outside local development.");
  });

  it("requires an explicit application URL", () => {
    expect(() => readApplicationOrigin({ NODE_ENV: "test" })).toThrow(
      "NEXT_PUBLIC_APP_URL is required.",
    );
  });

  it.each(["momentum.example", "not a URL", "ftp://momentum.example"])(
    "rejects an invalid application URL: %s",
    (value) => {
      expect(() =>
        readApplicationOrigin({
          NODE_ENV: "test",
          NEXT_PUBLIC_APP_URL: value,
        }),
      ).toThrow();
    },
  );
});
