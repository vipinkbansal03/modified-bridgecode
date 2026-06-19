import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "brand";
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-semibold",
        tone === "brand" ? "border-brand text-brand bg-white" : "border-line text-ink bg-grey",
        className
      )}
    >
      {children}
    </span>
  );
}
