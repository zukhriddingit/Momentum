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

const EVENT_BADGE_CLASS = {
  task_completed: "bg-slate-100 text-slate-800",
  completed_early: "bg-emerald-100 text-emerald-800",
  focus_task_completed: "bg-blue-100 text-blue-800",
  streak_extended: "bg-amber-100 text-amber-900",
  achievement_unlocked: "bg-violet-100 text-violet-800",
  deadline_approaching: "bg-amber-100 text-amber-900",
  overdue_recovery: "bg-blue-100 text-blue-800",
} as const;

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
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto"
        data-testid="completion-celebration"
        data-message-event={celebration.message.event}
        data-message-tone={celebration.message.tone}
        data-animate={
          celebration.celebrationAnimationEnabled ? "enabled" : "disabled"
        }
      >
        <div
          className="absolute top-5 right-14 flex gap-1 text-violet-300"
          data-completion-decoration
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
          <Sparkles className="mt-3 size-3" />
        </div>

        <DialogHeader>
          <Badge
            className={`w-fit ${EVENT_BADGE_CLASS[celebration.message.event]}`}
          >
            <Sparkles className="mr-1 size-3" aria-hidden="true" />
            {celebration.message.title}
          </Badge>
          <p className="text-sm font-medium text-slate-600">
            Completed: {celebration.taskTitle}
          </p>
          <DialogTitle>
            {celebration.points.finalPoints} points earned
          </DialogTitle>
          <DialogDescription>{celebration.message.body}</DialogDescription>
        </DialogHeader>

        <div className="my-6 grid grid-cols-3 gap-2 text-center sm:gap-3">
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

        {celebration.streakIncremented ||
        celebration.achievements.length > 0 ? (
          <div className="space-y-4 rounded-2xl bg-violet-50 p-4">
            {celebration.streakIncremented ? (
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
            ) : null}

            {celebration.achievements.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-violet-700 uppercase">
                  Achievements unlocked
                </p>
                {celebration.achievements.map((achievement) => (
                  <div
                    className="flex items-start gap-2 rounded-xl bg-white/75 p-3 text-violet-950"
                    key={achievement.code}
                  >
                    <Award
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {achievement.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-violet-800">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

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
