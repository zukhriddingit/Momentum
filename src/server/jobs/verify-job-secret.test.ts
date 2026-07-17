import { describe, expect, it } from "vitest";

import { verifyJobSecret } from "./verify-job-secret";

describe("deadline job authorization", () => {
  it("accepts only one exact bearer secret", () => {
    expect(verifyJobSecret("Bearer pilot-secret", "pilot-secret")).toBe(true);
    expect(verifyJobSecret("Bearer wrong", "pilot-secret")).toBe(false);
    expect(verifyJobSecret("Bearer pilot-secreu", "pilot-secret")).toBe(false);
    expect(verifyJobSecret("bearer pilot-secret", "pilot-secret")).toBe(false);
    expect(verifyJobSecret("Bearer pilot-secret extra", "pilot-secret")).toBe(
      false,
    );
    expect(verifyJobSecret(null, "pilot-secret")).toBe(false);
    expect(verifyJobSecret("Bearer pilot-secret", undefined)).toBe(false);
  });
});
