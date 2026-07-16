import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { requireUser } from "@/server/auth/require-user";
import { listWorkspaceNavigation } from "@/server/workspaces/list-workspace-navigation";

export default async function OnboardingPage() {
  const user = await requireUser();
  const navigation = await listWorkspaceNavigation({ actorId: user.id });

  if (
    navigation.workspaces.some((workspace) => workspace.projects.length > 0)
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-[0.18em] text-violet-700 uppercase">
          A clear place to begin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Set up your team&apos;s momentum
        </h1>
        <p className="mt-3 text-slate-600">
          Start with one workspace and one project. You can build from there
          when the work calls for it.
        </p>
      </div>
      <OnboardingFlow navigation={navigation} />
    </main>
  );
}
