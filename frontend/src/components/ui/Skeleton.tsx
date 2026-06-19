import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block. Compose into card/grid skeletons (see SkeletonGrid below). */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-grey", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-md border border-line overflow-hidden">
      <Skeleton className="h-[190px] w-full rounded-none" />
      <div className="p-5 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4, columns = 4 }: { count?: number; columns?: number }) {
  return (
    <div className={`grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
