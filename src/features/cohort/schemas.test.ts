import { describe, expect, it } from "vitest";

import { addCohortSeatSchema } from "./schemas";

describe("addCohortSeatSchema", () => {
  it("normalizes a valid handle", () => {
    expect(
      addCohortSeatSchema.parse({
        workspaceId: crypto.randomUUID(),
        githubHandle: " KPerpignant ",
      }).githubHandle,
    ).toBe("kperpignant");
  });

  it("rejects invalid handles and workspace IDs", () => {
    expect(
      addCohortSeatSchema.safeParse({
        workspaceId: "wrong",
        githubHandle: "two--hyphens",
      }).success,
    ).toBe(false);
  });
});
