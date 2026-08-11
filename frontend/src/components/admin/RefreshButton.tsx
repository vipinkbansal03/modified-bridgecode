"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/utils/cn";

interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  className?: string;
}

export function RefreshButton({ onRefresh, isRefreshing, className }: RefreshButtonProps) {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState("Just now");
  const [prevRefreshing, setPrevRefreshing] = useState(isRefreshing);

  // Update lastRefreshedAt when isRefreshing transitions from true to false
  if (isRefreshing !== prevRefreshing) {
    setPrevRefreshing(isRefreshing);
    if (!isRefreshing && prevRefreshing) {
      setLastRefreshedAt(new Date());
    }
  }

  useEffect(() => {
    const updateText = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastRefreshedAt.getTime();
      const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
      const diffMins = Math.floor(diffSecs / 60);

      if (diffSecs < 60) {
        setTimeAgo("Just now");
      } else if (diffMins <= 5) {
        setTimeAgo(`${diffMins}m ago`);
      } else {
        const timeStr = lastRefreshedAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setTimeAgo(timeStr);
      }
    };

    updateText();
    const interval = setInterval(updateText, 10000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  return (
    <div className={cn("inline-flex flex-col items-center justify-center gap-0.5 min-w-[54px]", className)}>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        title={`Refresh List (Last updated: ${timeAgo})`}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F2F2F2] hover:border-[#D1D1D1] disabled:cursor-not-allowed disabled:opacity-50 transition-all outline-none shadow-xs"
      >
        <RotateCw size={14} className={cn("transition-transform", isRefreshing && "animate-spin text-[#E31E24]")} />
      </button>
      <span
        className={cn(
          "select-none text-[10px] font-medium leading-tight whitespace-nowrap transition-colors",
          isRefreshing ? "text-[#E31E24] font-semibold animate-pulse" : "text-[#059669]"
        )}
      >
        {isRefreshing ? "Updating…" : timeAgo}
      </span>
    </div>
  );
}

