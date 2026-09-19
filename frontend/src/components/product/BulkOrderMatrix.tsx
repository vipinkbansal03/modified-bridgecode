"use client";

import type { ApiProductPrice, ApiVariant } from "@/types/api.types";
import { QuantityInput } from "./QuantityInput";
import { StockBadge } from "./StockBadge";
import { formatPrice } from "@/utils/formatPrice";

interface Props {
  variants: ApiVariant[];
  quantityMap: Record<string, number>;
  priceMap: Record<string, ApiProductPrice | null>;
  onQtyChange: (variantId: string, qty: number) => void;
}

function buildMatrix(variants: ApiVariant[]) {
  const matrix: Record<string, { upper?: ApiVariant; lower?: ApiVariant }> = {};

  for (const variant of variants) {
    const size =
      variant.attributeCombination["Size"] ??
      variant.attributeCombination["Width"] ??
      Object.values(variant.attributeCombination).find(
        (_, index) => {
          const k = Object.keys(variant.attributeCombination)[index].toLowerCase();
          return k !== "arch" && k !== "upper/lower";
        },
      ) ??
      "—";
    const arch = (variant.attributeCombination["Arch"] ?? variant.attributeCombination["Upper/Lower"] ?? "").toLowerCase();

    if (!matrix[size]) matrix[size] = {};
    if (arch.includes("upper") || arch.includes("u")) matrix[size].upper = variant;
    else if (arch.includes("lower") || arch.includes("l")) matrix[size].lower = variant;
    else matrix[size].upper = variant;
  }

  return matrix;
}

function PriceCell({ price }: { price: ApiProductPrice | null }) {
  if (!price) return <span className="text-[11.5px] text-[#9A9A9A]">—</span>;

  return (
    <span className="text-[13px] font-semibold text-ink">
      {formatPrice(price.sellingPrice, price.currencySymbol, price.currencyCode)}
    </span>
  );
}

export function BulkOrderMatrix({ variants, quantityMap, priceMap, onQtyChange }: Props) {
  const matrix = buildMatrix(variants);
  const sizes = Object.keys(matrix);
  const hasArch = variants.some(
    (variant) =>
      "Arch" in variant.attributeCombination ||
      "Upper/Lower" in variant.attributeCombination,
  );

  return (
    <>
      <div className="custom-scrollbar-x hidden overflow-x-auto pb-2 sm:block">
        <table className="w-full min-w-[760px] text-[13px]">
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
                  <tr
                    key={size}
                    className={`border-b border-[#F5F5F5] transition-colors ${
                      rowActive ? "bg-[#FFFBFB]" : "hover:bg-[#FAFAFA]"
                    } ${outOfStock ? "opacity-55" : ""}`}
                  >
                    <td className="py-3 pr-4 font-medium text-ink">{size}</td>
                    <td className="py-3 pr-4 text-right">
                      <PriceCell price={priceMap[upper.id]} />
                    </td>
                    <td className="py-3 pr-4">
                      <StockBadge status={upper.inventory?.status} />
                    </td>
                    <td className="py-3">
                      <QuantityInput
                        value={upperQty}
                        onChange={(value) => onQtyChange(upper.id, value)}
                        min={0}
                        max={upper.inventory?.available}
                        disabled={outOfStock}
                      />
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={size}
                  className={`border-b border-[#F5F5F5] transition-colors ${
                    rowActive ? "bg-[#FFFBFB]" : "hover:bg-[#FAFAFA]"
                  }`}
                >
                  <td className="py-3 pr-4 font-semibold text-ink">{size}</td>
                  <td className="py-3 pr-4 text-center">
                    {upper ? <PriceCell price={priceMap[upper.id]} /> : <span className="text-[#9A9A9A]">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {upper ? (
                      <div className="flex justify-center">
                        <QuantityInput
                          value={upperQty}
                          onChange={(value) => onQtyChange(upper.id, value)}
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
                          onChange={(value) => onQtyChange(lower.id, value)}
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

      <div className="space-y-3 sm:hidden">
        {sizes.map((size) => {
          const { upper, lower } = matrix[size];

          return (
            <div key={size} className="rounded-xl border border-[#E6E6E6] bg-white p-3.5">
              <p className="mb-3 text-[13.5px] font-semibold text-ink">Size: {size}</p>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                {upper && (
                  <div
                    className={`rounded-lg border p-2.5 ${
                      (quantityMap[upper.id] ?? 0) > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#F0F0F0]"
                    }`}
                  >
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9A9A]">Upper</p>
                    <p className="mb-1 text-[13px] font-semibold text-ink">
                      {priceMap[upper.id]
                        ? formatPrice(priceMap[upper.id]!.sellingPrice, priceMap[upper.id]!.currencySymbol, priceMap[upper.id]!.currencyCode)
                        : "—"}
                    </p>
                    <StockBadge status={upper.inventory?.status} />
                    <div className="mt-2">
                      <QuantityInput
                        value={quantityMap[upper.id] ?? 0}
                        onChange={(value) => onQtyChange(upper.id, value)}
                        min={0}
                        max={upper.inventory?.available}
                        disabled={upper.inventory?.status === "OUT_OF_STOCK"}
                      />
                    </div>
                  </div>
                )}
                {lower && (
                  <div
                    className={`rounded-lg border p-2.5 ${
                      (quantityMap[lower.id] ?? 0) > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#F0F0F0]"
                    }`}
                  >
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9A9A]">Lower</p>
                    <p className="mb-1 text-[13px] font-semibold text-ink">
                      {priceMap[lower.id]
                        ? formatPrice(priceMap[lower.id]!.sellingPrice, priceMap[lower.id]!.currencySymbol, priceMap[lower.id]!.currencyCode)
                        : "—"}
                    </p>
                    <StockBadge status={lower.inventory?.status} />
                    <div className="mt-2">
                      <QuantityInput
                        value={quantityMap[lower.id] ?? 0}
                        onChange={(value) => onQtyChange(lower.id, value)}
                        min={0}
                        max={lower.inventory?.available}
                        disabled={lower.inventory?.status === "OUT_OF_STOCK"}
                      />
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
