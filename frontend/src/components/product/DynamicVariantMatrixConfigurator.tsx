"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  AlertCircle,
  CheckCircle2,
  Layers3,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { useQuoteCartUI } from "@/contexts/QuoteCartUIContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";
import { apiClient } from "@/lib/apiClient";
import { useProductWarehouses } from "@/hooks/api/useProducts";
import { WarehouseSelectorModal } from "./WarehouseSelectorModal";
import { QuantityInput } from "./QuantityInput";
import { StockBadge } from "./StockBadge";
import type {
  ApiAttribute,
  ApiAttributeValue,
  ApiProductDetail,
  ApiProductPrice,
  ApiVariant,
} from "@/types/api.types";

interface DynamicVariantMatrixConfiguratorProps {
  apiProduct: ApiProductDetail;
}

type AttributeDisplayType = "DROPDOWN" | "X_GRID" | "Y_GRID";
type ProductOptionAttribute = ApiAttribute & { values: ApiAttributeValue[] };
type NormalizedVariant = ApiVariant & {
  selectionByAttributeId: Record<string, string>;
};
type AxisCombination = {
  key: string;
  selection: Record<string, string>;
  labels: Array<{ attributeName: string; value: ApiAttributeValue }>;
};

function getAttributeDisplayType(
  attribute: ProductOptionAttribute,
): AttributeDisplayType {
  return attribute.displayType ?? attribute.role;
}

function getPriceForCurrency(
  variant: ApiVariant,
  currencyCode: string,
  productPrices: ApiProductPrice[] = [],
): ApiProductPrice | null {
  return (
    variant.prices.find((price) => price.currencyCode === currencyCode) ??
    productPrices.find((price) => price.currencyCode === currencyCode) ??
    null
  );
}

function formatMoney(symbol: string, amount: number) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  const val = Number(amount);
  const hasDecimals = Math.abs(val % 1) > 0.001;
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

function buildSelectionKey(selectionByAttributeId: Record<string, string>) {
  return Object.entries(selectionByAttributeId)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([attributeId, valueId]) => `${attributeId}:${valueId}`)
    .join("|");
}

function buildVariantLookupKey(
  selectionByAttributeId: Record<string, string>,
  packageId?: string | null,
) {
  return buildSelectionKey({
    ...selectionByAttributeId,
    __package: packageId ?? "",
  });
}

function buildAxisCombinations(
  attributes: ProductOptionAttribute[],
): AxisCombination[] {
  return attributes.reduce<AxisCombination[]>(
    (combinations, attribute) =>
      combinations.flatMap((combination) =>
        attribute.values.map((value) => ({
          key: `${combination.key}${combination.key ? "|" : ""}${attribute.id}:${value.id}`,
          selection: { ...combination.selection, [attribute.id]: value.id },
          labels: [
            ...combination.labels,
            { attributeName: attribute.name, value },
          ],
        })),
      ),
    [{ key: "all", selection: {}, labels: [] }],
  );
}

function normalizeVariantSelections(
  attributes: ProductOptionAttribute[],
  variant: ApiVariant,
) {
  if (
    variant.attributeValueIdsByAttributeId &&
    Object.keys(variant.attributeValueIdsByAttributeId).length > 0
  ) {
    return variant.attributeValueIdsByAttributeId;
  }

  const fallback: Record<string, string> = {};
  for (const attribute of attributes) {
    const selectedLabel = variant.attributeCombination[attribute.name];
    const matchedValue = attribute.values.find(
      (value) => value.value === selectedLabel,
    );
    if (matchedValue) fallback[attribute.id] = matchedValue.id;
  }
  return fallback;
}

