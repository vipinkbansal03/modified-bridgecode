"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Layers3, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { useCart } from "@/contexts/CartContext";
import { apiClient } from "@/lib/apiClient";
import { applyDiscount, nextDiscountTier } from "@/utils/discountRules";
import { DynamicVariantMatrixConfigurator } from "./DynamicVariantMatrixConfigurator";
import type { ApiAttribute, ApiProductDetail, ApiProductPrice, ApiVariant } from "@/types/api.types";

interface VariantConfiguratorProps {
  apiProduct: ApiProductDetail;
}

type ProductOptionAttribute = ApiAttribute & { values: NonNullable<ApiAttribute["values"]> };
type AttributeDisplayType = ApiAttribute["role"];

interface DraftConfiguration {
  variantId: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  currencyCode: string;
  currencySymbol: string;
  selectedAttributes: Record<string, string>;
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

function buildInitialSelections(attributes: ProductOptionAttribute[], variants: ApiVariant[]) {
  const seed = variants[0]?.attributeCombination ?? {};
  return attributes.reduce<Record<string, string>>((acc, attribute) => {
    const firstMatch = seed[attribute.name] ?? attribute.values[0]?.value ?? "";
    if (firstMatch) acc[attribute.name] = firstMatch;
    return acc;
  }, {});
}

function getAttributeDisplayType(attribute: ProductOptionAttribute): AttributeDisplayType {
  return attribute.displayType ?? attribute.role;
}

function getAttributeHelperText(displayType: AttributeDisplayType, selectedValue?: string) {
  if (selectedValue) return `Selected: ${selectedValue}`;
  if (displayType === "DROPDOWN") return "Select one option from the list below.";
  return "Choose one option to continue.";
}

export function VariantConfigurator({ apiProduct }: VariantConfiguratorProps) {
  const { selectedCurrency, selectedCountryCode } = useCurrencyContext();
  const { addItems } = useQuoteCart();
  const { addItem, openCart } = useCart();
  const attributes: ProductOptionAttribute[] = apiProduct.attributes.map((attribute) => ({
    ...attribute,
    values: attribute.values ?? [],
  }));
  const xAxisCount = attributes.filter((attribute) => getAttributeDisplayType(attribute) === "X_GRID").length;
  const yAxisCount = attributes.filter((attribute) => getAttributeDisplayType(attribute) === "Y_GRID").length;

  if (xAxisCount === 1 && yAxisCount === 1) {
    return <DynamicVariantMatrixConfigurator apiProduct={apiProduct} />;
  }

  const variants = apiProduct.variants;
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => buildInitialSelections(attributes, variants));
  const [quantity, setQuantity] = useState(1);
  const [drafts, setDrafts] = useState<DraftConfiguration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [previewPriceMap, setPreviewPriceMap] = useState<Record<string, number>>({});

  if (!variants.length) return null;

  const matchingVariants = variants.filter((variant) =>
    Object.entries(selectedOptions).every(([attributeName, value]) => !value || variant.attributeCombination[attributeName] === value)
  );

  const currentVariant =
    matchingVariants.find((variant) =>
      attributes.every((attribute) => variant.attributeCombination[attribute.name] === selectedOptions[attribute.name])
    ) ?? null;

  const currentPrice = currentVariant ? getPriceForCurrency(currentVariant, selectedCurrency) : null;
  const currencySymbol = currentPrice?.currencySymbol ?? variants[0]?.prices[0]?.currencySymbol ?? "₹";
  const currencyCode = currentPrice?.currencyCode ?? variants[0]?.prices[0]?.currencyCode ?? "INR";
  const currentResolvedUnitPrice = currentVariant ? previewPriceMap[currentVariant.id] ?? currentPrice?.sellingPrice ?? 0 : 0;

