"use client";

import { MapPin, ChevronRight } from "lucide-react";

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
      className="group flex w-full items-center gap-4 rounded-xl border border-[#E6E6E6] bg-white p-4.5 text-left transition-all duration-300 hover:border-brand/40 hover:bg-red-50/20 hover:shadow-md hover:shadow-red-500/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand ring-4 ring-brand/5 transition-colors group-hover:bg-brand/10">
        <MapPin
          size={22}
          className="text-brand transition-transform duration-300 group-hover:scale-110"
        />
      </div>

      <div className="flex-1">
        <h4 className="text-[15px] font-bold text-ink transition-colors group-hover:text-brand">
          Use My Current Location
        </h4>

        <p className="mt-1 text-[13px] leading-5 text-steel">
          Detect your current location automatically to estimate delivery.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-1.5 rounded-full bg-brand/5 px-3 py-1 text-[12px] font-semibold text-brand animate-pulse">
          Detecting...
        </div>
      ) : (
        <ChevronRight size={16} className="text-steel opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
      )}
    </button>
  );
}