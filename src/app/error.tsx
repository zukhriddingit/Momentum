"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold">That step hit a snag</h1>
        <p className="mt-3 text-slate-600">
          Your saved work is still safe. Try this view again when you are ready.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-slate-500">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
