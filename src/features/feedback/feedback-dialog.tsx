"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  submitFeedbackAction,
  type FeedbackActionState,
} from "@/features/feedback/actions";
import {
  clearFeedbackDraft,
  feedbackDraftStorageKey,
  readFeedbackDraft,
  runWithFeedbackDraftProtection,
  type UncertainFeedbackDraft,
} from "@/features/feedback/draft-persistence";

function sanitizedPageContext(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return "/";
  }

  return pathname.split(/[?#]/, 1)[0]?.slice(0, 200) || "/";
}

function workspaceFromPath(pathname: string): string {
  const match = pathname.match(
    /^\/workspaces\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i,
  );
  return match?.[1] ?? "";
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  return errors?.[0] ? (
    <p id={id} className="text-sm text-rose-700">
      {errors[0]}
    </p>
  ) : null;
}

function failureReference(state: FeedbackActionState): string | null {
  if (
    !state ||
    state.ok ||
    !("reference" in state) ||
    typeof state.reference !== "string"
  ) {
    return null;
  }

  return state.reference;
}

type TransportState = "idle" | "pending" | "uncertain";

function FeedbackForm({
  pageContext,
  idempotencyKey,
  transportState,
  storageKey,
  lockedDraft,
  onSubmissionPending,
  onTransportUncertain,
  onDefinitiveFailure,
  onConfirmedSuccess,
  onDiscard,
}: {
  pageContext: string;
  idempotencyKey: string;
  transportState: TransportState;
  storageKey: string;
  lockedDraft: UncertainFeedbackDraft | null;
  onSubmissionPending: (draft: UncertainFeedbackDraft | null) => void;
  onTransportUncertain: (draft: UncertainFeedbackDraft | null) => void;
  onDefinitiveFailure: () => void;
  onConfirmedSuccess: () => void;
  onDiscard: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const handleAction = useCallback(
    async (
      previousState: FeedbackActionState,
      formData: FormData,
    ): Promise<FeedbackActionState> => {
      const outcome = await runWithFeedbackDraftProtection({
        storage: window.sessionStorage,
        storageKey,
        formData,
        onPrepared: onSubmissionPending,
        submit: () => submitFeedbackAction(previousState, formData),
      });

      if (outcome.status === "uncertain") {
        onTransportUncertain(outcome.draft);
        return {
          ok: false,
          code: "INTERNAL",
          message:
            "We couldn't confirm whether your feedback was saved. Keep this dialog open and retry; your draft is still here.",
        };
      }

      if (outcome.result?.ok) {
        formRef.current?.reset();
        onConfirmedSuccess();
      } else {
        onDefinitiveFailure();
      }
      return outcome.result;
    },
    [
      onDefinitiveFailure,
      onConfirmedSuccess,
      onSubmissionPending,
      onTransportUncertain,
      storageKey,
    ],
  );
  const [state, action, pending] = useActionState<
    FeedbackActionState,
    FormData
  >(handleAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const reference = failureReference(state);
  const draftLocked = transportState === "uncertain" && lockedDraft !== null;
  const formWorkspaceId = lockedDraft
    ? (lockedDraft.workspaceId ?? "")
    : workspaceFromPath(pageContext);
  const formPageContext = lockedDraft
    ? (lockedDraft.pageContext ?? "")
    : pageContext;

  return (
    <form
      action={action}
      ref={formRef}
      className="mt-5 space-y-4"
      aria-busy={pending}
      data-testid="feedback-form"
    >
      <input type="hidden" name="workspaceId" value={formWorkspaceId} />
      <input type="hidden" name="pageContext" value={formPageContext} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="space-y-2">
        <Label htmlFor="feedback-category">
          What kind of feedback is this?
        </Label>
        <Select
          id="feedback-category"
          name={draftLocked ? undefined : "category"}
          defaultValue={lockedDraft?.category ?? "confusing"}
          disabled={pending || draftLocked}
          aria-invalid={fieldErrors?.category ? true : undefined}
          aria-describedby={
            fieldErrors?.category ? "feedback-category-error" : undefined
          }
        >
          <option value="bug">Bug</option>
          <option value="confusing">Something is confusing</option>
          <option value="motivation_feedback">Motivation experience</option>
          <option value="feature_request">Feature request</option>
          <option value="other">Other</option>
        </Select>
        {draftLocked ? (
          <input type="hidden" name="category" value={lockedDraft.category} />
        ) : null}
        <FieldError
          id="feedback-category-error"
          errors={fieldErrors?.category}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-rating">Overall experience</Label>
        <Select
          id="feedback-rating"
          name={draftLocked ? undefined : "rating"}
          defaultValue={lockedDraft?.rating ?? 4}
          disabled={pending || draftLocked}
          aria-invalid={fieldErrors?.rating ? true : undefined}
          aria-describedby={
            fieldErrors?.rating ? "feedback-rating-error" : undefined
          }
        >
          <option value="1">1 — Needs attention</option>
          <option value="2">2</option>
          <option value="3">3 — Okay</option>
          <option value="4">4</option>
          <option value="5">5 — Great</option>
        </Select>
        {draftLocked ? (
          <input type="hidden" name="rating" value={lockedDraft.rating} />
        ) : null}
        <FieldError id="feedback-rating-error" errors={fieldErrors?.rating} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-message">What would help?</Label>
        <textarea
          id="feedback-message"
          name="message"
          defaultValue={lockedDraft?.message ?? ""}
          required
          disabled={pending}
          readOnly={draftLocked}
          aria-invalid={fieldErrors?.message ? true : undefined}
          aria-describedby={`feedback-message-help${
            fieldErrors?.message ? " feedback-message-error" : ""
          }`}
          className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm read-only:bg-slate-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none disabled:opacity-50"
        />
        <p id="feedback-message-help" className="text-xs text-slate-500">
          10–1,000 characters. Page context: {formPageContext || "/"}
        </p>
        <FieldError id="feedback-message-error" errors={fieldErrors?.message} />
      </div>
      {transportState === "uncertain" ? (
        <p
          role="alert"
          data-testid="feedback-transport-uncertain"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          We couldn&apos;t confirm whether your feedback was saved. Retry sends
          this exact draft with the same retry key, or discard it to start over.
        </p>
      ) : state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
              : "rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          }
        >
          {state.ok ? "Thanks — your feedback is saved." : state.message}
          {!state.ok && reference ? ` Reference: ${reference}` : ""}
        </p>
      ) : null}
      <div className="space-y-2">
        <Button className="w-full" type="submit" disabled={pending}>
          {pending
            ? "Sending feedback…"
            : transportState === "uncertain"
              ? "Retry feedback"
              : "Send feedback"}
        </Button>
        {transportState === "uncertain" ? (
          <Button
            className="w-full"
            type="button"
            variant="ghost"
            onClick={onDiscard}
            data-testid="feedback-discard"
          >
            Discard draft and close
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function FeedbackDialog({ userId }: { userId: string }) {
  const pathname = usePathname();
  const pageContext = sanitizedPageContext(pathname);
  const storageKey = feedbackDraftStorageKey(userId);
  const closeBlockedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [transportState, setTransportState] = useState<TransportState>("idle");
  const [uncertainDraft, setUncertainDraft] =
    useState<UncertainFeedbackDraft | null>(null);
  const closeBlocked = transportState !== "idle";

  useEffect(() => {
    const restoredDraft = readFeedbackDraft(window.sessionStorage, storageKey);
    if (!restoredDraft) {
      return;
    }

    let active = true;
    queueMicrotask(() => {
      if (!active) {
        return;
      }
      closeBlockedRef.current = true;
      setUncertainDraft(restoredDraft);
      setIdempotencyKey(restoredDraft.idempotencyKey);
      setTransportState("uncertain");
      setFormSession((session) => session + 1);
      setOpen(true);
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!closeBlocked) {
      return;
    }

    function protectDraftFromReload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", protectDraftFromReload);
    return () =>
      window.removeEventListener("beforeunload", protectDraftFromReload);
  }, [closeBlocked]);

  const handleSubmissionPending = useCallback(
    (draft: UncertainFeedbackDraft | null) => {
      closeBlockedRef.current = true;
      setUncertainDraft(draft);
      setTransportState("pending");
    },
    [],
  );

  const handleTransportUncertain = useCallback(
    (draft: UncertainFeedbackDraft | null) => {
      closeBlockedRef.current = true;
      setUncertainDraft(draft);
      setTransportState("uncertain");
      setFormSession((session) => session + 1);
    },
    [],
  );

  const handleDefinitiveFailure = useCallback(() => {
    closeBlockedRef.current = false;
    setUncertainDraft(null);
    setTransportState("idle");
  }, []);

  const handleConfirmedSuccess = useCallback(() => {
    closeBlockedRef.current = false;
    setUncertainDraft(null);
    setTransportState("idle");
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const resetFeedbackSession = useCallback(() => {
    closeBlockedRef.current = false;
    setUncertainDraft(null);
    setTransportState("idle");
    setIdempotencyKey(crypto.randomUUID());
    setFormSession((session) => session + 1);
  }, []);

  const discardUncertainDraft = useCallback(() => {
    clearFeedbackDraft(window.sessionStorage, storageKey);
    closeBlockedRef.current = false;
    setUncertainDraft(null);
    setTransportState("idle");
    setIdempotencyKey(crypto.randomUUID());
    setFormSession((session) => session + 1);
    setOpen(false);
  }, [storageKey]);

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) {
      if (closeBlockedRef.current) {
        return;
      }
      setOpen(false);
      resetFeedbackSession();
      return;
    }

    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
    setOpen(true);
  }

  function protectBlockedClose(event: Event): void {
    if (closeBlockedRef.current) {
      event.preventDefault();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Feedback"
          data-testid="feedback-trigger"
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            Feedback
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`max-h-[calc(100vh-2rem)] overflow-y-auto ${
          closeBlocked ? "[&>button]:hidden" : ""
        }`}
        data-testid="feedback-dialog"
        data-transport-state={transportState}
        onEscapeKeyDown={protectBlockedClose}
        onPointerDownOutside={protectBlockedClose}
        onInteractOutside={protectBlockedClose}
      >
        <DialogHeader>
          <DialogTitle>Help shape Momentum</DialogTitle>
          <DialogDescription>
            Share what helped or what made the next step harder to see.
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm
          key={formSession}
          pageContext={pageContext}
          idempotencyKey={idempotencyKey}
          transportState={transportState}
          storageKey={storageKey}
          lockedDraft={uncertainDraft}
          onSubmissionPending={handleSubmissionPending}
          onTransportUncertain={handleTransportUncertain}
          onDefinitiveFailure={handleDefinitiveFailure}
          onConfirmedSuccess={handleConfirmedSuccess}
          onDiscard={discardUncertainDraft}
        />
      </DialogContent>
    </Dialog>
  );
}
