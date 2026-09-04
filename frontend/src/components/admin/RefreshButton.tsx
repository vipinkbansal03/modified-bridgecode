"use client";

import { useEffect, useState, useCallback } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

export interface RefreshButtonProps {
  onRefresh: () => void | Promise<unknown>;
  isRefreshing?: boolean;
  className?: string;
  showTimeAgo?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RefreshButton({
  onRefresh,
  isRefreshing = false,
  className,
  showTimeAgo = true,
  size = "md",
}: RefreshButtonProps) {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState("Just now");
  const [localSpinning, setLocalSpinning] = useState(false);

  const activeRefreshing = Boolean(isRefreshing || localSpinning);

  const handleClick = useCallback(async () => {
    if (activeRefreshing) return;
    setLocalSpinning(true);
    const minSpinPromise = new Promise((resolve) => setTimeout(resolve, 650));

    try {
      const refreshResult = onRefresh();
      if (refreshResult instanceof Promise) {
        await Promise.all([refreshResult, minSpinPromise]);
      } else {
        await minSpinPromise;
      }
    } catch {
      await minSpinPromise;
    } finally {
      setLastRefreshedAt(new Date());
      setLocalSpinning(false);
    }
  }, [onRefresh, activeRefreshing]);

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

  const buttonSizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const iconSize = size === "sm" ? 13 : size === "lg" ? 16 : 14;

  return (
    <div className={cn("inline-flex flex-col items-center justify-center gap-0.5 min-w-[54px]", className)}>
      <Tooltip content={activeRefreshing ? "Refreshing list..." : "Refresh list"} side="top">
        <button
          type="button"
          onClick={handleClick}
          disabled={activeRefreshing}
          aria-label="Refresh list"
          className={cn(
            "flex items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F2F2F2] hover:border-[#D1D1D1] disabled:cursor-not-allowed transition-all outline-none shadow-xs group",
            buttonSizeClass,
            activeRefreshing && "border-red-200 bg-red-50/30"
          )}
        >
          <RotateCw
            size={iconSize}
            className={cn(
              "transition-all duration-300",
              activeRefreshing ? "animate-spin text-[#E31E24]" : "text-[#555] group-hover:text-[#1A1A1A] group-hover:rotate-45"
            )}
          />
        </button>
      </Tooltip>
      {showTimeAgo && (
        <span
          className={cn(
            "select-none text-[10px] font-medium leading-tight whitespace-nowrap transition-colors",
            activeRefreshing ? "text-[#E31E24] font-semibold animate-pulse" : "text-[#059669]"
          )}
        >
          {activeRefreshing ? "Updating…" : timeAgo}
        </span>
      )}
    </div>
  );
}

