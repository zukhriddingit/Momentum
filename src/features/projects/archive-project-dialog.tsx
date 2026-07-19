"use client";

import { useActionState, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  archiveProjectAction,
  type ArchiveProjectActionState,
} from "@/features/projects/actions";

export function ArchiveProjectDialog({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const handleAction = useCallback(
    async (previousState: ArchiveProjectActionState, formData: FormData) => {
      const result = await archiveProjectAction(previousState, formData);
      if (result?.ok) {
        setOpen(false);
        router.push(`/workspaces/${workspaceId}?projectArchived=1`);
        router.refresh();
      }
      return result;
    },
    [router, workspaceId],
  );
  const [state, formAction, pending] = useActionState<
    ArchiveProjectActionState,
    FormData
  >(handleAction, null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) {
          setOpen(nextOpen);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Archive project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this project?</DialogTitle>
          <DialogDescription>
            It will leave active project views, while its tasks, points, and
            completion history stay preserved.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="mt-6 space-y-5">
          <input type="hidden" name="projectId" value={projectId} />

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
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Archiving…" : "Archive project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
