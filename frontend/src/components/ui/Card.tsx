import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

/** Generic bordered card shell reused by category, product, blog and testimonial cards. */
export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-line bg-white overflow-hidden transition-shadow duration-200",
        hover && "hover:shadow-[0_12px_24px_-14px_rgba(0,0,0,0.18)]",
        className
      )}
    >
      {children}
    </div>
  );
}
