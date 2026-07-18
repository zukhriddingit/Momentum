"use client";

import { GitPullRequest, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import {
  addCohortSeatAction,
  type AddCohortSeatState,
} from "@/features/cohort/actions";
import type { CohortDirectoryView } from "@/server/cohort/types";

const MAX_RESULTS = 8;

export function AddCohortMemberDialog({
  workspaceId,
  directory,
}: {
  workspaceId: string;
  directory: CohortDirectoryView;
}) {
  const router = useRouter();
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const resultsId = `${inputId}-results`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const handleAction = useCallback(
    async (previousState: AddCohortSeatState, formData: FormData) => {
      const result = await addCohortSeatAction(previousState, formData);
      if (result?.ok) {
        setAnnouncement(
          `@${result.data.githubHandle} is ready for assignments.`,
        );
        setOpen(false);
        setQuery("");
        router.refresh();
      }
      return result;
    },
    [router],
  );
  const [state, formAction, pending] = useActionState<
    AddCohortSeatState,
    FormData
  >(handleAction, null);
  const normalizedQuery = normalizeGitHubHandle(query);
  const normalizedSearch = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return directory.entries.slice(0, MAX_RESULTS);
    }

    return directory.entries
      .filter(
        (entry) =>
          entry.githubHandle.includes(normalizedSearch) ||
          entry.displayName?.toLowerCase().includes(normalizedSearch),
      )
      .slice(0, MAX_RESULTS);
  }, [directory.entries, normalizedSearch]);
  const hasExactDirectoryMatch =
    normalizedQuery !== null &&
    directory.entries.some((entry) => entry.githubHandle === normalizedQuery);
  const handleErrors =
    state && !state.ok ? state.fieldErrors?.githubHandle : undefined;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <UserPlus className="size-4" aria-hidden="true" />
            Add cohort member
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a cohort member</DialogTitle>
            <DialogDescription>
              Find a Hult participant by name or GitHub username. Momentum will
              verify exact usernames before adding them.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="mt-6 space-y-5">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <div className="space-y-2">
              <Label htmlFor={inputId}>Name or GitHub username</Label>
              <Input
                id={inputId}
                name="githubHandle"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="kperpignant"
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                aria-describedby={`${helpId} ${resultsId}${handleErrors ? ` ${errorId}` : ""}`}
                aria-invalid={handleErrors ? true : undefined}
              />
              <p id={helpId} className="text-xs leading-5 text-slate-500">
                Select a directory result, or enter an exact GitHub username.
              </p>
              {handleErrors?.[0] ? (
                <p id={errorId} className="text-sm text-rose-700">
                  {handleErrors[0]}
                </p>
              ) : null}
            </div>

            <div className="space-y-2" aria-label="Cohort directory results">
              <p
                id={resultsId}
                className="text-xs font-semibold text-slate-500"
                role="status"
                aria-live="polite"
              >
                {matches.length === 1
                  ? "1 directory match"
                  : `${matches.length} directory matches`}
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {matches.map((entry) => (
                  <button
                    key={entry.githubUserId}
                    type="button"
                    onClick={() => setQuery(entry.githubHandle)}
                    disabled={pending}
                    aria-pressed={normalizedQuery === entry.githubHandle}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none disabled:opacity-50 aria-pressed:border-violet-400 aria-pressed:bg-violet-50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
                      <GitPullRequest className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {entry.displayName ?? `@${entry.githubHandle}`}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        @{entry.githubHandle}
                      </span>
                    </span>
                  </button>
                ))}
                {matches.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm leading-5 text-slate-600">
                    No synced directory match yet. You can still verify an exact
                    GitHub username below.
                  </p>
                ) : null}
              </div>
            </div>

            {normalizedQuery && !hasExactDirectoryMatch ? (
              <button
                type="button"
                onClick={() => setQuery(normalizedQuery)}
                disabled={pending}
                className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-3 text-left text-sm text-violet-900 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none disabled:opacity-50"
              >
                Verify exact GitHub username
                <span className="ml-1 font-bold">@{normalizedQuery}</span>
              </button>
            ) : null}

            {state && !state.ok ? (
              <p
                className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
                role="alert"
                aria-live="polite"
              >
                {state.message}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !normalizedQuery}>
                {pending
                  ? "Verifying GitHub…"
                  : normalizedQuery
                    ? `Verify and add @${normalizedQuery}`
                    : "Enter a GitHub username"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
