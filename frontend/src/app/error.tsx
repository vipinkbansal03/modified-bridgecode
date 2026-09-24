"use client";

import { useEffect } from "react";
import { isChunkLoadError, attemptHardReload } from "@/components/common/ChunkErrorRecovery";
import { RotateCcw, AlertTriangle } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      console.warn("[RootError] Stale deployment chunk detected, refreshing page...");
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-red-50 p-4 text-[#E31E24] mb-4">
        <AlertTriangle size={36} />
      </div>
      <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Something went wrong</h2>
      <p className="text-sm text-[#6B6B6B] max-w-md mb-6">
        {isChunkLoadError(error)
          ? "A new version of the application is available. Reloading to get the latest updates..."
          : error?.message || "An unexpected error occurred while loading this page."}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReload}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors"
        >
          <RotateCcw size={16} />
          Reload Page
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-[#E6E6E6] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
