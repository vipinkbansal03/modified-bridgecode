"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Layers3, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { useCart } from "@/contexts/CartContext";
import { applyDiscount, nextDiscountTier } from "@/utils/discountRules";
import type { ApiAttribute, ApiProductDetail, ApiProductPrice, ApiVariant } from "@/types/api.types";

interface VariantConfiguratorProps {
  apiProduct: ApiProductDetail;
}

type ProductOptionAttribute = ApiAttribute & { values: NonNullable<ApiAttribute["values"]> };

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

export function VariantConfigurator({ apiProduct }: VariantConfiguratorProps) {
  const { selectedCurrency } = useCurrencyContext();
  const { addItems } = useQuoteCart();
  const { addItem, openCart } = useCart();
  const attributes: ProductOptionAttribute[] = apiProduct.attributes.map((attribute) => ({
    ...attribute,
    values: attribute.values ?? [],
  }));
  const variants = apiProduct.variants;
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => buildInitialSelections(attributes, variants));
  const [quantity, setQuantity] = useState(1);
  const [drafts, setDrafts] = useState<DraftConfiguration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

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

  const subtotal = drafts.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = applyDiscount(subtotal);
  const nextTier = nextDiscountTier(subtotal);
  const totalUnits = drafts.reduce((sum, item) => sum + item.quantity, 0);

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
      unitPrice: currentPrice?.sellingPrice ?? 0,
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
      unitPrice: currentPrice.sellingPrice,
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
      <div className="mb-8 rounded-[28px] border border-[#E6E1DA] bg-[linear-gradient(135deg,#FCFBF8_0%,#F6F1E8_55%,#FFF7EF_100%)] p-6 shadow-[0_24px_80px_rgba(21,16,12,0.08)] sm:p-8">
        <div className="mb-7 flex flex-col gap-4 border-b border-[#E8DDD0] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E9D4BA] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A44C17]">
              <Sparkles size={12} />
              Premium Configurator
            </span>
            <h2 className="text-[clamp(26px,3vw,38px)] font-normal tracking-[-0.03em] text-[#1F1A17]">
              Build a quote-ready configuration without leaving the PDP
            </h2>
            <p className="mt-2 max-w-[620px] text-[14.5px] leading-relaxed text-[#6C6258]">
              Select the exact variant, stage multiple configurations, review the consolidated quote summary, and push everything into the quote cart in one step.
            </p>
          </div>

          <Link
            href={`/quick-order?product=${apiProduct.slug}`}
            className="inline-flex items-center justify-center rounded-full border border-[#D8C5B1] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#4B3A2E] transition hover:border-[#B89067] hover:text-[#A44C17]"
          >
            Open Quick Order Workspace
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-5">
            {attributes.map((attribute) => (
              <div key={attribute.id} className="rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-[0_10px_30px_rgba(36,28,21,0.04)] sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A08974]">{attribute.name}</p>
                    <p className="mt-1 text-[13px] text-[#6C6258]">
                      {selectedOptions[attribute.name] ? `Selected: ${selectedOptions[attribute.name]}` : "Choose one option"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F4ECE3] px-2.5 py-1 text-[11px] font-medium text-[#7A6654]">
                    {attribute.values.length} options
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {attribute.values.map((value) => {
                    const active = selectedOptions[attribute.name] === value.value;
                    const available = isValueAvailable(attribute.name, value.value);
                    return (
                      <button
                        key={value.id}
                        type="button"
                        disabled={!available}
                        onClick={() => handleOptionSelect(attribute.name, value.value)}
                        className={[
                          "rounded-full border px-4 py-2 text-[13px] font-medium transition",
                          active ? "border-[#A44C17] bg-[#A44C17] text-white shadow-[0_8px_24px_rgba(164,76,23,0.24)]" : "",
                          !active && available ? "border-[#E6D9CB] bg-[#FFFDFC] text-[#382E28] hover:border-[#C9AB8B]" : "",
                          !available ? "cursor-not-allowed border-[#EFE7DE] bg-[#F7F2ED] text-[#B7AA9B]" : "",
                        ].join(" ")}
                      >
                        {value.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="rounded-[22px] border border-white/80 bg-white/85 p-4 shadow-[0_10px_30px_rgba(36,28,21,0.04)] sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A08974]">Quantity</p>
                  <p className="mt-1 text-[13px] text-[#6C6258]">Set the unit count for this configuration before you add it to the list.</p>
                </div>
                <div className="flex items-center rounded-full border border-[#E3D6C8] bg-[#FFFDFC] p-1.5">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6DBCF] text-[#4B3A2E]"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                    className="w-20 border-0 bg-transparent text-center text-[15px] font-semibold text-[#221D1A] outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((current) => current + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6DBCF] text-[#4B3A2E]"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[18px] border border-[#EADFD3] bg-[linear-gradient(180deg,#FFFDFC_0%,#FBF5EE_100%)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#A08974]">Current Variant</p>
                  <p className="mt-1 text-[18px] font-semibold text-[#231C18]">{currentVariant?.title ?? "No valid combination selected"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {currentVariant ? (
                      Object.entries(currentVariant.attributeCombination).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#6C6258]">
                          {key}: {value}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12px] text-[#9B8570]">Choose a supported combination to continue.</span>
                    )}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A08974]">Estimated Unit Price</p>
                  <p className="mt-1 text-[24px] font-semibold text-[#231C18]">{formatMoney(currencySymbol, currentPrice?.sellingPrice ?? 0)}</p>
                  <p className="mt-1 text-[12px] text-[#7C6E62]">{currentVariant?.sku ? `SKU ${currentVariant.sku}` : "SKU assigned after configuration"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddConfiguration}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[#A44C17] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#8A3F12]"
                >
                  Add Configuration
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#D8C5B1] bg-white px-5 py-3 text-[13px] font-semibold text-[#4B3A2E] transition hover:border-[#A44C17] hover:text-[#A44C17]"
                >
                  <ShoppingBag size={15} />
                  Add to Cart
                </button>
                <Link
                  href={`/quick-order?product=${apiProduct.slug}`}
                  className="inline-flex items-center justify-center rounded-full border border-[#D8C5B1] bg-white px-5 py-3 text-[13px] font-semibold text-[#4B3A2E] transition hover:border-[#B89067] hover:text-[#A44C17]"
                >
                  Use Spreadsheet View
                </Link>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-[16px] border border-[#F1C6B6] bg-[#FFF3EE] px-4 py-3 text-[#A44C17]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p className="text-[13px]">{error}</p>
                </div>
              )}

              {added && (
                <div className="mt-4 flex items-start gap-2 rounded-[16px] border border-[#CDE8D7] bg-[#F1FAF4] px-4 py-3 text-[#215C34]">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <p className="text-[13px]">Configurations moved to the quote cart. You can review or submit them from the sticky cart.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-[#E6D9CB] bg-[#201814] p-5 text-white shadow-[0_26px_70px_rgba(16,10,8,0.25)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Layers3 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D8C1AF]">Selected Configurations</p>
                  <p className="text-[14px] text-[#F5EDE7]">{drafts.length ? `${drafts.length} saved for this product` : "Nothing staged yet"}</p>
                </div>
              </div>

              {drafts.length ? (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div key={draft.variantId} className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-white">{draft.variantTitle}</p>
                          <p className="mt-1 text-[11.5px] text-[#D3C4B8]">{draft.sku ? `SKU ${draft.sku}` : "Custom configuration"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateDraftQuantity(draft.variantId, 0)}
                          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#F1B48F]"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(draft.selectedAttributes).map(([key, value]) => (
                          <span key={key} className="rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] text-[#F3E7DF]">
                            {key}: {value}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                          <button
                            type="button"
                            aria-label="Decrease configuration quantity"
                            onClick={() => updateDraftQuantity(draft.variantId, draft.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-12 text-center text-[13px] font-semibold">{draft.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase configuration quantity"
                            onClick={() => updateDraftQuantity(draft.variantId, draft.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-[#D8C1AF]">Line Total</p>
                          <p className="text-[16px] font-semibold text-white">
                            {formatMoney(draft.currencySymbol, draft.unitPrice * draft.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-white/15 bg-white/5 p-4 text-[13px] leading-relaxed text-[#D3C4B8]">
                  Add your first variant configuration to build a quote summary here. This list is product-specific and can stage multiple setups before you commit them to the quote cart.
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[#E6D9CB] bg-white p-5 shadow-[0_16px_50px_rgba(31,24,18,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A08974]">Quote Summary</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-[13.5px] text-[#6C6258]">
                  <span>Configurations</span>
                  <strong className="text-[#231C18]">{drafts.length}</strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-[#6C6258]">
                  <span>Total Units</span>
                  <strong className="text-[#231C18]">{totalUnits}</strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-[#6C6258]">
                  <span>Subtotal</span>
                  <strong className="text-[#231C18]">{formatMoney(currencySymbol, subtotal)}</strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-[#6C6258]">
                  <span>Volume Discount</span>
                  <strong className="text-[#231C18]">
                    {discount.percentage ? `-${formatMoney(currencySymbol, discount.amount)} (${discount.percentage}%)` : "Not applied yet"}
                  </strong>
                </div>
              </div>

              <div className="mt-4 rounded-[18px] border border-[#EFE4D8] bg-[#FCF9F4] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A08974]">Estimated Total</p>
                    <p className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-[#231C18]">{formatMoney(currencySymbol, discount.grandTotal)}</p>
                  </div>
                  {nextTier ? (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-[#7A6654]">
                      Add {formatMoney(currencySymbol, nextTier.minValue - subtotal)} more to unlock {nextTier.percentage}% off.
                    </div>
                  ) : (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-[#2A6A40]">
                      Highest volume discount tier reached.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToQuote}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#A44C17] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#8A3F12]"
              >
                Add To Quote
              </button>
              <p className="mt-2 text-center text-[11.5px] text-[#8C7A6B]">
                Spreadsheet-style high-volume entry remains available in Quick Order.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
