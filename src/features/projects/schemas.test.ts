import { describe, expect, it } from "vitest";

import { projectSchema } from "@/features/projects/schemas";

describe("projectSchema", () => {
  it("trims a valid name and description", () => {
    expect(
      projectSchema.parse({
        name: "  Product launch  ",
        description: "  Keep the release work visible.  ",
      }),
    ).toEqual({
      name: "Product launch",
      description: "Keep the release work visible.",
    });
  });

  it.each(["", "   ", null] as const)(
    "normalizes an empty description to null",
    (description) => {
      expect(projectSchema.parse({ name: "Launch", description })).toEqual({
        name: "Launch",
        description: null,
      });
    },
  );

  it("rejects empty and overlong names", () => {
    expect(
      projectSchema.safeParse({ name: " ", description: null }).success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ name: "x".repeat(141), description: null })
        .success,
    ).toBe(false);
  });
});
