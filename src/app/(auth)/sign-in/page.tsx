import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/features/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
            <Sparkles className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold tracking-[0.24em] text-violet-700 uppercase">
            Momentum
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Make today count
          </h1>
          <p className="mt-2 text-slate-600">
            One clear focus, visible progress, and encouragement that meets you
            where you are.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Open the demo workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-500">
          Seeded locally: demo@momentum.local / momentum-demo
        </p>
      </div>
    </main>
  );
}
