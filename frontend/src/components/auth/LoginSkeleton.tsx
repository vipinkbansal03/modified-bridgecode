import { Skeleton } from "@/components/ui/Skeleton";

interface LoginSkeletonProps {
  showHero?: boolean;
}

export default function LoginSkeleton({ showHero }: LoginSkeletonProps) {
  return (
    <main
      className={
        showHero
          ? "grid min-h-svh grid-cols-1 overflow-hidden bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]"
          : "flex min-h-svh items-center justify-center bg-[#F7F7F7] px-5 py-8"
      }
    >
      {/* Left Hero Skeleton */}
      {showHero && (
        <section className="relative block min-h-svh bg-[#F5F5F5]">
          <div className="absolute bottom-12 left-10 space-y-4">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-5 w-60" />
          </div>
        </section>
      )}

      {/* Right Section */}
      <section
        className={
          showHero
            ? "relative flex min-h-svh w-full items-center justify-center bg-white px-5 py-8 sm:px-10"
            : "relative flex flex-1 items-center justify-center"
        }
      >
        {/* Back Button */}
        <Skeleton className="absolute left-10 top-8 h-10 w-24 rounded-md" />

        <div
          className={
            showHero
              ? "w-full max-w-[430px]"
              : "w-full max-w-[460px] rounded-2xl border border-[#E8E8E8] bg-white p-8 shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
          }
        >
          {/* Heading */}
          <div className="mb-8">
            <Skeleton className="h-10 w-60" />
            <Skeleton className="mt-3 h-4 w-48" />
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Email */}
            <div>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-[50px] w-full rounded-md" />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>

              <Skeleton className="h-[50px] w-full rounded-md" />
            </div>

            {/* Checkbox */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-44" />
            </div>

            {/* Button */}
            <Skeleton className="h-12 w-full rounded-md" />
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-center">
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </section>
    </main>
  );
}
