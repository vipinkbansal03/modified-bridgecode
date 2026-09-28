"use client";

import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER";

const STATUS_CONFIG: Record<StockStatus, { key: "ui.stock.inStock" | "ui.stock.lowStock" | "ui.stock.outOfStock" | "ui.stock.backorder"; fallback: string; cls: string }> = {
  IN_STOCK: { key: "ui.stock.inStock", fallback: "In Stock", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LOW_STOCK: { key: "ui.stock.lowStock", fallback: "Low Stock", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  OUT_OF_STOCK: { key: "ui.stock.outOfStock", fallback: "Out of Stock", cls: "bg-[#F5F5F5] text-[#9A9A9A] border-[#E6E6E6]" },
  BACKORDER: { key: "ui.stock.backorder", fallback: "Backorder", cls: "bg-sky-50 text-sky-600 border-sky-200" },
};

export function StockBadge({
  status,
  available,
  className = "",
}: {
  status: StockStatus | null | undefined;
  available?: number;
  className?: string;
}) {
  const { t } = useStaticTranslations();

  const effectiveStatus =
    available !== undefined && available <= 0
      ? "OUT_OF_STOCK"
      : status ?? "OUT_OF_STOCK";

  if (!status && available === undefined)
    return <span className={`text-[11px] text-[#9A9A9A] ${className}`}>—</span>;

  const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.OUT_OF_STOCK;
  const label = t(config.key) || config.fallback;

  return (
    <span className={`inline-block border rounded px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide ${config.cls} ${className}`}>
      {label}
    </span>
  );
}
