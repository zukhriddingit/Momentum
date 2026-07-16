import { describe, expect, it } from "vitest";

import { workspaceSchema } from "@/features/workspaces/schemas";

describe("workspaceSchema", () => {
  it("trims a valid workspace name", () => {
    expect(workspaceSchema.parse({ name: "  Design Team  " })).toEqual({
      name: "Design Team",
    });
  });

  it.each(["", "   "])("rejects an empty workspace name", (name) => {
    expect(workspaceSchema.safeParse({ name }).success).toBe(false);
  });

  it("rejects a workspace name longer than 120 characters", () => {
    expect(workspaceSchema.safeParse({ name: "x".repeat(121) }).success).toBe(
      false,
    );
  });
});
