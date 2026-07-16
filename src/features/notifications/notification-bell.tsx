"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import { NotificationIcon } from "@/features/notifications/notification-icon";
import type {
  NotificationItem,
  NotificationSummary,
} from "@/server/notifications/types";

function notificationHref(item: NotificationItem): string | null {
  if (!item.destination) {
    return null;
  }

  return `/workspaces/${item.destination.workspaceId}/projects/${
    item.destination.projectId
  }${item.destination.taskId ? `#task-${item.destination.taskId}` : ""}`;
}

export function NotificationBell({
  summary,
}: {
  summary: NotificationSummary;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: summary.timezone,
  });

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndRestoreFocus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        closeAndRestoreFocus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeAndRestoreFocus, open]);

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
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="relative grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
        aria-expanded={open}
        aria-controls="notification-preview"
        aria-label={`Notifications, ${summary.unreadCount} unread`}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-5" aria-hidden="true" />
        {summary.unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {Math.min(summary.unreadCount, 99)}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          id="notification-preview"
          className="fixed top-20 right-4 left-4 z-40 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-[calc(100%+0.75rem)] sm:right-0 sm:left-auto sm:w-96"
          aria-label="Recent notifications"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="font-semibold text-slate-950">Notifications</p>
              <p className="text-xs text-slate-500">
                {summary.unreadCount} unread
              </p>
            </div>
            {summary.unreadCount > 0 ? (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none disabled:opacity-50"
                disabled={pending}
                onClick={markAll}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {error ? (
            <p
              className="m-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {summary.recent.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {summary.recent.map((item) => {
                const href = notificationHref(item);
                return (
                  <li
                    key={item.id}
                    className={item.readAt ? "p-4" : "bg-violet-50/50 p-4"}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-violet-700">
                        <NotificationIcon eventType={item.eventType} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {href ? (
                          <Link
                            href={href}
                            className="text-sm font-semibold text-slate-950 hover:text-violet-700 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                            onClick={() => setOpen(false)}
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-slate-950">
                            {item.title}
                          </p>
                        )}
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatter.format(new Date(item.createdAt))}
                        </p>
                        {item.readAt === null ? (
                          <button
                            type="button"
                            className="mt-2 rounded text-xs font-semibold text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none disabled:opacity-50"
                            disabled={pending}
                            onClick={() => markOne(item.id)}
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-slate-600">
              No notifications yet. Supportive updates will appear here.
            </p>
          )}

          <div className="border-t border-slate-200 p-3">
            <Link
              href="/notifications"
              className="block rounded-lg px-3 py-2 text-center text-sm font-semibold text-violet-700 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
