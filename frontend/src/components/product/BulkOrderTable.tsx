"use client";

import type { ApiVariant, ApiProductPrice } from "@/types/api.types";
import { StockBadge } from "./StockBadge";
import { QuantityInput } from "./QuantityInput";

interface Props {
  variants: ApiVariant[];
  quantityMap: Record<string, number>;
  priceMap: Record<string, ApiProductPrice | null>;
  onQtyChange: (variantId: string, qty: number) => void;
}

export function BulkOrderTable({ variants, quantityMap, priceMap, onQtyChange }: Props) {
  const attrKeys = variants.length ? Object.keys(variants[0].attributeCombination) : [];

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E6E6E6] text-left text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
              {attrKeys.map((k) => (
                <th key={k} className="pb-2.5 pr-4">
                  {k}
                </th>
              ))}
              <th className="pb-2.5 pr-4">SKU</th>
              <th className="pb-2.5 pr-4 text-right">Unit Price</th>
              <th className="pb-2.5 pr-4">Stock</th>
              <th className="pb-2.5">Qty</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const price = priceMap[v.id];
              const outOfStock = v.inventory?.status === "OUT_OF_STOCK";
              const qty = quantityMap[v.id] ?? 0;
              return (
                <tr
                  key={v.id}
                  className={`border-b border-[#F5F5F5] ${outOfStock ? "opacity-55" : ""} ${
                    qty > 0 ? "bg-[#FFFBFB]" : ""
                  }`}
                >
                  {attrKeys.map((k) => (
                    <td key={k} className="py-3 pr-4 font-medium text-ink">
                      {v.attributeCombination[k] ?? "—"}
                    </td>
                  ))}
                  <td className="py-3 pr-4 font-mono text-[11.5px] text-[#9A9A9A]">{v.sku ?? "—"}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-ink">
                    {price ? (
                      <>
                        {price.currencySymbol}
                        {price.sellingPrice.toLocaleString("en-IN")}
                        {price.mrp > price.sellingPrice && (
                          <span className="ml-1.5 text-[11px] text-[#9A9A9A] line-through">
                            {price.mrp.toLocaleString("en-IN")}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11.5px] text-[#9A9A9A]">Contact for pricing</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StockBadge status={v.inventory?.status} />
                  </td>
                  <td className="py-3">
                    <QuantityInput
                      value={qty}
                      onChange={(val) => onQtyChange(v.id, val)}
                      min={0}
                      max={v.inventory?.available}
                      disabled={outOfStock}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {variants.map((v) => {
          const price = priceMap[v.id];
          const outOfStock = v.inventory?.status === "OUT_OF_STOCK";
          const qty = quantityMap[v.id] ?? 0;
          return (
            <div
              key={v.id}
              className={`rounded-lg border p-3.5 ${
                qty > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#E6E6E6] bg-white"
              } ${outOfStock ? "opacity-55" : ""}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{v.title}</p>
                  {Object.entries(v.attributeCombination).map(([k, val]) => (
                    <p key={k} className="text-[11.5px] text-[#9A9A9A]">
                      {k}: {val}
                    </p>
                  ))}
                  {v.sku && <p className="mt-0.5 font-mono text-[11px] text-[#B0B0B0]">{v.sku}</p>}
                </div>
                <StockBadge status={v.inventory?.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-ink">
                  {price ? (
                    <>
                      {price.currencySymbol}
                      {price.sellingPrice.toLocaleString("en-IN")}
                    </>
                  ) : (
                    <span className="text-[12px] text-[#9A9A9A]">Contact for pricing</span>
                  )}
                </span>
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
    </>
  );
}
