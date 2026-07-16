"use client";

import { Award, Flame, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { CompletionCelebrationView } from "@/server/types";

export function CelebrationDialog({
  celebration,
}: {
  celebration: CompletionCelebrationView;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function dismiss() {
    router.replace(pathname);
  }

  return (
    <Dialog defaultOpen onOpenChange={(open) => !open && dismiss()}>
      <DialogContent data-testid="completion-celebration">
        <DialogHeader>
          <Badge className="w-fit bg-violet-100 text-violet-800">
            <Sparkles className="mr-1 size-3" aria-hidden="true" />
            Focus complete
          </Badge>
          <DialogTitle>
            {celebration.points.finalPoints} points earned
          </DialogTitle>
          <DialogDescription>{celebration.message.body}</DialogDescription>
        </DialogHeader>

        <div className="my-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xl font-bold">{celebration.points.basePoints}</p>
            <p className="text-xs text-slate-500">Base</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xl font-bold">
              +{celebration.points.timingBonus}
            </p>
            <p className="text-xs text-slate-500">Early</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xl font-bold">
              +{celebration.points.streakBonus}
            </p>
            <p className="text-xs text-slate-500">Streak</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-violet-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 font-semibold text-violet-950">
              <Flame className="size-5" aria-hidden="true" />
              Focus Streak
            </p>
            <p className="font-bold text-violet-950">
              {celebration.preCompletionStreak} →{" "}
              {celebration.postCompletionStreak}
            </p>
          </div>
          {celebration.achievement ? (
            <p className="flex items-center gap-2 text-sm font-medium text-violet-900">
              <Award className="size-5" aria-hidden="true" />
              Achievement unlocked: {celebration.achievement}
            </p>
          ) : null}
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Project progress</span>
            <span>{celebration.projectProgress.percentComplete}%</span>
          </div>
          <Progress
            value={celebration.projectProgress.percentComplete}
            label="Updated project progress"
          />
        </div>

        <Button className="mt-6 w-full" size="lg" onClick={dismiss}>
          Keep the momentum going
        </Button>
      </DialogContent>
    </Dialog>
  );
}
