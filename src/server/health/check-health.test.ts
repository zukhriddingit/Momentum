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

  it("reports degraded when a probe does not settle before the deadline", async () => {
    const probe = vi.fn(() => new Promise<never>(() => undefined));
    await expect(checkHealth(probe, 5)).resolves.toEqual({ ok: false });
    expect(probe).toHaveBeenCalledOnce();
  });
});
