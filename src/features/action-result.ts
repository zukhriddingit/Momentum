import { AppError } from "@/server/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "CONFLICT"
        | "INTERNAL";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function actionFailure(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message };
  }

  console.error("Unexpected Momentum action failure", error);
  return {
    ok: false,
    code: "INTERNAL",
    message:
      "Something interrupted that update. Your saved work is still safe.",
  };
}
