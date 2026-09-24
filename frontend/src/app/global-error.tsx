"use client";

import { useEffect } from "react";
import { isChunkLoadError, attemptHardReload } from "@/components/common/ChunkErrorRecovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      console.warn("[GlobalError] Stale deployment chunk detected, refreshing page...");
      attemptHardReload();
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-gray-50 font-sans">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Error</h2>
          <p className="text-sm text-gray-600 mb-6">
            {isChunkLoadError(error)
              ? "A new update is available. Reloading the application..."
              : "An unexpected error occurred. Please reload the page."}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#E31E24] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#B5151B] transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
