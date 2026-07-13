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

function getAttributeDisplayType(attribute: ApiProductDetail["attributes"][number]) {
  return attribute.displayType ?? attribute.role;
}

function detectType(apiProduct: ApiProductDetail): BuilderType {
  const { attributes, variants } = apiProduct;
  if (!variants.length) return "flat";

  const xGridAttributes = attributes.filter((attribute) => getAttributeDisplayType(attribute) === "X_GRID");
  const yGridAttributes = attributes.filter((attribute) => getAttributeDisplayType(attribute) === "Y_GRID");

  if (xGridAttributes.length === 1 && yGridAttributes.length === 1) {
    const matrixAttributeNames = new Set(
      [...xGridAttributes, ...yGridAttributes].map((attribute) => attribute.name.toLowerCase()),
    );
    const supportsWireMatrix =
      matrixAttributeNames.has("arch") && (matrixAttributeNames.has("size") || matrixAttributeNames.has("width"));

    return supportsWireMatrix ? "wire" : "bracket";
  }

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
  wire: "Wire matrix — upper & lower arch quantities",
  bracket: "Variant order table — select quantities per variant",
  flat: "Product options — select quantities",
};

export function BulkOrderBuilder({ apiProduct }: Props) {
  const { selectedCurrency } = useCurrencyContext();
  const { addItems } = useQuoteCart();
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variants = apiProduct.variants;
  const builderType = detectType(apiProduct);

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
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E31E24]/10">
            <Package size={16} className="text-[#E31E24]" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-ink">B2B Bulk Order</h2>
            <p className="text-[12.5px] text-[#9A9A9A]">{TYPE_LABELS[builderType]}</p>
          </div>
        </div>
        <span className="inline-flex w-fit rounded-full border border-line bg-offwhite px-3 py-1 text-[11.5px] font-medium text-[#6B6B6B]">
          {variants.length} variants available
        </span>
      </div>

      <p className="mb-5 max-w-[920px] text-[13px] leading-relaxed text-[#6B6B6B]">
        Enter quantities for each variant below. Volume discounts apply automatically. Your selections will be saved to
        your quote cart.
      </p>

      <div className="sm:rounded-xl sm:border sm:border-line sm:bg-white sm:p-4">
        {builderType === "bracket" && (
          <BulkOrderTable
            variants={variants}
            attributes={apiProduct.attributes}
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
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle size={14} className="shrink-0 text-[#E31E24]" />
          <p className="text-[13px] text-[#E31E24]">{error}</p>
        </div>
      )}

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