  const subtotal = drafts.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = applyDiscount(subtotal);
  const nextTier = nextDiscountTier(subtotal);
  const totalUnits = drafts.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!currentVariant || quantity < 1) {
      setPreviewPriceMap({});
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const customerToken = window.localStorage.getItem("customer_token");
        const response = await apiClient.post(
          `/products/${apiProduct.slug}/price-preview`,
          { items: [{ variantId: currentVariant.id, quantity }] },
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
  }, [apiProduct.slug, currentVariant?.id, quantity, selectedCountryCode]);

  function isValueAvailable(attributeName: string, value: string) {
    return variants.some((variant) =>
      attributes.every((attribute) => {
        const chosen = attribute.name === attributeName ? value : selectedOptions[attribute.name];
        return !chosen || variant.attributeCombination[attribute.name] === chosen;
      })
    );
  }

  function handleOptionSelect(attributeName: string, value: string) {
    setSelectedOptions((current) => ({ ...current, [attributeName]: value }));
    setError(null);
    setAdded(false);
  }

  function handleAddConfiguration() {
    if (!currentVariant) {
      setError("This configuration is not available. Please adjust the selected variant options.");
      return;
    }

    const line: DraftConfiguration = {
      variantId: currentVariant.id,
      variantTitle: currentVariant.title,
      sku: currentVariant.sku,
      quantity,
      unitPrice: currentResolvedUnitPrice,
      currencyCode,
      currencySymbol,
      selectedAttributes: currentVariant.attributeCombination,
    };

    setDrafts((current) => {
      const existingIndex = current.findIndex((item) => item.variantId === line.variantId);
      if (existingIndex === -1) return [...current, line];
      return current.map((item, index) =>
        index === existingIndex ? { ...item, quantity: item.quantity + line.quantity } : item
      );
    });
    setQuantity(1);
    setError(null);
    setAdded(false);
  }

  function handleAddToCart() {
    if (!currentVariant) {
      setError("This configuration is not available. Please adjust the selected variant options.");
      return;
    }
    if (!currentPrice) {
      setError("This configuration does not have an available purchase price yet.");
      return;
    }

    addItem({
      productId: apiProduct.id,
      productSlug: apiProduct.slug,
      productTitle: apiProduct.title,
      variantId: currentVariant.id,
      variantTitle: currentVariant.title,
      sku: currentVariant.sku,
      quantity,
      unitPrice: currentResolvedUnitPrice,
      currencyCode,
      currencySymbol,
      countryCode: currentPrice.countryCode,
      countryName: currentPrice.countryName,
      selectedAttributes: currentVariant.attributeCombination,
    });
    setAdded(false);
    setError(null);
    openCart();
  }

  function updateDraftQuantity(variantId: string, nextQuantity: number) {
    setDrafts((current) =>
      nextQuantity <= 0 ? current.filter((item) => item.variantId !== variantId) : current.map((item) => (item.variantId === variantId ? { ...item, quantity: nextQuantity } : item))
    );
  }

  function handleAddToQuote() {
    if (!drafts.length) {
      setError("Add at least one configuration before sending it to the quote cart.");
      return;
    }

    const items: QuoteCartItem[] = drafts.map((draft) => ({
      productId: apiProduct.id,
      productTitle: apiProduct.title,
      variantId: draft.variantId,
      variantTitle: draft.variantTitle,
      sku: draft.sku,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      currencyCode: draft.currencyCode,
      currencySymbol: draft.currencySymbol,
      selectedAttributes: draft.selectedAttributes,
    }));

    addItems(items);
    setDrafts([]);
    setAdded(true);
    setError(null);
  }

  return (
    <section className="pt-16">
      <div className="mb-8 rounded-lg border border-line bg-white p-6 sm:p-7">
        <div className="mb-7 flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <span className="mb-2 inline-flex items-center gap-2 rounded-pill border border-line bg-offwhite px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              <Sparkles size={12} />
              Premium Configurator
            </span>
            <h2 className="text-[clamp(24px,2.8vw,32px)] font-normal tracking-tight text-ink">
              Build a quote-ready configuration without leaving the PDP
            </h2>
            <p className="mt-2 max-w-[620px] text-[14.5px] leading-relaxed text-steel">
              Select the exact variant, stage multiple configurations, review the consolidated quote summary, and push everything into the quote cart in one step.
            </p>
          </div>

          <Link
            href={`/quick-order?product=${apiProduct.slug}`}
            className="inline-flex items-center justify-center rounded-pill border border-line bg-offwhite px-4 py-2.5 text-[12.5px] font-semibold text-ink transition hover:border-steel-2 hover:bg-white hover:text-brand"
          >
            Open Quick Order Workspace
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-5">
            {attributes.map((attribute) => {
              const displayType = getAttributeDisplayType(attribute);
              const selectedValue = selectedOptions[attribute.name];

              return (
                <div key={attribute.id} className="rounded-lg border border-line bg-offwhite p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">{attribute.name}</p>
                      <p className="mt-1 text-[13px] text-steel">{getAttributeHelperText(displayType, selectedValue)}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-pill border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-steel">
                        {attribute.values.length} options
                      </span>
                    </div>
                  </div>

                  {displayType === "DROPDOWN" ? (
                    <select
                      value={selectedValue ?? ""}
                      onChange={(event) => handleOptionSelect(attribute.name, event.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none transition focus:border-brand"
                    >
                      <option value="" disabled>
                        Choose one option
                      </option>
                      {attribute.values.map((value) => {
                        const available = isValueAvailable(attribute.name, value.value);
                        return (
                          <option key={value.id} value={value.value} disabled={!available}>
                            {value.value}{!available ? " (Unavailable)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {attribute.values.map((value) => {
                        const active = selectedValue === value.value;
                        const available = isValueAvailable(attribute.name, value.value);
                        return (
                          <button
                            key={value.id}
                            type="button"
                            disabled={!available}
                            onClick={() => handleOptionSelect(attribute.name, value.value)}
                            className={[
                              "rounded-lg border px-4 py-3 text-left text-[13px] font-medium transition-colors",
                              active ? "border-brand bg-white text-brand" : "",
                              !active && available ? "border-line bg-white text-ink hover:border-steel-2" : "",
                              !available ? "cursor-not-allowed border-line bg-[#F6F3EF] text-steel-2 opacity-70" : "",
                            ].join(" ")}
                          >
                            {value.value}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="rounded-lg border border-line bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">Quantity</p>
                  <p className="mt-1 text-[13px] text-steel">Set the unit count for this configuration before you add it to the list.</p>
                </div>
                <div className="flex items-center rounded-pill border border-line bg-offwhite p-1.5">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                    className="w-20 appearance-none border-0 bg-transparent text-center text-[15px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((current) => current + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-line bg-offwhite p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-steel-2">Current Variant</p>
                  <p className="mt-1 text-[18px] font-semibold text-ink">{currentVariant?.title ?? "No valid combination selected"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {currentVariant ? (
                      Object.entries(currentVariant.attributeCombination).map(([key, value]) => (
                        <span key={key} className="rounded-pill border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-steel">
                          {key}: {value}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12px] text-steel-2">Choose a supported combination to continue.</span>
                    )}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-2">Estimated Unit Price</p>
                  <p className="mt-1 text-[24px] font-semibold text-ink">{formatMoney(currencySymbol, currentResolvedUnitPrice)}</p>
                  <p className="mt-1 text-[12px] text-steel">{currentVariant?.sku ? `SKU ${currentVariant.sku}` : "SKU assigned after configuration"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddConfiguration}
                  className="inline-flex flex-1 items-center justify-center rounded-pill bg-brand px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90"
                >
                  Add Configuration
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill border border-line bg-offwhite px-5 py-3 text-[13px] font-semibold text-ink transition hover:border-steel-2 hover:bg-white hover:text-brand"
                >
                  <ShoppingBag size={15} />
                  Add to Cart
                </button>
                <Link
                  href={`/quick-order?product=${apiProduct.slug}`}
                  className="inline-flex items-center justify-center rounded-pill border border-line bg-offwhite px-5 py-3 text-[13px] font-semibold text-ink transition hover:border-steel-2 hover:bg-white hover:text-brand"
                >
                  Use Spreadsheet View
                </Link>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#E7C9B5] bg-[#FBF2EB] px-4 py-3 text-brand">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p className="text-[13px]">{error}</p>
                </div>
              )}

              {added && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#D7E4D9] bg-[#F5F8F4] px-4 py-3 text-[#355246]">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <p className="text-[13px]">Configurations moved to the quote cart. You can review or submit them from the sticky cart.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-line bg-offwhite p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-brand">
                  <Layers3 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">Selected Configurations</p>
                  <p className="text-[14px] text-steel">{drafts.length ? `${drafts.length} saved for this product` : "Nothing staged yet"}</p>
                </div>
              </div>

              {drafts.length ? (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div key={draft.variantId} className="rounded-lg border border-line bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-ink">{draft.variantTitle}</p>
                          <p className="mt-1 text-[11.5px] text-steel">{draft.sku ? `SKU ${draft.sku}` : "Custom configuration"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateDraftQuantity(draft.variantId, 0)}
                          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(draft.selectedAttributes).map(([key, value]) => (
                          <span key={key} className="rounded-pill border border-line bg-offwhite px-2.5 py-1 text-[10.5px] text-steel">
                            {key}: {value}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-pill border border-line bg-offwhite p-1">
                          <button
                            type="button"
                            aria-label="Decrease configuration quantity"
                            onClick={() => updateDraftQuantity(draft.variantId, draft.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-12 text-center text-[13px] font-semibold text-ink">{draft.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase configuration quantity"
                            onClick={() => updateDraftQuantity(draft.variantId, draft.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-steel-2">Line Total</p>
                          <p className="text-[16px] font-semibold text-ink">
                            {formatMoney(draft.currencySymbol, draft.unitPrice * draft.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-white p-4 text-[13px] leading-relaxed text-steel-2">
                  Add your first variant configuration to build a quote summary here. This list is product-specific and can stage multiple setups before you commit them to the quote cart.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">Quote Summary</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-[13.5px] text-steel">
                  <span>Configurations</span>
                  <strong className="text-ink">{drafts.length}</strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-steel">
                  <span>Total Units</span>
                  <strong className="text-ink">{totalUnits}</strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-steel">
                  <span>Subtotal</span>
                  <strong className="text-ink">{formatMoney(currencySymbol, subtotal)}</strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-steel">
                  <span>Volume Discount</span>
                  <strong className="text-ink">
                    {discount.percentage ? `-${formatMoney(currencySymbol, discount.amount)} (${discount.percentage}%)` : "Not applied yet"}
                  </strong>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-offwhite p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-2">Estimated Total</p>
                    <p className="mt-1 text-[26px] font-semibold tracking-tight text-ink">{formatMoney(currencySymbol, discount.grandTotal)}</p>
                  </div>
                  {nextTier ? (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-steel">
                      Add {formatMoney(currencySymbol, nextTier.minValue - subtotal)} more to unlock {nextTier.percentage}% off.
                    </div>
                  ) : (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-[#355246]">
                      Highest volume discount tier reached.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToQuote}
                className="mt-5 inline-flex w-full items-center justify-center rounded-pill bg-brand px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90"
              >
                Add To Quote
              </button>
              <p className="mt-2 text-center text-[11.5px] text-steel-2">
                Spreadsheet-style high-volume entry remains available in Quick Order.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
