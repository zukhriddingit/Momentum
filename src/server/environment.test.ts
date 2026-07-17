import { describe, expect, it } from "vitest";

import {
  isLocalCredentialHintVisible,
  readRuntimeEnvironment,
  requireDemoOperatorEnvironment,
} from "./environment";

describe("Momentum environment classification", () => {
  it("uses an explicit Momentum environment and sanitizes releases", () => {
    expect(
      readRuntimeEnvironment({
        MOMENTUM_ENVIRONMENT: "preview",
        MOMENTUM_RELEASE: "slice-4.abc_123",
      }),
    ).toEqual({ name: "preview", release: "slice-4.abc_123" });
    expect(
      readRuntimeEnvironment({
        MOMENTUM_ENVIRONMENT: "production",
        MOMENTUM_RELEASE: "unsafe release value",
      }),
    ).toEqual({ name: "production", release: null });
  });

  it("uses Vercel scope, test mode, then local as safe runtime fallbacks", () => {
    expect(readRuntimeEnvironment({ VERCEL_ENV: "preview" }).name).toBe(
      "preview",
    );
    expect(readRuntimeEnvironment({ NODE_ENV: "test" }).name).toBe("test");
    expect(readRuntimeEnvironment({}).name).toBe("local");
  });

  it("refuses production and missing classifications for demo operators", () => {
    expect(
      requireDemoOperatorEnvironment({ MOMENTUM_ENVIRONMENT: "preview" }),
    ).toBe("preview");
    expect(() =>
      requireDemoOperatorEnvironment({ MOMENTUM_ENVIRONMENT: "production" }),
    ).toThrow("Demo operations are forbidden in production.");
    expect(() => requireDemoOperatorEnvironment({})).toThrow(
      "MOMENTUM_ENVIRONMENT is required for demo operations.",
    );
  });

  it("shows committed seed credentials only in local and test", () => {
    expect(isLocalCredentialHintVisible("local")).toBe(true);
    expect(isLocalCredentialHintVisible("test")).toBe(true);
    expect(isLocalCredentialHintVisible("preview")).toBe(false);
    expect(isLocalCredentialHintVisible("production")).toBe(false);
  });
});
