import { ReactNode } from "react";

interface AdminStatsGridProps {
  children: ReactNode;
}

export function AdminStatsGrid({
  children,
}: AdminStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}