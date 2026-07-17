import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <main
      className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"
      aria-label="Loading Momentum"
      aria-busy="true"
    >
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-72" />
    </main>
  );
}
