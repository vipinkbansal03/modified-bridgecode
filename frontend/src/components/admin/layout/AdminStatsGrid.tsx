"use client";

import { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { StatCard } from "../AdminComponents";

export interface StatItem {
  title?: string;
  value?: React.ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  isLoading?: boolean;
  customCard?: ReactNode;
}

export interface AdminStatsGridProps {
  stats: StatItem[];
  isLoading?: boolean;
}

export function AdminStatsGrid({ stats, isLoading }: AdminStatsGridProps) {
  if (!stats || stats.length === 0) return null;

  const cols = stats.length;
  const gridColsClass =
    cols === 1 ? "grid-cols-1" :
    cols === 2 ? "grid-cols-1 sm:grid-cols-2" :
    cols === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
    cols === 5 ? "grid-cols-2 gap-4 lg:grid-cols-5" :
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"; // default for 4 or more

  return (
    <div className={cn("mb-5 grid gap-4", gridColsClass)}>
      {stats.map((stat, index) => {
        if (stat.customCard) {
          return <div key={index}>{stat.customCard}</div>;
        }
        return (
          <StatCard
            key={index}
            title={stat.title ?? ""}
            value={stat.value ?? ""}
            subtitle={stat.subtitle}
            icon={stat.icon ?? ""}
            color={stat.color}
            isLoading={stat.isLoading ?? isLoading}
          />
        );
      })}
    </div>
  );
}
