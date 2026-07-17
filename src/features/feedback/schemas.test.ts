import { describe, expect, it } from "vitest";

import { feedbackSubmissionSchema } from "./schemas";

const valid = {
  workspaceId: "20000000-0000-4000-8000-000000000001",
  pageContext: "/workspaces/20000000-0000-4000-8000-000000000001",
  category: "confusing",
  rating: "4",
  message: "  The focus action could be clearer.  ",
  idempotencyKey: "90000000-0000-4000-8000-000000000001",
};

describe("feedback submission schema", () => {
  it("normalizes a valid submission", () => {
    expect(feedbackSubmissionSchema.parse(valid)).toEqual({
      ...valid,
      rating: 4,
      message: "The focus action could be clearer.",
    });
  });

  it("rejects five emoji as fewer than ten Unicode code points", () => {
    const result = feedbackSubmissionSchema.safeParse({
      ...valid,
      message: "🚀".repeat(5),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "message"),
      ).toBe(true);
    }
  });

  it("accepts ten emoji as ten Unicode code points", () => {
    const message = "🚀".repeat(10);

    expect(feedbackSubmissionSchema.parse({ ...valid, message }).message).toBe(
      message,
    );
  });

  it.each([
    [{ ...valid, rating: "0" }, "rating"],
    [{ ...valid, rating: "6" }, "rating"],
    [{ ...valid, message: "too short" }, "message"],
    [{ ...valid, message: "safe text\u0007unsafe" }, "message"],
    [{ ...valid, pageContext: "/dashboard?secret=value" }, "pageContext"],
    [{ ...valid, pageContext: "https://example.com/dashboard" }, "pageContext"],
    [{ ...valid, category: "performance_review" }, "category"],
  ])("rejects invalid external input for %s", (input, field) => {
    const result = feedbackSubmissionSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(
        true,
      );
    }
  });
});
