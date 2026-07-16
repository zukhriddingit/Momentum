import { notFound } from "next/navigation";

import { NotificationList } from "@/features/notifications/notification-list";
import { requireUser } from "@/server/auth/require-user";
import { decodeNotificationCursor } from "@/server/notifications/cursor";
import { listNotifications } from "@/server/notifications/list-notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const cursor = query.cursor;
  if (Array.isArray(cursor)) {
    notFound();
  }
  if (cursor) {
    try {
      decodeNotificationCursor(cursor);
    } catch {
      notFound();
    }
  }

  const page = await listNotifications({
    actorId: user.id,
    cursor: cursor ?? null,
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold text-violet-700">Your updates</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Notifications
        </h1>
        <p className="mt-3 text-slate-600">
          Completion celebrations and supportive deadline reminders stay here so
          you can return to them when it helps.
        </p>
      </div>
      <NotificationList
        items={page.items}
        nextCursor={page.nextCursor}
        timezone={page.timezone}
      />
    </main>
  );
}
