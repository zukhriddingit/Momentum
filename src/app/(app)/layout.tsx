import { Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/features/auth/sign-out-button";
import { WorkspaceSwitcher } from "@/features/workspaces/workspace-switcher";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/errors";
import { listWorkspaceNavigation } from "@/server/workspaces/list-workspace-navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") {
      redirect("/sign-in");
    }
    throw error;
  }
  const navigation = await listWorkspaceNavigation({ actorId: user.id });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg font-bold focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-violet-600 text-white">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            Momentum
          </Link>
          <div className="order-3 w-full lg:order-none lg:mx-4 lg:w-auto lg:flex-1">
            <WorkspaceSwitcher navigation={navigation} />
          </div>
          <nav
            className="ml-auto flex items-center gap-2"
            aria-label="Primary navigation"
          >
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              Dashboard
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
