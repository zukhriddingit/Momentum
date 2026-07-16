import { DashboardCards } from "@/features/dashboard/dashboard-cards";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/require-user";
import { requestNow } from "@/server/clock";
import { getDashboard } from "@/server/dashboard/get-dashboard";

export default async function DashboardPage() {
  const [user, occurredAt] = await Promise.all([requireUser(), requestNow()]);
  const dashboard = await getDashboard({ actorId: user.id, occurredAt });

  if (!dashboard.hasWorkspace) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold text-violet-700">
          Today&apos;s momentum
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back, {dashboard.user.displayName}
        </h1>
        <p className="mt-3 text-slate-600">
          {dashboard.focusTask
            ? `Your focus is “${dashboard.focusTask.title}.” Keep the next step small and clear.`
            : "Choose one Focus Task when you are ready. A day without one simply pauses your streak."}
        </p>
      </div>
      <DashboardCards dashboard={dashboard} />
    </main>
  );
}
