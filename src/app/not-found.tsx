import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-violet-700">Momentum</p>
        <h1 className="mt-2 text-3xl font-bold">That page is not available</h1>
        <p className="mt-3 text-slate-600">
          It may have moved, or it may not be part of your workspace.
        </p>
        <Link
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          href="/dashboard"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
