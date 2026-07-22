import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface SectionHeadingProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

/** Section title row with a bottom hairline and optional right-aligned action (controls, link, tabs). */
export function SectionHeading({ title, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6 border-b border-line pb-4 mb-6", className)}>
      <h2 className="text-[clamp(28px,3.4vw,40px)] font-light text-ink">{title}</h2>
      {action}
    </div>
  );
}
