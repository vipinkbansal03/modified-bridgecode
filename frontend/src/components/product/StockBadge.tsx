type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER";

const STATUS_CONFIG: Record<StockStatus, { label: string; cls: string }> = {
  IN_STOCK: { label: "In Stock", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LOW_STOCK: { label: "Low Stock", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  OUT_OF_STOCK: { label: "Out of Stock", cls: "bg-[#F5F5F5] text-[#9A9A9A] border-[#E6E6E6]" },
  BACKORDER: { label: "Backorder", cls: "bg-sky-50 text-sky-600 border-sky-200" },
};

export function StockBadge({ status }: { status: StockStatus | null | undefined }) {
  if (!status) return <span className="text-[11px] text-[#9A9A9A]">—</span>;
  const { label, cls } = STATUS_CONFIG[status] ?? STATUS_CONFIG.OUT_OF_STOCK;
  return (
    <span className={`inline-block border rounded px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
