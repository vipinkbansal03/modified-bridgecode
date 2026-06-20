"use client";

import type { ApiVariant, ApiProductPrice } from "@/types/api.types";
import { StockBadge } from "./StockBadge";
import { QuantityInput } from "./QuantityInput";

interface Props {
  variants: ApiVariant[];
  productTitle: string;
  quantityMap: Record<string, number>;
  priceMap: Record<string, ApiProductPrice | null>;
  onQtyChange: (variantId: string, qty: number) => void;
}

export function BulkOrderFlat({ variants, productTitle, quantityMap, priceMap, onQtyChange }: Props) {
  return (
    <div className="space-y-2.5">
      {variants.map((v) => {
        const price = priceMap[v.id];
        const outOfStock = v.inventory?.status === "OUT_OF_STOCK";
        const qty = quantityMap[v.id] ?? 0;
        const label = v.title === productTitle ? (Object.values(v.attributeCombination)[0] ?? v.title) : v.title;

        return (
          <div
            key={v.id}
            className={`flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors ${
              qty > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#E6E6E6] bg-white"
            } ${outOfStock ? "opacity-55" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-ink truncate">{label}</p>
              {v.sku && <p className="mt-0.5 font-mono text-[11px] text-[#B0B0B0]">{v.sku}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StockBadge status={v.inventory?.status} />
              <div className="text-right">
                {price ? (
                  <p className="text-[14px] font-semibold text-ink">
                    {price.currencySymbol}
                    {price.sellingPrice.toLocaleString("en-IN")}
                  </p>
                ) : (
                  <p className="text-[12px] text-[#9A9A9A]">Contact for pricing</p>
                )}
              </div>
              <QuantityInput
                value={qty}
                onChange={(val) => onQtyChange(v.id, val)}
                min={0}
                max={v.inventory?.available}
                disabled={outOfStock}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
