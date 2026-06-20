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

/** Groups variants into { [size]: { upper?: ApiVariant; lower?: ApiVariant } } */
function buildMatrix(variants: ApiVariant[]) {
  const matrix: Record<string, { upper?: ApiVariant; lower?: ApiVariant }> = {};
  for (const v of variants) {
    const size = v.attributeCombination["Size"] ?? v.attributeCombination["Width"] ?? Object.values(v.attributeCombination).find((_, i) => Object.keys(v.attributeCombination)[i].toLowerCase() !== "arch") ?? "—";
    const arch = (v.attributeCombination["Arch"] ?? "").toLowerCase();
    if (!matrix[size]) matrix[size] = {};
    if (arch.includes("upper") || arch.includes("u")) matrix[size].upper = v;
    else if (arch.includes("lower") || arch.includes("l")) matrix[size].lower = v;
    else matrix[size].upper = v; // fallback: treat non-arch as single row
  }
  return matrix;
}

function PriceCell({ price }: { price: ApiProductPrice | null }) {
  if (!price) return <span className="text-[11.5px] text-[#9A9A9A]">—</span>;
  return (
    <span className="text-[13px] font-semibold text-ink">
      {price.currencySymbol}
      {price.sellingPrice.toLocaleString("en-IN")}
    </span>
  );
}

export function BulkOrderMatrix({ variants, quantityMap, priceMap, onQtyChange }: Props) {
  const matrix = buildMatrix(variants);
  const sizes = Object.keys(matrix);
  const hasArch = variants.some((v) => "Arch" in v.attributeCombination);

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E6E6E6] text-left text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
              <th className="pb-2.5 pr-4">Size</th>
              {hasArch ? (
                <>
                  <th className="pb-2.5 pr-4 text-center">Upper Price</th>
                  <th className="pb-2.5 pr-4 text-center">Upper Qty</th>
                  <th className="pb-2.5 pr-4 text-center">Lower Price</th>
                  <th className="pb-2.5 text-center">Lower Qty</th>
                </>
              ) : (
                <>
                  <th className="pb-2.5 pr-4 text-right">Unit Price</th>
                  <th className="pb-2.5 pr-4">Stock</th>
                  <th className="pb-2.5">Qty</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => {
              const { upper, lower } = matrix[size];
              const upperQty = upper ? (quantityMap[upper.id] ?? 0) : 0;
              const lowerQty = lower ? (quantityMap[lower.id] ?? 0) : 0;
              const rowActive = upperQty > 0 || lowerQty > 0;

              if (!hasArch && upper) {
                const outOfStock = upper.inventory?.status === "OUT_OF_STOCK";
                return (
                  <tr key={size} className={`border-b border-[#F5F5F5] ${rowActive ? "bg-[#FFFBFB]" : ""} ${outOfStock ? "opacity-55" : ""}`}>
                    <td className="py-3 pr-4 font-medium text-ink">{size}</td>
                    <td className="py-3 pr-4 text-right"><PriceCell price={priceMap[upper.id]} /></td>
                    <td className="py-3 pr-4"><StockBadge status={upper.inventory?.status} /></td>
                    <td className="py-3">
                      <QuantityInput value={upperQty} onChange={(v) => onQtyChange(upper.id, v)} min={0} max={upper.inventory?.available} disabled={outOfStock} />
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={size} className={`border-b border-[#F5F5F5] ${rowActive ? "bg-[#FFFBFB]" : ""}`}>
                  <td className="py-3 pr-4 font-semibold text-ink">{size}</td>
                  <td className="py-3 pr-4 text-center">
                    {upper ? <PriceCell price={priceMap[upper.id]} /> : <span className="text-[#9A9A9A]">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {upper ? (
                      <div className="flex justify-center">
                        <QuantityInput
                          value={upperQty}
                          onChange={(v) => onQtyChange(upper.id, v)}
                          min={0}
                          max={upper.inventory?.available}
                          disabled={upper.inventory?.status === "OUT_OF_STOCK"}
                        />
                      </div>
                    ) : (
                      <span className="block text-center text-[#9A9A9A]">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    {lower ? <PriceCell price={priceMap[lower.id]} /> : <span className="text-[#9A9A9A]">—</span>}
                  </td>
                  <td className="py-3">
                    {lower ? (
                      <div className="flex justify-center">
                        <QuantityInput
                          value={lowerQty}
                          onChange={(v) => onQtyChange(lower.id, v)}
                          min={0}
                          max={lower.inventory?.available}
                          disabled={lower.inventory?.status === "OUT_OF_STOCK"}
                        />
                      </div>
                    ) : (
                      <span className="block text-center text-[#9A9A9A]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {sizes.map((size) => {
          const { upper, lower } = matrix[size];
          return (
            <div key={size} className="rounded-lg border border-[#E6E6E6] bg-white p-3.5">
              <p className="mb-3 text-[13.5px] font-semibold text-ink">Size: {size}</p>
              <div className="grid grid-cols-2 gap-3">
                {upper && (
                  <div className={`rounded border p-2.5 ${(quantityMap[upper.id] ?? 0) > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#F0F0F0]"}`}>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9A9A]">Upper</p>
                    <p className="mb-1 text-[13px] font-semibold text-ink">
                      {priceMap[upper.id] ? `${priceMap[upper.id]!.currencySymbol}${priceMap[upper.id]!.sellingPrice.toLocaleString("en-IN")}` : "—"}
                    </p>
                    <StockBadge status={upper.inventory?.status} />
                    <div className="mt-2">
                      <QuantityInput value={quantityMap[upper.id] ?? 0} onChange={(v) => onQtyChange(upper.id, v)} min={0} max={upper.inventory?.available} disabled={upper.inventory?.status === "OUT_OF_STOCK"} />
                    </div>
                  </div>
                )}
                {lower && (
                  <div className={`rounded border p-2.5 ${(quantityMap[lower.id] ?? 0) > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#F0F0F0]"}`}>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9A9A]">Lower</p>
                    <p className="mb-1 text-[13px] font-semibold text-ink">
                      {priceMap[lower.id] ? `${priceMap[lower.id]!.currencySymbol}${priceMap[lower.id]!.sellingPrice.toLocaleString("en-IN")}` : "—"}
                    </p>
                    <StockBadge status={lower.inventory?.status} />
                    <div className="mt-2">
                      <QuantityInput value={quantityMap[lower.id] ?? 0} onChange={(v) => onQtyChange(lower.id, v)} min={0} max={lower.inventory?.available} disabled={lower.inventory?.status === "OUT_OF_STOCK"} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
