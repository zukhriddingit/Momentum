import { describe, expect, it } from "vitest";

import {
  archiveProjectSchema,
  projectSchema,
} from "@/features/projects/schemas";

describe("archiveProjectSchema", () => {
  it("accepts only a UUID project ID", () => {
    const projectId = "30000000-0000-4000-8000-000000000001";
    expect(archiveProjectSchema.parse({ projectId })).toEqual({ projectId });
    expect(
      archiveProjectSchema.safeParse({ projectId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      archiveProjectSchema.safeParse({ projectId, archived: true }).success,
    ).toBe(false);
  });
});

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
