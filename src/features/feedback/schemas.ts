import { z } from "zod";

import {
  countUnicodeCodePoints,
  FEEDBACK_CATEGORIES,
} from "@/server/feedback/types";

const FORBIDDEN_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const nullableUuid = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.uuid().nullable(),
);

const pageContext = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z
    .string()
    .trim()
    .min(1)
    .max(200)
    .startsWith("/")
    .refine((value) => !value.includes("?") && !value.includes("#"), {
      message: "Page context must not include a query or fragment.",
    })
    .nullable(),
);

export const feedbackSubmissionSchema = z
  .object({
    workspaceId: nullableUuid,
    pageContext,
    category: z.enum(FEEDBACK_CATEGORIES),
    rating: z.coerce.number().int().min(1).max(5),
    message: z
      .string()
      .trim()
      .refine((value) => countUnicodeCodePoints(value) >= 10, {
        message: "Share at least 10 characters.",
      })
      .refine((value) => countUnicodeCodePoints(value) <= 1000, {
        message: "Keep feedback to 1,000 characters.",
      })
      .refine((value) => !FORBIDDEN_CONTROL_CHARACTERS.test(value), {
        message: "Feedback contains unsupported characters.",
      }),
    idempotencyKey: z.uuid(),
  })
  .strict();
