import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MotivationSettingsForm } from "@/features/settings/motivation-settings-form";
import { requireUser } from "@/server/auth/require-user";
import { getMotivationSettings } from "@/server/settings/get-motivation-settings";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getMotivationSettings({ actorId: user.id });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Motivation settings</CardTitle>
          <CardDescription>
            Shape how Momentum supports your work. These choices are personal
            and never change trusted point calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MotivationSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </main>
  );
}
