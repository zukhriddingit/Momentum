import { AppError } from "@/server/errors";
import { logServerEvent } from "@/server/observability/logger";

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
      reference?: string;
    };

export function actionFailure(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message };
  }

  const reference = crypto.randomUUID();
  logServerEvent({
    level: "error",
    event: "server_action_failed",
    requestId: reference,
    routeType: "action",
    code: "INTERNAL",
  });
  return {
    ok: false,
    code: "INTERNAL",
    message:
      "Something interrupted that update. Your saved work is still safe.",
    reference,
  };
}
