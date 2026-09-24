"use client";

import { useEffect } from "react";
import { isChunkLoadError, attemptHardReload } from "@/components/common/ChunkErrorRecovery";
import { RotateCcw, AlertTriangle, ArrowLeft } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      console.warn("[AdminError] Stale deployment chunk detected, refreshing admin page...");
      attemptHardReload();
    }
  }, [error]);

  const handleReload = () => {
    if (isChunkLoadError(error)) {
      attemptHardReload();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-2xl border border-[#E6E6E6] bg-white p-8 shadow-sm max-w-md w-full">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#E31E24] mb-4">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-1.5">Admin Page Failed to Load</h2>
        <p className="text-[13px] text-[#6B6B6B] mb-6">
          {isChunkLoadError(error)
            ? "A newer version of the admin portal is deployed. Reloading page to fetch updated assets..."
            : error?.message || "An unexpected error occurred while loading this section."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors cursor-pointer"
          >
            <RotateCcw size={15} />
            Reload Page
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
