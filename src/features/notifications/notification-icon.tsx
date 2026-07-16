import {
  Award,
  BellRing,
  CircleCheck,
  Clock3,
  Flame,
  RotateCcw,
} from "lucide-react";

import type { NotificationEventType } from "@/server/notifications/types";

export function NotificationIcon({
  eventType,
}: {
  eventType: NotificationEventType;
}) {
  const className = "size-4";

  switch (eventType) {
    case "task_completed":
    case "focus_task_completed":
      return <CircleCheck className={className} aria-hidden="true" />;
    case "achievement_unlocked":
      return <Award className={className} aria-hidden="true" />;
    case "streak_extended":
      return <Flame className={className} aria-hidden="true" />;
    case "deadline_approaching":
      return <Clock3 className={className} aria-hidden="true" />;
    case "overdue_recovery":
      return <RotateCcw className={className} aria-hidden="true" />;
    default:
      return <BellRing className={className} aria-hidden="true" />;
  }
}
