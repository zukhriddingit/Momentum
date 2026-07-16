import { z } from "zod";

import { normalizeIanaTimezone } from "@/domain/profiles/is-iana-timezone";

export const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(8, { error: "Enter your password." }),
});

export const signUpSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(12, { error: "Use at least 12 characters." }),
  displayName: z
    .string()
    .trim()
    .min(1, { error: "Enter a display name." })
    .max(80, { error: "Keep your display name to 80 characters or fewer." }),
  timezone: z.string().transform((value, context) => {
    const timezone = normalizeIanaTimezone(value);
    if (!timezone) {
      context.addIssue({
        code: "custom",
        message: "Choose a valid timezone.",
      });
      return z.NEVER;
    }

    return timezone;
  }),
});
