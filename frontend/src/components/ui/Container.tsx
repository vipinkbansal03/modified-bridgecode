import type { ReactNode, ElementType } from "react";
import { cn } from "@/utils/cn";

interface ContainerProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

/** Centered max-width wrapper matching the original `.wrap` (1320px, 40px gutters). */
export function Container({ as: Tag = "div", children, className }: ContainerProps) {
  return <Tag className={cn("mx-auto max-w-wrap px-5 sm:px-10", className)}>{children}</Tag>;
}
