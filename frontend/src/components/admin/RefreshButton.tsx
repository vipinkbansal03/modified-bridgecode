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
  const [timeAgo, setTimeAgo] = useState("Updated just now");
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
        setTimeAgo("Updated just now");
      } else if (diffMins <= 5) {
        setTimeAgo(`Updated ${diffMins} min${diffMins > 1 ? "s" : ""} ago`);
      } else {
        const timeStr = lastRefreshedAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setTimeAgo(`Last refreshed: ${timeStr}`);
      }
    };

    updateText();
    const interval = setInterval(updateText, 10000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  return (
    <div className={cn("flex items-center gap-2.5 text-[13px] text-[#6B6B6B]", className)}>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Refresh List"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F2F2F2] disabled:cursor-not-allowed disabled:opacity-50 transition-colors outline-none"
      >
        <RotateCw size={14} className={cn(isRefreshing && "animate-spin text-[#E31E24]")} />
      </button>
      <span className="select-none font-medium leading-none">{timeAgo}</span>
    </div>
  );
}
