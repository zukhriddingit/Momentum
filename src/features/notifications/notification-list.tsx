"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import { NotificationIcon } from "@/features/notifications/notification-icon";
import type { NotificationItem } from "@/server/notifications/types";

function notificationHref(item: NotificationItem): string | null {
  if (!item.destination) {
    return null;
  }

  return `/workspaces/${item.destination.workspaceId}/projects/${
    item.destination.projectId
  }${item.destination.taskId ? `#task-${item.destination.taskId}` : ""}`;
}

export function NotificationList({
  items,
  nextCursor,
  timezone,
}: {
  items: NotificationItem[];
  nextCursor: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  function markOne(notificationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await markNotificationReadAction({ notificationId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function markAll() {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Times are shown in {timezone}.</p>
        {items.some((item) => item.readAt === null) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={markAll}
          >
            Mark all as read
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((item) => {
            const href = notificationHref(item);
            return (
              <li
                key={item.id}
                className={item.readAt ? "p-5" : "bg-violet-50/60 p-5"}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                    <NotificationIcon eventType={item.eventType} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    {href ? (
                      <Link
                        href={href}
                        className="font-semibold text-slate-950 hover:text-violet-700 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-slate-950">
                        {item.title}
                      </p>
                    )}
                    <p className="text-sm leading-6 text-slate-600">
                      {item.body}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatter.format(new Date(item.createdAt))}
                    </p>
                  </div>
                  {item.readAt === null ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => markOne(item.id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">No notifications yet</p>
          <p className="mt-2 text-sm text-slate-600">
            Supportive updates about your work will appear here.
          </p>
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={`/notifications?cursor=${encodeURIComponent(nextCursor)}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            View older notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