function buildInitialDropdownSelections(
  attributes: ProductOptionAttribute[],
  variants: NormalizedVariant[],
) {
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
  warehouses: any[], // pass the loaded warehouses list
  previewPriceMap?: Record<string, number>,
  selectedWarehouseId?: string,
  selectedWarehouseName?: string,
  estimatedDeliveryDays?: number | string,
  isLocal?: boolean,
) {
  const items: Array<{ cart: CartItem; quote: QuoteCartItem }> = [];

  Object.entries(quantityMap).forEach(([variantId, quantity]) => {
    if (quantity <= 0) return;
    const variant = variants.find((entry) => entry.id === variantId);
    const price = priceMap[variantId];
    if (!variant || !price || price.sellingPrice <= 0) return;

    const availableStock = variant.warehouseInventories
      ? variant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
      : (variant.inventory?.available ?? 0);
    const isOutOfStock = availableStock <= 0;
    if (isOutOfStock) return;

    const base = {
      productId: apiProduct.id,
      productSlug: apiProduct.slug,
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

    let finalWarehouseId = selectedWarehouseId;
    let finalWarehouseName = selectedWarehouseName;
    let finalIsLocal = isLocal;
    let finalEstimatedDeliveryDays = estimatedDeliveryDays;

    if (variant.warehouseInventories && variant.warehouseInventories.length > 0) {
      const inSelected = variant.warehouseInventories.find(
        (inv) => inv.warehouseId === (selectedWarehouseId || null) && inv.available >= quantity
      );
      if (inSelected) {
        finalWarehouseId = inSelected.warehouseId ?? undefined;
      } else {
        const inDefault = variant.warehouseInventories.find((inv) => inv.warehouseId === null && inv.available >= quantity);
        if (inDefault) {
          finalWarehouseId = undefined;
          finalWarehouseName = "Default Seller";
        } else {
          const anyOther = variant.warehouseInventories.find((inv) => inv.available >= quantity);
          if (anyOther) {
            finalWarehouseId = anyOther.warehouseId ?? undefined;
            if (finalWarehouseId) {
              const wh = warehouses.find((w) => w.id === finalWarehouseId);
              finalWarehouseName = wh ? wh.name : "Unknown Warehouse";
              finalIsLocal = wh ? wh.isLocal : isLocal;
              finalEstimatedDeliveryDays = wh?.estimatedDeliveryDays ?? estimatedDeliveryDays;
            } else {
              finalWarehouseName = "Default Seller";
            }
          } else {
             const fallback = variant.warehouseInventories.find((inv) => inv.available > 0);
             if (fallback) {
                finalWarehouseId = fallback.warehouseId ?? undefined;
                if (finalWarehouseId) {
                  const wh = warehouses.find((w) => w.id === finalWarehouseId);
                  finalWarehouseName = wh ? wh.name : "Unknown Warehouse";
                  finalIsLocal = wh ? wh.isLocal : isLocal;
                  finalEstimatedDeliveryDays = wh?.estimatedDeliveryDays ?? estimatedDeliveryDays;
                } else {
                  finalWarehouseName = "Default Seller";
                }
             }
          }
        }
      }
    }

    items.push({
      cart: {
        ...base,
        productSlug: apiProduct.slug,
        countryCode: price.countryCode,
        countryName: price.countryName,
        warehouseId: finalWarehouseId,
        warehouseName: finalWarehouseName,
        estimatedDeliveryDays: finalEstimatedDeliveryDays,
        isLocalWarehouse: finalIsLocal,
      },
      quote: {
        ...base,
        warehouseId: finalWarehouseId,
        warehouseName: finalWarehouseName,
        estimatedDeliveryDays: finalEstimatedDeliveryDays,
        isLocalWarehouse: finalIsLocal,
      },
    });
  });

  return items;
}

export function DynamicVariantMatrixConfigurator({
  apiProduct,
}: DynamicVariantMatrixConfiguratorProps) {
  const { selectedCurrency, selectedCountryCode } = useCurrencyContext();
  const { addItems: addCartItems, openCart } = useCart();
  const { addItems: addQuoteItems } = useQuoteCart();
  const { open } = useQuoteCartUI();

  const { currentCustomer, isLoading } = useCustomerAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const { selectedAddress } = useDeliveryAddress();

  const { data: warehouses, isLoading: isWarehousesLoading } = useProductWarehouses(
    apiProduct.slug,
    undefined,
    selectedAddress?.state
  );
  
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [userSelected, setUserSelected] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);

  useEffect(() => {
    setUserSelected(false);
  }, [selectedAddress?.state]);

  // Allow selectedWarehouseId to remain null by default (Base Inventory).
  // If user wants a specific warehouse, they can select it via the UI.

  const selectedWarehouse = warehouses?.find(w => w.id === selectedWarehouseId);

  const attributes = useMemo<ProductOptionAttribute[]>(
    () =>
      [...apiProduct.attributes]
        .map((attribute) => ({
          ...attribute,
          values: [...(attribute.values ?? [])].sort(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              left.value.localeCompare(right.value),
          ),
        }))
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name),
        ),
    [apiProduct.attributes],
  );

  const xAxisAttributes = attributes.filter(
    (attribute) => getAttributeDisplayType(attribute) === "X_GRID",
  );
  const yAxisAttributes = attributes.filter(
    (attribute) => getAttributeDisplayType(attribute) === "Y_GRID",
  );
  const rowAxisAttributes = yAxisAttributes;
  const matrixEnabled = Boolean(
    xAxisAttributes.length && yAxisAttributes.length,
  );
  const dropdownAttributes = matrixEnabled
    ? attributes.filter(
        (attribute) =>
          !xAxisAttributes.some((axis) => axis.id === attribute.id) &&
          !yAxisAttributes.some((axis) => axis.id === attribute.id),
      )
    : attributes;
  const rowCombinations = buildAxisCombinations(rowAxisAttributes);
  const columnCombinations = buildAxisCombinations(xAxisAttributes);

  const normalizedVariants = useMemo<NormalizedVariant[]>(
    () =>
      apiProduct.variants.map((variant) => ({
        ...variant,
        selectionByAttributeId: normalizeVariantSelections(attributes, variant),
      })),
    [apiProduct.variants, attributes],
  );

  const [dropdownSelections, setDropdownSelections] = useState<
    Record<string, string>
  >(() =>
    buildInitialDropdownSelections(dropdownAttributes, normalizedVariants),
  );
  const packageOptions = useMemo(
    () =>
      Array.from(
        new Map(
          normalizedVariants
            .filter((variant) => variant.package)
            .map((variant) => [
              variant.package!.id,
              { id: variant.package!.id, title: variant.package!.title },
            ]),
        ).values(),
      ),
    [normalizedVariants],
  );
  const filterControlCount = dropdownAttributes.length;
  const [selectedPackageId, setSelectedPackageId] = useState(
    () => packageOptions[0]?.id ?? "",
  );
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [previewPriceMap, setPreviewPriceMap] = useState<
    Record<string, number>
  >({});
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const variantPriceMap = useMemo(() => {
    const map: Record<string, ApiProductPrice | null> = {};
    for (const variant of normalizedVariants) {
      map[variant.id] = getPriceForCurrency(
        variant,
        selectedCurrency,
        apiProduct.prices,
      );
    }
    return map;
  }, [apiProduct.prices, normalizedVariants, selectedCurrency]);

  const variantLookup = useMemo(() => {
    const map = new Map<string, NormalizedVariant | null>();
    for (const variant of normalizedVariants) {
      const key = buildVariantLookupKey(
        variant.selectionByAttributeId,
        variant.package?.id,
      );
      if (map.has(key)) {
        map.set(key, null);
      } else {
        map.set(key, variant);
      }
    }
    return map;
  }, [normalizedVariants]);

  const filteredVariants = normalizedVariants.filter(
    (variant) =>
      (packageOptions.length <= 1 ||
        (variant.package?.id ?? "") === selectedPackageId) &&
      dropdownAttributes.every((attribute) => {
        const selectedValueId = dropdownSelections[attribute.id];
        return (
          !selectedValueId ||
          variant.selectionByAttributeId[attribute.id] === selectedValueId
        );
      }),
  );

  const activeRowCombinations = useMemo(() => {
    return rowCombinations.filter((rc) => {
      return columnCombinations.some((cc) => {
        const key = buildVariantLookupKey(
          {
            ...dropdownSelections,
            ...rc.selection,
            ...cc.selection,
          },
          selectedPackageId,
        );
        return variantLookup.has(key) && variantLookup.get(key) !== null;
      });
    });
  }, [rowCombinations, columnCombinations, dropdownSelections, selectedPackageId, variantLookup]);

  const activeColumnCombinations = useMemo(() => {
    return columnCombinations.filter((cc) => {
      return activeRowCombinations.some((rc) => {
        const key = buildVariantLookupKey(
          {
            ...dropdownSelections,
            ...rc.selection,
            ...cc.selection,
          },
          selectedPackageId,
        );
        return variantLookup.has(key) && variantLookup.get(key) !== null;
      });
    });
  }, [columnCombinations, activeRowCombinations, dropdownSelections, selectedPackageId, variantLookup]);

  const selectedEntries = useMemo(
    () =>
      Object.entries(quantityMap)
        .filter(([, quantity]) => quantity > 0)
        .map(([variantId, quantity]) => {
          const variant = normalizedVariants.find(
            (entry) => entry.id === variantId,
          );
          const price = variant ? variantPriceMap[variant.id] : null;
          return variant && price
            ? {
                variant,
                quantity,
                price,
                resolvedUnitPrice:
                  previewPriceMap[variant.id] ?? price.sellingPrice,
                total:
                  (previewPriceMap[variant.id] ?? price.sellingPrice) *
                  quantity,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [normalizedVariants, previewPriceMap, quantityMap, variantPriceMap],
  );

  useEffect(() => {
    if (userSelected || selectedEntries.length === 0 || !warehouses) return;

    let allCurrentCanFulfill = true;
    let fallbackWarehouseId: string | undefined = undefined;

    for (const entry of selectedEntries) {
      const v = entry.variant;
      const invs = v.warehouseInventories || [];
      const currentInv = invs.find((inv) => inv.warehouseId === (selectedWarehouseId || null));
      if (!currentInv || currentInv.available < entry.quantity) {
        allCurrentCanFulfill = false;
        const alternative = invs.find((inv) => inv.available >= entry.quantity);
        if (alternative && alternative.warehouseId) {
          fallbackWarehouseId = alternative.warehouseId;
        }
        break;
      }
    }

    if (!allCurrentCanFulfill && fallbackWarehouseId && fallbackWarehouseId !== selectedWarehouseId) {
      setSelectedWarehouseId(fallbackWarehouseId);
    }
  }, [selectedEntries, userSelected, selectedWarehouseId, warehouses]);

  const totals = useMemo(() => {
    const totalUnits = selectedEntries.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );
    const subtotal = selectedEntries.reduce(
      (sum, entry) => sum + entry.total,
      0,
    );
    const currencySymbol =
      selectedEntries[0]?.price.currencySymbol ??
      variantPriceMap[normalizedVariants[0]?.id ?? ""]?.currencySymbol ??
      (selectedCurrency === "USD"
        ? "$"
        : selectedCurrency === "EUR"
          ? "€"
          : selectedCurrency === "GBP"
            ? "£"
            : "₹");
    return { totalUnits, subtotal, currencySymbol };
  }, [normalizedVariants, selectedEntries, variantPriceMap]);

  const handleDropdownChange = (attributeId: string, valueId: string) => {
    setDropdownSelections((current) => ({
      ...current,
      [attributeId]: valueId,
    }));
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

  const handleAddSelectedToCart = (isBuyNow = false) => {
    const items = buildCartItems(
      apiProduct,
      normalizedVariants,
      quantityMap,
      variantPriceMap,
      warehouses || [],
      previewPriceMap,
      selectedWarehouse?.id,
      selectedWarehouse?.name,
      selectedWarehouse?.estimatedDeliveryDays,
      selectedWarehouse?.isLocal,
    );
    if (!items.length) {
      setFeedback({
        kind: "error",
        message: "Enter quantity for at least one available variant.",
      });
      return;
    }

    addCartItems(items.map((item) => item.cart));
    
    if (isBuyNow) {
      router.push("/checkout");
    } else {
      openCart();
      setQuantityMap({});
      setFeedback({
        kind: "success",
        message: `${items.length} variant line${items.length === 1 ? "" : "s"} added to cart.`,
      });
    }
  };

  const handleAddSelectedToQuote = () => {
    const items = buildCartItems(
      apiProduct,
      normalizedVariants,
      quantityMap,
      variantPriceMap,
      warehouses || [],
      previewPriceMap,
      selectedWarehouse?.id,
      selectedWarehouse?.name,
      selectedWarehouse?.estimatedDeliveryDays,
      selectedWarehouse?.isLocal,
    );
    if (!items.length) {
      setFeedback({
        kind: "error",
        message: "Enter quantity for at least one available variant.",
      });
      return;
    }

    if (isLoading) return;

    if (!currentCustomer) {
      showToast({
        title: "Sign in required",
        message: "Please sign in to add products to your quote request.",
        type: "info",
      });

      router.push(
        `/login?returnTo=${encodeURIComponent(window.location.pathname)}`,
      );

      return;
    }

    addQuoteItems(items.map((item) => item.quote));

    open();

    setQuantityMap({});

    setFeedback({
      kind: "success",
      message: `${items.length} variant line${items.length === 1 ? "" : "s"} added to quote.`,
    });
  };

  useEffect(() => {
    const previewItems = apiProduct.variants.map((v) => ({ variantId: v.id, quantity: 1 }));

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
            params: selectedCountryCode
              ? { countryCode: selectedCountryCode }
              : undefined,
            headers: customerToken
              ? { Authorization: `Bearer ${customerToken}` }
              : undefined,
          },
        );

        if (!active) return;

        const previews = (response.data.data ?? []) as Array<{
          variantId: string;
          unitPrice: number;
        }>;
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
  }, [apiProduct.slug, apiProduct.variants, quantityMap, selectedCountryCode, currentCustomer]);

  if (!matrixEnabled) return null;

  return (
    <section className="pt-16">
      <div className="rounded-lg border border-line bg-white p-6 sm:p-7">
        <div className="mb-6 flex flex-col gap-2 border-b border-line pb-5">
          <h2 className="text-[clamp(24px,2.8vw,32px)] font-normal tracking-tight text-ink">
            Order Multiple Variants In One Step
          </h2>
          <p className="max-w-[760px] text-[14.5px] leading-relaxed text-steel">
            Use the matrix below to enter quantities across multiple variant
            combinations, then add every selected line to cart or quote in one
            action.
          </p>
        </div>

        <div className="space-y-6">
          <div className="min-w-0 space-y-5">
            {packageOptions.length > 1 && (
              <div className="rounded-lg border border-line bg-offwhite p-2">
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                  Package
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Package"
                >
                  {packageOptions.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedPackageId === pkg.id}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`rounded-md px-5 py-2.5 text-[13px] font-semibold transition ${selectedPackageId === pkg.id ? "bg-brand text-white shadow-sm" : "border border-line bg-white text-ink hover:border-brand/40 hover:text-brand"}`}
                    >
                      {pkg.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dropdownAttributes.length > 0 && (
              <div
                className={`grid gap-4 ${filterControlCount > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}
              >
                {dropdownAttributes.map((attribute) => {
                  const selectedValueId =
                    dropdownSelections[attribute.id] ?? "";
                  return (
                    <label
                      key={attribute.id}
                      className="block rounded-lg border border-line bg-offwhite p-4"
                    >
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                        {attribute.name}
                      </span>
                      <select
                        value={selectedValueId}
                        onChange={(event) =>
                          handleDropdownChange(attribute.id, event.target.value)
                        }
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

            <div className="overflow-hidden rounded-lg border border-line bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-[#F8F9FA]">
                      <th className="sticky left-0 z-20 border-r border-line bg-[#F1F3F5] px-1.5 py-1 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                        <span className="text-brand">
                          {rowAxisAttributes.map((a) => a.name).join(" + ") || "Size"}
                        </span>
                        <span className="mx-1 text-steel-2">/</span>
                        <span className="text-steel">
                          {xAxisAttributes.map((a) => a.name).join(" + ")}
                        </span>
                      </th>
                      {activeColumnCombinations.map((columnCombination) => {
                        const headerText = columnCombination.labels
                          .map((l) => l.value.value)
                          .join(" • ");
                        return (
                          <th
                            key={columnCombination.key}
                            className="min-w-[65px] border-r border-line bg-[#F8F9FA] px-1 py-1 text-center text-[10px] font-bold text-ink last:border-r-0"
                          >
                            <div className="inline-flex flex-col items-center">
                              <span className="rounded-md bg-red-50 px-1 py-0.5 text-[9.5px] font-bold text-brand border border-red-100/60 leading-tight">
                                {headerText}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRowCombinations.map((rowCombination) => (
                      <tr
                        key={rowCombination.key}
                        className="border-b border-line hover:bg-slate-50/50 transition-colors last:border-b-0"
                      >
                        <th className="sticky left-0 z-10 border-r border-line bg-[#F8F9FA] px-1.5 py-1.5 text-left font-bold text-ink text-[10.5px] whitespace-nowrap shadow-xs">
                          {rowCombination.labels.map((l) => l.value.value).join(" • ") || "All"}
                        </th>
                        {activeColumnCombinations.map((columnCombination) => {
                          const variant = variantLookup.get(
                            buildVariantLookupKey(
                              {
                                ...dropdownSelections,
                                ...rowCombination.selection,
                                ...columnCombination.selection,
                              },
                              selectedPackageId,
                            ),
                          );
                          const price = variant
                            ? variantPriceMap[variant.id]
                            : null;
                          const availableStock = variant?.warehouseInventories
                            ? variant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
                            : (variant?.inventory?.available ?? 0);
                          const outOfStock =
                            !variant || availableStock === 0;
                          const quantity = variant
                            ? (quantityMap[variant.id] ?? 0)
                            : 0;
                          const minPositive = Math.max(1, variant?.moq ?? 1);
                          const displayUnitPrice =
                            variant && price
                              ? (previewPriceMap[variant.id] ?? price.sellingPrice)
                              : null;
                          const isPor = !price || price.sellingPrice <= 0;

                          return (
                            <td
                              key={columnCombination.key}
                              className="align-middle border-r border-line px-1 py-1 text-center last:border-r-0"
                            >
                              {variant ? (
                                <div
                                  className={`mx-auto flex flex-col items-center justify-center rounded-md p-0.5 transition-all ${
                                    quantity > 0
                                      ? "bg-red-50/70 ring-1 ring-brand/30"
                                      : "bg-white"
                                  } ${outOfStock || isPor ? "opacity-60" : ""}`}
                                >
                                  <QuantityInput
                                    size="xs"
                                    value={quantity}
                                    onChange={(nextQuantity) =>
                                      handleQuantityChange(
                                        variant.id,
                                        nextQuantity,
                                      )
                                    }
                                    min={0}
                                    max={availableStock}
                                    minPositive={minPositive}
                                    disabled={outOfStock || isPor}
                                  />
                                  <div className="mt-1.5 text-center">
                                    <p className="text-[10px] font-bold text-ink">
                                      {isPor ? (
                                        <span className="text-[10.5px] font-semibold text-brand">
                                          Price Upon Request
                                        </span>
                                      ) : price && displayUnitPrice != null ? (
                                        formatMoney(
                                          price.currencySymbol,
                                          displayUnitPrice,
                                        )
                                      ) : (
                                        "N/A"
                                      )}
                                    </p>
                                    {outOfStock ? (
                                      <span className="text-[10px] font-semibold text-red-500">
                                        Out of stock
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="py-2 text-center text-[11px] font-medium text-steel-2">
                                  
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
                <p className="text-[13px]">
                  The selected dropdown filters do not match any active variants
                  for this product.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 items-start">
            <div className="rounded-lg border border-line bg-offwhite p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-brand">
                  <Layers3 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                    Selected Variants
                  </p>
                  <p className="text-[14px] text-steel">
                    {selectedEntries.length
                      ? `${selectedEntries.length} line${selectedEntries.length === 1 ? "" : "s"} ready`
                      : "Nothing selected yet"}
                  </p>
                </div>
              </div>

              {selectedEntries.length ? (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedEntries.map((entry) => (
                    <div
                      key={entry.variant.id}
                      className="rounded-lg border border-line bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13.5px] font-semibold text-ink">
                            {entry.variant.title}
                          </p>
                          <p className="mt-1 text-[12px] text-steel">
                            {entry.quantity} x{" "}
                            {formatMoney(
                              entry.price.currencySymbol,
                              entry.resolvedUnitPrice,
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(entry.variant.id, 0)
                          }
                          aria-label={`Remove ${entry.variant.title}`}
                          title="Remove variant"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-100 text-brand transition hover:border-red-200 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-white px-4 py-6 text-[13px] leading-relaxed text-steel">
                  Enter quantities directly in the matrix to stage multiple
                  variants at once.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                Order Summary
              </p>
              <div className="mt-4 space-y-2 text-[14px] text-steel">
                <div className="flex items-center justify-between">
                  <span>Variant lines</span>
                  <span className="font-semibold text-ink">
                    {selectedEntries.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total units</span>
                  <span className="font-semibold text-ink">
                    {totals.totalUnits}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3 text-[16px]">
                  <span className="font-semibold text-ink">Subtotal</span>
                  <span className="font-semibold text-ink">
                    {formatMoney(totals.currencySymbol, totals.subtotal)}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleAddSelectedToCart(false)}
                    disabled={selectedEntries.length === 0}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill bg-[#1a1a1a] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:bg-[#F0F0F0] disabled:text-[#9A9A9A]"
                  >
                    <ShoppingBag size={15} />
                    {selectedEntries.length === 0 ? "Select Variants" : "Add To Cart"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSelectedToCart(true)}
                    disabled={selectedEntries.length === 0}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill bg-brand px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-[#F0F0F0] disabled:text-[#9A9A9A]"
                  >
                    Buy Now
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddSelectedToQuote}
                  disabled={selectedEntries.length === 0}
                  className="inline-flex w-full items-center justify-center rounded-pill border border-line bg-offwhite px-5 py-3 text-[13px] font-semibold text-ink transition hover:border-steel-2 hover:bg-white hover:text-brand disabled:cursor-not-allowed disabled:border-line disabled:bg-[#F0F0F0] disabled:text-[#9A9A9A]"
                >
                  {selectedEntries.length === 0 ? "Select Variants" : "Add Selected To Quote"}
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
          </div>
        </div>
      </div>
    </section>
  );
}
