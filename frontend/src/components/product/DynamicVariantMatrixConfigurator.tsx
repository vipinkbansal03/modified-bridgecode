"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Layers3, ShoppingBag } from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { apiClient } from "@/lib/apiClient";
import { QuantityInput } from "./QuantityInput";
import { StockBadge } from "./StockBadge";
import type { ApiAttribute, ApiAttributeValue, ApiProductDetail, ApiProductPrice, ApiVariant } from "@/types/api.types";

interface DynamicVariantMatrixConfiguratorProps {
  apiProduct: ApiProductDetail;
}

type AttributeDisplayType = "DROPDOWN" | "X_GRID" | "Y_GRID";
type ProductOptionAttribute = ApiAttribute & { values: ApiAttributeValue[] };
type NormalizedVariant = ApiVariant & {
  selectionByAttributeId: Record<string, string>;
};

function getAttributeDisplayType(attribute: ProductOptionAttribute): AttributeDisplayType {
  return attribute.displayType ?? attribute.role;
}

function getPriceForCurrency(variant: ApiVariant, currencyCode: string): ApiProductPrice | null {
  return (
    variant.prices.find((price) => price.currencyCode === currencyCode) ??
    variant.prices.find((price) => price.currencyCode === "INR") ??
    variant.prices[0] ??
    null
  );
}

function formatMoney(symbol: string, amount: number) {
  return `${symbol}${Math.round(amount || 0).toLocaleString("en-IN")}`;
}

function buildSelectionKey(selectionByAttributeId: Record<string, string>) {
  return Object.entries(selectionByAttributeId)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([attributeId, valueId]) => `${attributeId}:${valueId}`)
    .join("|");
}

function buildVariantLookupKey(selectionByAttributeId: Record<string, string>, packageId?: string | null) {
  return buildSelectionKey({
    ...selectionByAttributeId,
    __package: packageId ?? "",
  });
}

function normalizeVariantSelections(attributes: ProductOptionAttribute[], variant: ApiVariant) {
  if (variant.attributeValueIdsByAttributeId && Object.keys(variant.attributeValueIdsByAttributeId).length > 0) {
    return variant.attributeValueIdsByAttributeId;
  }

  const fallback: Record<string, string> = {};
  for (const attribute of attributes) {
    const selectedLabel = variant.attributeCombination[attribute.name];
    const matchedValue = attribute.values.find((value) => value.value === selectedLabel);
    if (matchedValue) fallback[attribute.id] = matchedValue.id;
  }
  return fallback;
}

function buildInitialDropdownSelections(attributes: ProductOptionAttribute[], variants: NormalizedVariant[]) {
  const firstVariant = variants[0];
  return attributes.reduce<Record<string, string>>((acc, attribute) => {
    const firstMatchingValueId =
      firstVariant?.selectionByAttributeId[attribute.id] ??
      attribute.values[0]?.id ??
      "";
    if (firstMatchingValueId) acc[attribute.id] = firstMatchingValueId;
    return acc;
  }, {});
}

function buildCartItems(
  apiProduct: ApiProductDetail,
  variants: NormalizedVariant[],
  quantityMap: Record<string, number>,
  priceMap: Record<string, ApiProductPrice | null>,
  previewPriceMap?: Record<string, number>,
) {
  const items: Array<{ cart: CartItem; quote: QuoteCartItem }> = [];

  Object.entries(quantityMap).forEach(([variantId, quantity]) => {
    if (quantity <= 0) return;
    const variant = variants.find((entry) => entry.id === variantId);
    const price = priceMap[variantId];
    if (!variant || !price) return;

    const base = {
      productId: apiProduct.id,
      productTitle: apiProduct.title,
      variantId,
      variantTitle: variant.title,
      sku: variant.sku,
      quantity,
      unitPrice: previewPriceMap?.[variantId] ?? price.sellingPrice,
      currencyCode: price.currencyCode,
      currencySymbol: price.currencySymbol,
      selectedAttributes: variant.attributeCombination,
    };

    items.push({
      cart: {
        ...base,
        productSlug: apiProduct.slug,
        countryCode: price.countryCode,
        countryName: price.countryName,
      },
      quote: base,
    });
  });

  return items;
}

