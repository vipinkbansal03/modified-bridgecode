import type { ReactNode, ElementType } from "react";
import { cn } from "@/utils/cn";

interface ContainerProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

/** Centered max-width wrapper (1480px max for balanced margins on wide screens). */
export function Container({ as: Tag = "div", children, className }: ContainerProps) {
  return <Tag className={cn("mx-auto w-full max-w-[1480px] px-4 sm:px-6 md:px-8 lg:px-10", className)}>{children}</Tag>;
}
