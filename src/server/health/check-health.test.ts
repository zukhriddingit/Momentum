import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "./check-health";

describe("deployment health probe", () => {
  it("reports healthy without returning probe data", async () => {
    const probe = vi.fn().mockResolvedValue([{ one: 1 }]);
    await expect(checkHealth(probe)).resolves.toEqual({ ok: true });
    expect(probe).toHaveBeenCalledOnce();
  });

  it("reports degraded without returning the database error", async () => {
    const probe = vi
      .fn()
      .mockRejectedValue(
        new Error("postgresql://secret-user:secret-password@db.internal/app"),
      );
    await expect(checkHealth(probe)).resolves.toEqual({ ok: false });
  });
});