export function DynamicVariantMatrixConfigurator({ apiProduct }: DynamicVariantMatrixConfiguratorProps) {
  const { selectedCurrency, selectedCountryCode } = useCurrencyContext();
  const { addItems: addCartItems, openCart } = useCart();
  const { addItems: addQuoteItems } = useQuoteCart();

  const attributes = useMemo<ProductOptionAttribute[]>(
    () =>
      [...apiProduct.attributes]
        .map((attribute) => ({
          ...attribute,
          values: [...(attribute.values ?? [])].sort((left, right) => left.sortOrder - right.sortOrder || left.value.localeCompare(right.value)),
        }))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [apiProduct.attributes],
  );

  const xAxisAttributes = attributes.filter((attribute) => getAttributeDisplayType(attribute) === "X_GRID");
  const yAxisAttributes = attributes.filter((attribute) => getAttributeDisplayType(attribute) === "Y_GRID");
  const xAxisAttribute = xAxisAttributes.length === 1 ? xAxisAttributes[0] : null;
  const yAxisAttribute = yAxisAttributes.length === 1 ? yAxisAttributes[0] : null;
  const matrixEnabled = Boolean(xAxisAttribute && yAxisAttribute);
  const dropdownAttributes = matrixEnabled
    ? attributes.filter((attribute) => attribute.id !== xAxisAttribute!.id && attribute.id !== yAxisAttribute!.id)
    : attributes;

  const normalizedVariants = useMemo<NormalizedVariant[]>(
    () =>
      apiProduct.variants.map((variant) => ({
        ...variant,
        selectionByAttributeId: normalizeVariantSelections(attributes, variant),
      })),
    [apiProduct.variants, attributes],
  );

  const [dropdownSelections, setDropdownSelections] = useState<Record<string, string>>(() =>
    buildInitialDropdownSelections(dropdownAttributes, normalizedVariants),
  );
  const packageOptions = useMemo(
    () =>
      Array.from(
        new Map(
          normalizedVariants
            .filter((variant) => variant.package)
            .map((variant) => [variant.package!.id, { id: variant.package!.id, title: variant.package!.title }]),
        ).values(),
      ),
    [normalizedVariants],
  );
  const filterControlCount = dropdownAttributes.length + (packageOptions.length > 1 ? 1 : 0);
  const [selectedPackageId, setSelectedPackageId] = useState(() => packageOptions[0]?.id ?? "");
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [previewPriceMap, setPreviewPriceMap] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const variantPriceMap = useMemo(() => {
    const map: Record<string, ApiProductPrice | null> = {};
    for (const variant of normalizedVariants) {
      map[variant.id] = getPriceForCurrency(variant, selectedCurrency);
    }
    return map;
  }, [normalizedVariants, selectedCurrency]);

  const variantLookup = useMemo(() => {
    const map = new Map<string, NormalizedVariant | null>();
    for (const variant of normalizedVariants) {
      const key = buildVariantLookupKey(variant.selectionByAttributeId, variant.package?.id);
      if (map.has(key)) {
        map.set(key, null);
      } else {
        map.set(key, variant);
      }
    }
    return map;
  }, [normalizedVariants]);

  const filteredVariants = useMemo(
    () =>
      normalizedVariants.filter((variant) =>
        (packageOptions.length <= 1 || (variant.package?.id ?? "") === selectedPackageId) &&
        dropdownAttributes.every((attribute) => {
          const selectedValueId = dropdownSelections[attribute.id];
          return !selectedValueId || variant.selectionByAttributeId[attribute.id] === selectedValueId;
        }),
      ),
    [dropdownAttributes, dropdownSelections, normalizedVariants, packageOptions.length, selectedPackageId],
  );

  const selectedEntries = useMemo(
    () =>
      Object.entries(quantityMap)
        .filter(([, quantity]) => quantity > 0)
        .map(([variantId, quantity]) => {
          const variant = normalizedVariants.find((entry) => entry.id === variantId);
          const price = variant ? variantPriceMap[variant.id] : null;
          return variant && price
            ? {
                variant,
                quantity,
                price,
                resolvedUnitPrice: previewPriceMap[variant.id] ?? price.sellingPrice,
                total: (previewPriceMap[variant.id] ?? price.sellingPrice) * quantity,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [normalizedVariants, previewPriceMap, quantityMap, variantPriceMap],
  );

  const totals = useMemo(() => {
    const totalUnits = selectedEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const subtotal = selectedEntries.reduce((sum, entry) => sum + entry.total, 0);
    const currencySymbol = selectedEntries[0]?.price.currencySymbol ?? variantPriceMap[normalizedVariants[0]?.id ?? ""]?.currencySymbol ?? "Rs ";
    return { totalUnits, subtotal, currencySymbol };
  }, [normalizedVariants, selectedEntries, variantPriceMap]);

  const handleDropdownChange = (attributeId: string, valueId: string) => {
    setDropdownSelections((current) => ({ ...current, [attributeId]: valueId }));
    setFeedback(null);
  };

  const handleQuantityChange = (variantId: string, quantity: number) => {
    setQuantityMap((current) => {
      if (quantity <= 0) {
        const next = { ...current };
        delete next[variantId];
        return next;
      }
      return { ...current, [variantId]: quantity };
    });
    setFeedback(null);
  };

  const handleAddSelectedToCart = () => {
    const items = buildCartItems(apiProduct, normalizedVariants, quantityMap, variantPriceMap, previewPriceMap);
    if (!items.length) {
      setFeedback({ kind: "error", message: "Enter quantity for at least one available variant." });
      return;
    }

    addCartItems(items.map((item) => item.cart));
    openCart();
    setQuantityMap({});
    setFeedback({ kind: "success", message: `${items.length} variant line${items.length === 1 ? "" : "s"} added to cart.` });
  };

  const handleAddSelectedToQuote = () => {
    const items = buildCartItems(apiProduct, normalizedVariants, quantityMap, variantPriceMap, previewPriceMap);
    if (!items.length) {
      setFeedback({ kind: "error", message: "Enter quantity for at least one available variant." });
      return;
    }

    addQuoteItems(items.map((item) => item.quote));
    setQuantityMap({});
    setFeedback({ kind: "success", message: `${items.length} variant line${items.length === 1 ? "" : "s"} added to quote.` });
  };

  useEffect(() => {
    const previewItems = Object.entries(quantityMap)
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }));

    if (!previewItems.length) {
      setPreviewPriceMap({});
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const customerToken = window.localStorage.getItem("customer_token");
        const response = await apiClient.post(
          `/products/${apiProduct.slug}/price-preview`,
          { items: previewItems },
          {
            params: selectedCountryCode ? { countryCode: selectedCountryCode } : undefined,
            headers: customerToken ? { Authorization: `Bearer ${customerToken}` } : undefined,
          },
        );

        if (!active) return;

        const previews = (response.data.data ?? []) as Array<{ variantId: string; unitPrice: number }>;
        setPreviewPriceMap(
          previews.reduce<Record<string, number>>((acc, preview) => {
            acc[preview.variantId] = preview.unitPrice;
            return acc;
          }, {}),
        );
      } catch {
        if (active) setPreviewPriceMap({});
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [apiProduct.slug, quantityMap, selectedCountryCode]);

  if (!matrixEnabled || !xAxisAttribute || !yAxisAttribute) return null;

  return (
    <section className="pt-16">
      <div className="rounded-lg border border-line bg-white p-6 sm:p-7">
        <div className="mb-6 flex flex-col gap-2 border-b border-line pb-5">
          <h2 className="text-[clamp(24px,2.8vw,32px)] font-normal tracking-tight text-ink">
            Order Multiple Variants In One Step
          </h2>
          <p className="max-w-[760px] text-[14.5px] leading-relaxed text-steel">
            Use the matrix below to enter quantities across multiple variant combinations, then add every selected line to cart or quote in one action.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            {(dropdownAttributes.length > 0 || packageOptions.length > 1) && (
              <div className={`grid gap-4 ${filterControlCount > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                {packageOptions.length > 1 && (
                  <label className="block rounded-lg border border-line bg-offwhite p-4">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                      Package
                    </span>
                    <select
                      value={selectedPackageId}
                      onChange={(event) => setSelectedPackageId(event.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none transition focus:border-brand"
                    >
                      {packageOptions.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {dropdownAttributes.map((attribute) => {
                  const selectedValueId = dropdownSelections[attribute.id] ?? "";
                  return (
                    <label key={attribute.id} className="block rounded-lg border border-line bg-offwhite p-4">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                        {attribute.name}
                      </span>
                      <select
                        value={selectedValueId}
                        onChange={(event) => handleDropdownChange(attribute.id, event.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none transition focus:border-brand"
                      >
                        {attribute.values.map((value) => (
                          <option key={value.id} value={value.id}>
                            {value.value}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-line bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full border-collapse">
                  <thead>
                    <tr className="bg-offwhite">
                      <th className="sticky left-0 z-20 border-b border-r border-line bg-offwhite px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-2">
                        {yAxisAttribute.name} / {xAxisAttribute.name}
                      </th>
                      {xAxisAttribute.values.map((columnValue) => (
                        <th
                          key={columnValue.id}
                          className="sticky top-0 z-10 min-w-[160px] border-b border-line px-4 py-3 text-center text-[12px] font-semibold text-ink"
                        >
                          {columnValue.value}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yAxisAttribute.values.map((rowValue) => (
                      <tr key={rowValue.id} className="border-b border-line last:border-b-0">
                        <th className="sticky left-0 z-10 border-r border-line bg-white px-4 py-4 text-left text-[13px] font-semibold text-ink">
                          {rowValue.value}
                        </th>
                        {xAxisAttribute.values.map((columnValue) => {
                          const variant = variantLookup.get(
                            buildVariantLookupKey({
                              ...dropdownSelections,
                              [xAxisAttribute.id]: columnValue.id,
                              [yAxisAttribute.id]: rowValue.id,
                            }, selectedPackageId),
                          );
                          const price = variant ? variantPriceMap[variant.id] : null;
                          const availableStock = variant?.inventory?.available;
                          const outOfStock = !variant || variant.inventory?.status === "OUT_OF_STOCK" || availableStock === 0;
                          const quantity = variant ? quantityMap[variant.id] ?? 0 : 0;
                          const minPositive = Math.max(1, variant?.moq ?? 1);
                          const displayUnitPrice = variant && price ? previewPriceMap[variant.id] ?? price.sellingPrice : null;

                          return (
                            <td key={columnValue.id} className="align-top border-l border-line px-3 py-3">
                              {variant ? (
                                <div className={`rounded-lg border p-3 ${quantity > 0 ? "border-brand/20 bg-[#FFFBFB]" : "border-line bg-white"} ${outOfStock ? "opacity-60" : ""}`}>
                                  <div className="mb-2 flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[12.5px] font-semibold text-ink">
                                        {price && displayUnitPrice != null ? formatMoney(price.currencySymbol, displayUnitPrice) : "Contact for pricing"}
                                      </p>
                                      {variant.sku ? (
                                        <p className="mt-0.5 font-mono text-[10.5px] text-steel-2">{variant.sku}</p>
                                      ) : null}
                                    </div>
                                    <StockBadge status={variant.inventory?.status} />
                                  </div>
                                  <QuantityInput
                                    value={quantity}
                                    onChange={(nextQuantity) => handleQuantityChange(variant.id, nextQuantity)}
                                    min={0}
                                    max={availableStock}
                                    minPositive={minPositive}
                                    disabled={outOfStock || !price}
                                  />
                                  <div className="mt-2 text-[11px] text-steel-2">
                                    <p>{availableStock != null ? `${availableStock} available` : "Stock on request"}</p>
                                    {minPositive > 1 ? <p>MOQ {minPositive}</p> : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed border-line bg-offwhite px-3 py-6 text-center text-[12px] text-steel-2">
                                  Not available
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredVariants.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-[#E7C9B5] bg-[#FBF2EB] px-4 py-3 text-brand">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p className="text-[13px]">The selected dropdown filters do not match any active variants for this product.</p>
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-lg border border-line bg-offwhite p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-brand">
                  <Layers3 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">Selected Variants</p>
                  <p className="text-[14px] text-steel">
                    {selectedEntries.length ? `${selectedEntries.length} line${selectedEntries.length === 1 ? "" : "s"} ready` : "Nothing selected yet"}
                  </p>
                </div>
              </div>

              {selectedEntries.length ? (
                <div className="space-y-3">
                  {selectedEntries.map((entry) => (
                    <div key={entry.variant.id} className="rounded-lg border border-line bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13.5px] font-semibold text-ink">{entry.variant.title}</p>
                          <p className="mt-1 text-[12px] text-steel">
                            {entry.quantity} x {formatMoney(entry.price.currencySymbol, entry.resolvedUnitPrice)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(entry.variant.id, 0)}
                          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-white px-4 py-6 text-[13px] leading-relaxed text-steel">
                  Enter quantities directly in the matrix to stage multiple variants at once.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">Order Summary</p>
              <div className="mt-4 space-y-2 text-[14px] text-steel">
                <div className="flex items-center justify-between">
                  <span>Variant lines</span>
                  <span className="font-semibold text-ink">{selectedEntries.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total units</span>
                  <span className="font-semibold text-ink">{totals.totalUnits}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3 text-[16px]">
                  <span className="font-semibold text-ink">Subtotal</span>
                  <span className="font-semibold text-ink">{formatMoney(totals.currencySymbol, totals.subtotal)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={handleAddSelectedToCart}
                  disabled={selectedEntries.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-[#F0F0F0] disabled:text-[#9A9A9A]"
                >
                  <ShoppingBag size={15} />
                  Add Selected To Cart
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedToQuote}
                  disabled={selectedEntries.length === 0}
                  className="inline-flex w-full items-center justify-center rounded-pill border border-line bg-offwhite px-5 py-3 text-[13px] font-semibold text-ink transition hover:border-steel-2 hover:bg-white hover:text-brand disabled:cursor-not-allowed disabled:border-line disabled:bg-[#F0F0F0] disabled:text-[#9A9A9A]"
                >
                  Add Selected To Quote
                </button>
              </div>

              {feedback && (
                <div
                  className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 ${
                    feedback.kind === "success"
                      ? "border border-[#D7E4D9] bg-[#F5F8F4] text-[#355246]"
                      : "border border-[#E7C9B5] bg-[#FBF2EB] text-brand"
                  }`}
                >
                  {feedback.kind === "success" ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  )}
                  <p className="text-[13px]">{feedback.message}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
