import { describe, expect, it, vi } from "vitest";

import { resolveRequestId } from "./request-id";

describe("request IDs", () => {
  it("preserves a bounded safe incoming identifier", () => {
    expect(resolveRequestId("pilot-123:abc", vi.fn())).toBe("pilot-123:abc");
  });

  it("replaces missing, oversized, whitespace, and control values", () => {
    const create = vi.fn(() => "generated-id");
    expect(resolveRequestId(null, create)).toBe("generated-id");
    expect(resolveRequestId("a".repeat(65), create)).toBe("generated-id");
    expect(resolveRequestId("unsafe value", create)).toBe("generated-id");
    expect(resolveRequestId("unsafe\nvalue", create)).toBe("generated-id");
    expect(create).toHaveBeenCalledTimes(4);
  });
});
