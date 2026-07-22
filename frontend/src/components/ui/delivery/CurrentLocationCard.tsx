"use client";

import { MapPin } from "lucide-react";

interface CurrentLocationCardProps {
  onClick: () => void;
  loading?: boolean;
}

export function CurrentLocationCard({
  onClick,
  loading = false,
}: CurrentLocationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-start gap-4 rounded-lg border border-line p-4 text-left transition-colors hover:border-brand hover:bg-grey disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10">
        <MapPin
          size={20}
          className="text-brand"
        />
      </div>

      <div className="flex-1">
        <h4 className="text-[15px] font-semibold text-ink">
          Use My Current Location
        </h4>

        <p className="mt-1 text-[13px] leading-5 text-steel">
          Detect your current location automatically to estimate delivery.
        </p>
      </div>

      {loading && (
        <span className="text-[12px] text-steel">
          Detecting...
        </span>
      )}
    </button>
  );
}