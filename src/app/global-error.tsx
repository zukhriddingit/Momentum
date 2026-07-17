"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-900">
        <main className="max-w-md text-center">
          <h1 className="text-3xl font-bold">Momentum needs a fresh start</h1>
          <p className="mt-3 text-slate-600">
            Your saved work has not been blamed or penalized.
          </p>
          <button
            className="mt-6 rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={reset}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
