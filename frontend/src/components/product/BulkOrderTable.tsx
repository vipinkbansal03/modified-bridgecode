"use client";

import type { ApiAttribute, ApiProductPrice, ApiVariant } from "@/types/api.types";
import { QuantityInput } from "./QuantityInput";
import { StockBadge } from "./StockBadge";
import { formatPrice } from "@/utils/formatPrice";
import { formatAttributeLabel } from "@/utils/attributeUtils";

interface Props {
  variants: ApiVariant[];
  attributes?: ApiAttribute[];
  quantityMap: Record<string, number>;
  priceMap: Record<string, ApiProductPrice | null>;
  onQtyChange: (variantId: string, qty: number) => void;
}

export function BulkOrderTable({ variants, attributes, quantityMap, priceMap, onQtyChange }: Props) {
  const fallbackKeys = variants.length ? Object.keys(variants[0].attributeCombination) : [];
  const orderedAttributeKeys = attributes?.length
    ? attributes
        .filter((attribute) => variants.some((variant) => variant.attributeCombination[attribute.name] != null))
        .map((attribute) => attribute.name)
    : [];
  const attrKeys = orderedAttributeKeys.length ? orderedAttributeKeys : fallbackKeys;

  return (
    <>
      <div className="custom-scrollbar-x hidden overflow-x-auto pb-2 sm:block">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b border-[#E6E6E6] text-left text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
              {attrKeys.map((k) => (
                <th key={k} className="pb-2.5 pr-4">
                  {formatAttributeLabel(k)}
                </th>
              ))}
              <th className="pb-2.5 pr-4">SKU</th>
              <th className="pb-2.5 pr-4 text-right">Unit Price</th>
              <th className="pb-2.5 pr-4">Stock</th>
              <th className="pb-2.5">Qty</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => {
              const price = priceMap[variant.id];
              const outOfStock = variant.inventory?.status === "OUT_OF_STOCK";
              const qty = quantityMap[variant.id] ?? 0;

              return (
                <tr
                  key={variant.id}
                  className={`border-b border-[#F5F5F5] transition-colors ${outOfStock ? "opacity-55" : ""} ${
                    qty > 0 ? "bg-[#FFFBFB]" : "hover:bg-[#FAFAFA]"
                  }`}
                >
                  {attrKeys.map((key) => (
                    <td key={key} className="py-3 pr-4 font-medium text-ink">
                      {variant.attributeCombination[key] ?? "—"}
                    </td>
                  ))}
                  <td className="py-3 pr-4 font-mono text-[11.5px] text-[#9A9A9A]">{variant.sku ?? "—"}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-ink">
                    {price ? (
                      <>
                        {formatPrice(price.sellingPrice, price.currencySymbol, price.currencyCode)}
                        {price.mrp > price.sellingPrice && (
                          <span className="ml-1.5 text-[11px] text-[#9A9A9A] line-through">
                            {formatPrice(price.mrp, price.currencySymbol, price.currencyCode)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11.5px] text-[#9A9A9A]">Contact for pricing</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StockBadge status={variant.inventory?.status} />
                  </td>
                  <td className="py-3">
                    <QuantityInput
                      value={qty}
                      onChange={(val) => onQtyChange(variant.id, val)}
                      min={0}
                      max={variant.inventory?.available}
                      disabled={outOfStock}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {variants.map((variant) => {
          const price = priceMap[variant.id];
          const outOfStock = variant.inventory?.status === "OUT_OF_STOCK";
          const qty = quantityMap[variant.id] ?? 0;

          return (
            <div
              key={variant.id}
              className={`rounded-xl border p-3.5 ${
                qty > 0 ? "border-[#E31E24]/20 bg-[#FFFBFB]" : "border-[#E6E6E6] bg-white"
              } ${outOfStock ? "opacity-55" : ""}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold leading-snug text-ink">{variant.title}</p>
                  <div className="mt-1 space-y-0.5">
                    {attrKeys.map((key) => (
                      <p key={key} className="text-[11.5px] text-[#9A9A9A]">
                        {formatAttributeLabel(key)}: {variant.attributeCombination[key] ?? "—"}
                      </p>
                    ))}
                  </div>
                  {variant.sku && <p className="mt-1 font-mono text-[11px] text-[#B0B0B0]">{variant.sku}</p>}
                </div>
                <div className="shrink-0">
                  <StockBadge status={variant.inventory?.status} />
                </div>
              </div>

              <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <span className="text-[14px] font-semibold text-ink">
                  {price ? (
                    formatPrice(price.sellingPrice, price.currencySymbol, price.currencyCode)
                  ) : (
                    <span className="text-[12px] text-[#9A9A9A]">Contact for pricing</span>
                  )}
                </span>
                <QuantityInput
                  value={qty}
                  onChange={(val) => onQtyChange(variant.id, val)}
                  min={0}
                  max={variant.inventory?.available}
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
