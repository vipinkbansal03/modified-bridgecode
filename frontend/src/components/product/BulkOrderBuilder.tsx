"use client";

import { useState, useMemo, useCallback } from "react";
import { Package, AlertCircle } from "lucide-react";
import type { ApiProductDetail, ApiVariant, ApiProductPrice } from "@/types/api.types";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { BulkOrderTable } from "./BulkOrderTable";
import { BulkOrderMatrix } from "./BulkOrderMatrix";
import { BulkOrderFlat } from "./BulkOrderFlat";
import { BulkOrderSummary } from "./BulkOrderSummary";

interface Props {
  apiProduct: ApiProductDetail;
}

type BuilderType = "wire" | "bracket" | "flat";

function detectType(variants: ApiVariant[]): BuilderType {
  if (!variants.length) return "flat";
  const keys = Object.keys(variants[0].attributeCombination).map((k) => k.toLowerCase());
  if (keys.includes("arch")) return "wire";
  if (Object.keys(variants[0].attributeCombination).length > 1 || variants.length > 6) return "bracket";
  return "flat";
}

function getPrice(variant: ApiVariant, currencyCode: string): ApiProductPrice | null {
  return (
    variant.prices.find((p) => p.currencyCode === currencyCode) ??
    variant.prices.find((p) => p.currencyCode === "INR") ??
    variant.prices[0] ??
    null
  );
}

const TYPE_LABELS: Record<BuilderType, string> = {
  wire: "Wire Matrix — Upper & Lower Arch Quantities",
  bracket: "Variant Order Table — Select Quantities Per Variant",
  flat: "Product Options — Select Quantities",
};

export function BulkOrderBuilder({ apiProduct }: Props) {
  const { selectedCurrency } = useCurrencyContext();
  const { addItems } = useQuoteCart();
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variants = apiProduct.variants;
  const builderType = detectType(variants);

  const priceMap = useMemo(() => {
    const map: Record<string, ApiProductPrice | null> = {};
    for (const v of variants) map[v.id] = getPrice(v, selectedCurrency);
    return map;
  }, [variants, selectedCurrency]);

  const numericPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, price] of Object.entries(priceMap)) map[id] = price?.sellingPrice ?? 0;
    return map;
  }, [priceMap]);

  const currencySymbol = useMemo(() => {
    const firstWithPrice = variants.find((v) => priceMap[v.id]);
    return firstWithPrice ? (priceMap[firstWithPrice.id]?.currencySymbol ?? "₹") : "₹";
  }, [variants, priceMap]);

  const currencyCode = useMemo(() => {
    const firstWithPrice = variants.find((v) => priceMap[v.id]);
    return firstWithPrice ? (priceMap[firstWithPrice.id]?.currencyCode ?? "INR") : "INR";
  }, [variants, priceMap]);

  const handleQtyChange = useCallback((variantId: string, qty: number) => {
    setQuantityMap((prev) => {
      if (qty === 0) {
        const next = { ...prev };
        delete next[variantId];
        return next;
      }
      return { ...prev, [variantId]: qty };
    });
    setAdded(false);
    setError(null);
  }, []);

  const handleAddToQuote = useCallback(() => {
    const selectedEntries = Object.entries(quantityMap).filter(([, qty]) => qty > 0);
    if (!selectedEntries.length) {
      setError("Please enter a quantity for at least one variant.");
      return;
    }

    const items: QuoteCartItem[] = selectedEntries.map(([variantId, quantity]) => {
      const variant = variants.find((v) => v.id === variantId)!;
      const price = priceMap[variantId];
      return {
        productId: apiProduct.id,
        productTitle: apiProduct.title,
        variantId,
        variantTitle: variant.title,
        sku: variant.sku,
        quantity,
        unitPrice: price?.sellingPrice ?? 0,
        currencyCode,
        currencySymbol,
        selectedAttributes: variant.attributeCombination,
      };
    });

    addItems(items);
    setAdded(true);
    setError(null);

    setTimeout(() => setAdded(false), 4000);
  }, [quantityMap, variants, priceMap, apiProduct, currencyCode, currencySymbol, addItems]);

  if (!variants.length) return null;

  return (
    <div className="mt-10 border-t border-[#E6E6E6] pt-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E31E24]/10">
          <Package size={16} className="text-[#E31E24]" />
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-ink">B2B Bulk Order</h2>
          <p className="text-[12.5px] text-[#9A9A9A]">{TYPE_LABELS[builderType]}</p>
        </div>
      </div>

      {/* Note */}
      <p className="mb-5 text-[13px] text-[#6B6B6B]">
        Enter quantities for each variant below. Volume discounts apply automatically.
        Your selections will be saved to your quote cart.
      </p>

      {/* Builder table */}
      {builderType === "bracket" && (
        <BulkOrderTable
          variants={variants}
          quantityMap={quantityMap}
          priceMap={priceMap}
          onQtyChange={handleQtyChange}
        />
      )}
      {builderType === "wire" && (
        <BulkOrderMatrix
          variants={variants}
          quantityMap={quantityMap}
          priceMap={priceMap}
          onQtyChange={handleQtyChange}
        />
      )}
      {builderType === "flat" && (
        <BulkOrderFlat
          variants={variants}
          productTitle={apiProduct.title}
          quantityMap={quantityMap}
          priceMap={priceMap}
          onQtyChange={handleQtyChange}
        />
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle size={14} className="shrink-0 text-[#E31E24]" />
          <p className="text-[13px] text-[#E31E24]">{error}</p>
        </div>
      )}

      {/* Summary + CTA */}
      <BulkOrderSummary
        quantityMap={quantityMap}
        priceMap={numericPriceMap}
        currencySymbol={currencySymbol}
        onAddToQuote={handleAddToQuote}
        added={added}
      />
    </div>
  );
}
