"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Info,
  Layers3,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { useQuoteCartUI } from "@/contexts/QuoteCartUIContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";
import { apiClient } from "@/lib/apiClient";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { useTrackingSettings } from "@/hooks/api/useTrackingSettings";
import { useProductWarehouses } from "@/hooks/api/useProducts";
import { WarehouseSelectorModal } from "./WarehouseSelectorModal";
import { QuantityInput } from "./QuantityInput";
import { StockBadge } from "./StockBadge";
import { WishlistButton } from "./WishlistButton";
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
type ProductOptionAttribute = ApiAttribute & { values: ApiAttributeValue[]; visibleOnStorefront?: boolean };
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
    variant.prices[0] ??
    productPrices[0] ??
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
    .filter(([_, valueId]) => Boolean(valueId))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([attributeId, valueId]) => `${attributeId}:${valueId}`)
    .join("|");
}

function buildVariantLookupKey(
  selectionByAttributeId: Record<string, string>,
  packageId?: string | null,
) {
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(selectionByAttributeId)) {
    if (v) payload[k] = v;
  }
  if (packageId) payload.__package = packageId;
  return buildSelectionKey(payload);
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
    const selectedLabel = variant.attributeCombination?.[attribute.name];
    if (selectedLabel) {
      const matchedValue = attribute.values.find(
        (value) => value.value.toLowerCase() === selectedLabel.toLowerCase(),
      );
      if (matchedValue) {
        fallback[attribute.id] = matchedValue.id;
        continue;
      }
    }

    if (variant.title) {
      const titleSegments = variant.title.split("/").map((s) => s.trim().toLowerCase());
      const matchedValue = attribute.values.find((value) =>
        titleSegments.includes(value.value.toLowerCase())
      );
      if (matchedValue) {
        fallback[attribute.id] = matchedValue.id;
      }
    }
  }
  return fallback;
}

function buildInitialDropdownSelections(
  attributes: ProductOptionAttribute[],
  variants: NormalizedVariant[],
) {
  return attributes.reduce<Record<string, string>>((acc, attribute) => {
    acc[attribute.id] = "";
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
    const defaultSellerName = (warehouses || []).find((w: any) => w.id === "default")?.name || "Modern Orthodontics Pvt Ltd";

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
          finalWarehouseName = defaultSellerName;
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
              finalWarehouseName = defaultSellerName;
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
                  finalWarehouseName = defaultSellerName;
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
  const { t } = useStaticTranslations();
  const { data: trackingSettings } = useTrackingSettings(selectedCountryCode);
  const isQuoteAllowed = (trackingSettings?.general?.allowQuotes !== false) && (apiProduct.allowQuote !== false);

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
      [...apiProduct.attributes].map((attribute) => ({
        ...attribute,
        values: [...(attribute.values ?? [])].sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.value.localeCompare(right.value),
        ),
      })),
    [apiProduct.attributes],
  );

  const normalizedVariants = useMemo<NormalizedVariant[]>(
    () =>
      apiProduct.variants.map((variant) => ({
        ...variant,
        selectionByAttributeId: normalizeVariantSelections(attributes, variant),
      })),
    [apiProduct.variants, attributes],
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

  const [selectedPackageId, setSelectedPackageId] = useState(
    () => packageOptions[0]?.id ?? "",
  );

  const baseVariants = useMemo(() => {
    return normalizedVariants.filter(
      (variant) =>
        packageOptions.length <= 1 ||
        (variant.package?.id ?? "") === selectedPackageId,
    );
  }, [normalizedVariants, packageOptions.length, selectedPackageId]);

  const hasConfiguredGridAxis = useMemo(
    () => attributes.some((a) => a.gridAxis === "COLUMN" || a.gridAxis === "ROW"),
    [attributes],
  );

  const gridRowAttributeIds = useMemo(
    () =>
      new Set(
        attributes
          .filter(
            (attribute) =>
              attribute.gridAxis === "ROW" ||
              (!hasConfiguredGridAxis &&
                attribute.gridAxis === undefined &&
                getAttributeDisplayType(attribute) === "Y_GRID"),
          )
          .map((a) => a.id),
      ),
    [attributes, hasConfiguredGridAxis],
  );

  const gridColAttributeIds = useMemo(
    () =>
      new Set(
        attributes
          .filter(
            (attribute) =>
              attribute.gridAxis === "COLUMN" ||
              (!hasConfiguredGridAxis &&
                attribute.gridAxis === undefined &&
                getAttributeDisplayType(attribute) === "X_GRID"),
          )
          .map((a) => a.id),
      ),
    [attributes, hasConfiguredGridAxis],
  );

  const candidateDropdownAttributes = useMemo(
    () =>
      attributes.filter(
        (a) =>
          !gridRowAttributeIds.has(a.id) &&
          !gridColAttributeIds.has(a.id) &&
          a.visibleOnStorefront !== false,
      ),
    [attributes, gridRowAttributeIds, gridColAttributeIds],
  );

  const [dropdownSelections, setDropdownSelections] = useState<
    Record<string, string>
  >(() =>
    buildInitialDropdownSelections(candidateDropdownAttributes, normalizedVariants),
  );

  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [dropdownQuantity, setDropdownQuantity] = useState<number>(1);
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

  const activeDropdownInfo = useMemo(() => {
    const activeList: Array<{
      attribute: ProductOptionAttribute;
      availableValues: ApiAttributeValue[];
    }> = [];

    let currentVariants = baseVariants;

    for (const attr of candidateDropdownAttributes) {
      const availableValueIds = new Set(
        currentVariants
          .map((v) => v.selectionByAttributeId[attr.id])
          .filter((val): val is string => Boolean(val)),
      );

      if (availableValueIds.size > 0) {
        const availableValues = attr.values.filter((v) =>
          availableValueIds.has(v.id),
        );
        activeList.push({ attribute: attr, availableValues });

        const selectedValId = dropdownSelections[attr.id];
        if (selectedValId && availableValueIds.has(selectedValId)) {
          currentVariants = currentVariants.filter(
            (v) => v.selectionByAttributeId[attr.id] === selectedValId,
          );
        }
      }
    }

    return {
      activeDropdownAttributes: activeList.map((item) => item.attribute),
      availableValuesByAttributeId: new Map(
        activeList.map((item) => [item.attribute.id, item.availableValues]),
      ),
    };
  }, [baseVariants, candidateDropdownAttributes, dropdownSelections]);

  const dropdownAttributes = activeDropdownInfo.activeDropdownAttributes;
  const filterControlCount = dropdownAttributes.length;

  const allDropdownsSelected = useMemo(() => {
    return (
      dropdownAttributes.length === 0 ||
      dropdownAttributes.every((attribute) => Boolean(dropdownSelections[attribute.id]))
    );
  }, [dropdownAttributes, dropdownSelections]);

  const filteredVariants = useMemo(() => {
    return baseVariants.filter((variant) =>
      dropdownAttributes.every((attribute) => {
        const selectedValueId = dropdownSelections[attribute.id];
        return (
          !selectedValueId ||
          variant.selectionByAttributeId[attribute.id] === selectedValueId
        );
      }),
    );
  }, [baseVariants, dropdownAttributes, dropdownSelections]);

  const activeRowAttributes = useMemo(() => {
    return attributes
      .filter(
        (a) =>
          gridRowAttributeIds.has(a.id) &&
          filteredVariants.some((v) => Boolean(v.selectionByAttributeId[a.id])),
      )
      .map((a) => {
        const presentValueIds = new Set(
          filteredVariants
            .map((v) => v.selectionByAttributeId[a.id])
            .filter((val): val is string => Boolean(val)),
        );
        return {
          ...a,
          values: a.values.filter((v) => presentValueIds.has(v.id)),
        };
      });
  }, [attributes, gridRowAttributeIds, filteredVariants]);

  const activeColumnAttributes = useMemo(() => {
    return attributes
      .filter(
        (a) =>
          gridColAttributeIds.has(a.id) &&
          filteredVariants.some((v) => Boolean(v.selectionByAttributeId[a.id])),
      )
      .map((a) => {
        const presentValueIds = new Set(
          filteredVariants
            .map((v) => v.selectionByAttributeId[a.id])
            .filter((val): val is string => Boolean(val)),
        );
        return {
          ...a,
          values: a.values.filter((v) => presentValueIds.has(v.id)),
        };
      });
  }, [attributes, gridColAttributeIds, filteredVariants]);

  const rowAxisAttributes = activeRowAttributes;
  const xAxisAttributes = activeColumnAttributes;
  const yAxisAttributes = activeRowAttributes;

  const matrixEnabled = Boolean(
    activeRowAttributes.length && activeColumnAttributes.length,
  );

  const rowCombinations = useMemo(
    () => (matrixEnabled ? buildAxisCombinations(activeRowAttributes) : []),
    [matrixEnabled, activeRowAttributes],
  );

  const columnCombinations = useMemo(
    () => (matrixEnabled ? buildAxisCombinations(activeColumnAttributes) : []),
    [matrixEnabled, activeColumnAttributes],
  );

  const activeRowCombinations = useMemo(() => {
    if (!allDropdownsSelected || !matrixEnabled) return [];
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
  }, [allDropdownsSelected, matrixEnabled, rowCombinations, columnCombinations, dropdownSelections, selectedPackageId, variantLookup]);

  const activeColumnCombinations = useMemo(() => {
    if (!allDropdownsSelected || !matrixEnabled) return [];
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
  }, [allDropdownsSelected, matrixEnabled, columnCombinations, activeRowCombinations, dropdownSelections, selectedPackageId, variantLookup]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingTableScroll = useRef(false);
  const isSyncingStickyScroll = useRef(false);

  const [isSticky, setIsSticky] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(112);
  const [containerBounds, setContainerBounds] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [tableWidth, setTableWidth] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const handleTableScroll = () => {
    if (isSyncingStickyScroll.current) return;
    if (!tableScrollRef.current || !stickyScrollRef.current) return;
    isSyncingTableScroll.current = true;
    stickyScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingTableScroll.current = false;
    });
  };

  const handleStickyScroll = () => {
    if (isSyncingTableScroll.current) return;
    if (!tableScrollRef.current || !stickyScrollRef.current) return;
    isSyncingStickyScroll.current = true;
    tableScrollRef.current.scrollLeft = stickyScrollRef.current.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingStickyScroll.current = false;
    });
  };

  useEffect(() => {
    if (!matrixEnabled || activeRowCombinations.length === 0 || activeColumnCombinations.length === 0) {
      setIsSticky(false);
      return;
    }

    const updateSticky = () => {
      const container = tableContainerRef.current;
      const table = tableRef.current;
      if (!container || !table) {
        setIsSticky(false);
        return;
      }

      const navbar = document.querySelector("header");
      const navHeight = navbar ? navbar.getBoundingClientRect().height : 112;
      setHeaderOffset(navHeight);

      const containerRect = container.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const thead = table.querySelector("thead");
      const headerHeight = thead ? thead.getBoundingClientRect().height : 48;

      const isPastTop = containerRect.top <= navHeight;
      const isBeforeBottom = tableRect.bottom >= navHeight + headerHeight;

      if (isPastTop && isBeforeBottom) {
        setIsSticky(true);
        setContainerBounds({
          left: containerRect.left,
          width: containerRect.width,
        });
        setTableWidth(tableRect.width);

        const thElements = table.querySelectorAll("thead th");
        if (thElements.length > 0) {
          setColumnWidths(Array.from(thElements).map((th) => th.getBoundingClientRect().width));
        }

        if (stickyScrollRef.current && tableScrollRef.current) {
          stickyScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
      } else {
        setIsSticky(false);
      }
    };

    let rafId: number | null = null;
    const onScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        updateSticky();
        rafId = null;
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    updateSticky();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [matrixEnabled, activeRowCombinations.length, activeColumnCombinations.length]);

  useEffect(() => {
    if (isSticky && stickyScrollRef.current && tableScrollRef.current) {
      stickyScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }, [isSticky]);


  const singleResolvedVariant = useMemo<NormalizedVariant | null>(() => {
    if (!allDropdownsSelected) return null;
    if (matrixEnabled && activeRowCombinations.length > 0 && activeColumnCombinations.length > 0) return null;
    if (filteredVariants.length === 1) return filteredVariants[0];

    // Check if there is a variant that specifically does not require X/Y grid attributes
    const exactDropdownMatch = filteredVariants.find((v) => {
      const hasX = activeColumnAttributes.some((x) => Boolean(v.selectionByAttributeId[x.id]));
      const hasY = activeRowAttributes.some((y) => Boolean(v.selectionByAttributeId[y.id]));
      return !hasX && !hasY;
    });
    return exactDropdownMatch ?? null;
  }, [allDropdownsSelected, matrixEnabled, activeRowCombinations.length, activeColumnCombinations.length, filteredVariants, activeColumnAttributes, activeRowAttributes]);

  const singleResolvedPrice = singleResolvedVariant
    ? variantPriceMap[singleResolvedVariant.id] ?? null
    : null;

  const singleResolvedUnitPrice = singleResolvedVariant && singleResolvedPrice
    ? (previewPriceMap[singleResolvedVariant.id] ?? singleResolvedPrice.sellingPrice)
    : 0;

  const singleResolvedAvailableStock = singleResolvedVariant
    ? (singleResolvedVariant.warehouseInventories?.length
        ? singleResolvedVariant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
        : (singleResolvedVariant.inventory?.available ?? 0))
    : 0;

  const isSingleOutOfStock = singleResolvedVariant
    ? singleResolvedAvailableStock <= 0
    : false;

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
    if (selectedEntries.length > 0) {
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
    }

    const currencySymbol =
      variantPriceMap[normalizedVariants[0]?.id ?? ""]?.currencySymbol ??
      (selectedCurrency === "USD"
        ? "$"
        : selectedCurrency === "EUR"
          ? "€"
          : selectedCurrency === "GBP"
            ? "£"
            : "₹");
    return { totalUnits: 0, subtotal: 0, currencySymbol };
  }, [
    normalizedVariants,
    selectedCurrency,
    selectedEntries,
    variantPriceMap,
  ]);

  function getAvailableValuesForDropdownAttribute(
    attribute: ProductOptionAttribute,
    _attrIndex?: number,
  ) {
    return (
      activeDropdownInfo.availableValuesByAttributeId.get(attribute.id) ??
      attribute.values
    );
  }

  const handleDropdownChange = (attributeId: string, valueId: string) => {
    const attrIndex = dropdownAttributes.findIndex((a) => a.id === attributeId);
    const nextSelections: Record<string, string> = {};

    for (let i = 0; i < attrIndex; i++) {
      const id = dropdownAttributes[i].id;
      if (dropdownSelections[id]) {
        nextSelections[id] = dropdownSelections[id];
      }
    }

    if (valueId) {
      nextSelections[attributeId] = valueId;
    }

    let currentVariants = baseVariants;
    for (const [k, v] of Object.entries(nextSelections)) {
      if (v) {
        currentVariants = currentVariants.filter(
          (variant) => variant.selectionByAttributeId[k] === v,
        );
      }
    }

    for (let i = attrIndex + 1; i < dropdownAttributes.length; i++) {
      const downstreamAttr = dropdownAttributes[i];
      const availableDownstreamValueIds = new Set(
        currentVariants
          .map((v) => v.selectionByAttributeId[downstreamAttr.id])
          .filter((val): val is string => Boolean(val)),
      );

      const currentDownstreamValId = dropdownSelections[downstreamAttr.id];
      if (
        currentDownstreamValId &&
        availableDownstreamValueIds.has(currentDownstreamValId)
      ) {
        nextSelections[downstreamAttr.id] = currentDownstreamValId;
        currentVariants = currentVariants.filter(
          (v) => v.selectionByAttributeId[downstreamAttr.id] === currentDownstreamValId,
        );
      } else {
        nextSelections[downstreamAttr.id] = "";
      }
    }

    setDropdownSelections(nextSelections);
    setQuantityMap({});
    setFeedback(null);
  };

  const handleQuantityChange = (variantId: string, quantity: number) => {
    const variant = normalizedVariants.find((v) => v.id === variantId);
    const availableStock = variant?.warehouseInventories?.length
      ? variant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
      : (variant?.inventory?.available ?? 0);

    if (quantity > 0 && availableStock <= 0) {
      return;
    }

    setQuantityMap((current) => {
      if (quantity <= 0) {
        const next = { ...current };
        delete next[variantId];
        return next;
      }
      const capped = availableStock > 0 ? Math.min(quantity, availableStock) : 0;
      if (capped <= 0) {
        const next = { ...current };
        delete next[variantId];
        return next;
      }
      return { ...current, [variantId]: capped };
    });
    setFeedback(null);
  };

  const handleAddSelectedToCart = () => {
    let items = buildCartItems(
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
        message: !allDropdownsSelected
          ? "Please select an option in each dropdown above to continue."
          : "Enter quantity or select an available variant to continue.",
      });
      return;
    }

    addCartItems(items.map((item) => item.cart));
    openCart();
    setQuantityMap({});
    setFeedback({
      kind: "success",
      message: `${items.length} variant line${items.length === 1 ? "" : "s"} added to cart.`,
    });
  };

  const handleContinueShopping = () => {
    let items = buildCartItems(
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

    if (items.length) {
      addCartItems(items.map((item) => item.cart));
      showToast({
        title: "Added to Cart",
        message: `${items.length} variant line${items.length === 1 ? "" : "s"} added to cart.`,
        type: "success",
      });
      setQuantityMap({});
    }

    router.push("/products");
  };

  const handleAddSelectedToQuote = () => {
    let items = buildCartItems(
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
        message: !allDropdownsSelected
          ? "Please select an option in each dropdown above to continue."
          : "Enter quantity or select an available variant to continue.",
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

  if (!apiProduct.variants || apiProduct.variants.length === 0) return null;

  return (
    <section className="pt-8 sm:pt-8.5">
      <div className="mb-8 rounded-2xl border border-[#E31E24] bg-white p-4 sm:p-6 lg:p-8 shadow-sm transition-all duration-300">
        <div className="mb-5 flex flex-col gap-4 border-b border-[#E31E24]/30 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <span className="mb-2 inline-flex items-center gap-2 rounded-pill border border-[#E31E24] bg-red-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E31E24]">
              <Sparkles size={13} className="text-[#E31E24]" />
              {matrixEnabled ? t("ui.products.matrixConfiguratorBadge") : "Product Configurator"}
            </span>
            <h2 className="text-[clamp(24px,2.6vw,30px)] font-bold leading-tight tracking-tight text-[#111827]">
              {t("ui.products.matrixConfiguratorTitle")}
            </h2>
            <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-[#111827]">
              {t("ui.products.matrixConfiguratorDescription")}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="min-w-0 space-y-5">
            {packageOptions.length > 1 && (
              <div className="rounded-xl border border-[#E31E24] bg-white p-3 shadow-2xs">
                <p className="px-2 pb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#111827]">
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
                      onClick={() => {
                        setSelectedPackageId(pkg.id);
                        setDropdownSelections({});
                        setQuantityMap({});
                        setFeedback(null);
                      }}
                      className={`rounded-lg px-5 py-2.5 text-[14px] font-bold transition cursor-pointer ${selectedPackageId === pkg.id ? "bg-brand text-white shadow-xs" : "border border-[#E31E24] bg-white text-[#111827] hover:bg-red-50"}`}
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
                {dropdownAttributes.map((attribute, attrIndex) => {
                  const selectedValueId =
                    dropdownSelections[attribute.id] ?? "";
                  const availableValues = getAvailableValuesForDropdownAttribute(
                    attribute,
                    attrIndex,
                  );
                  return (
                    <label
                      key={attribute.id}
                      className="block rounded-xl border border-black bg-white p-4 shadow-2xs transition-all"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="block text-[12px] font-bold uppercase tracking-[0.12em] text-[#111827]">
                          {attribute.name}
                        </span>
                        <span className="rounded-full border border-[#E31E24] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#E31E24]">
                          {availableValues.length}{" "}
                          {availableValues.length === 1 ? "option" : "options"}
                        </span>
                      </div>
                      <select
                        value={selectedValueId}
                        onChange={(event) =>
                          handleDropdownChange(attribute.id, event.target.value)
                        }
                        className="w-full cursor-pointer rounded-lg border border-[#E31E24] bg-white px-4 py-3 text-[14.5px] font-bold text-[#111827] shadow-2xs outline-none transition focus:ring-1 focus:ring-[#E31E24]"
                      >
                        <option value="" className="text-[#111827] font-semibold">Select {attribute.name}</option>
                        {availableValues.map((value) => (
                          <option key={value.id} value={value.id} className="text-[#111827] font-semibold">
                            {value.value}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            )}

            {!allDropdownsSelected && dropdownAttributes.length > 0 && (
              <div className="rounded-xl border border-dashed border-[#E31E24] bg-red-50/20 p-6 text-center text-[14px] font-medium text-[#111827]">
                {t("ui.pdp.selectDropdownHelper")}
              </div>
            )}

            {singleResolvedVariant && (
              <div className="rounded-xl border border-[#E31E24] bg-white p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-2xs">
                        {t("ui.pdp.selectedVariant")}
                      </span>
                      <StockBadge
                        status={singleResolvedVariant.inventory?.status}
                        available={singleResolvedAvailableStock}
                      />
                    </div>
                    <h3 className="mt-1.5 text-[17px] font-bold text-[#111827]">
                      {singleResolvedVariant.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {singleResolvedVariant.sku && (
                        <span className="text-[12.5px] font-semibold text-[#111827]">
                          SKU: {singleResolvedVariant.sku}
                        </span>
                      )}
                      {selectedWarehouse && (
                        <span className="rounded-full border border-[#E31E24] bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-[#111827]">
                          {t("ui.pdp.shipsFrom", { warehouse: selectedWarehouse.name })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="sm:text-right">
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#111827]">
                        {t("ui.pdp.unitPrice")}
                      </span>
                      <p className="text-[22px] font-bold text-[#111827]">
                        {singleResolvedPrice && singleResolvedUnitPrice > 0
                          ? formatMoney(singleResolvedPrice.currencySymbol, singleResolvedUnitPrice)
                          : t("ui.pdp.priceUponRequest")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-[#111827]">Qty:</span>
                      <QuantityInput
                        size="sm"
                        value={isSingleOutOfStock ? 0 : dropdownQuantity}
                        onChange={(nextQty) => setDropdownQuantity(Math.max(1, nextQty))}
                        min={isSingleOutOfStock ? 0 : 1}
                        max={singleResolvedAvailableStock > 0 ? singleResolvedAvailableStock : 0}
                        disabled={isSingleOutOfStock}
                      />
                      {!matrixEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!singleResolvedVariant || isSingleOutOfStock) return;
                            handleQuantityChange(
                              singleResolvedVariant.id,
                              (quantityMap[singleResolvedVariant.id] || 0) + dropdownQuantity,
                            );
                            showToast({
                              title: "Variant Added",
                              message: `${singleResolvedVariant.title} added to selection.`,
                              type: "success",
                            });
                          }}
                          disabled={isSingleOutOfStock}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E31E24] bg-red-50 hover:bg-[#E31E24] hover:text-white px-3 py-1.5 text-[12.5px] font-bold text-[#E31E24] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} />
                          Add to Selection
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {matrixEnabled && activeRowCombinations.length > 0 && activeColumnCombinations.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] sm:text-[14px] font-bold uppercase tracking-[0.1em] text-[#111827]">
                    {t("ui.pdp.matrixGridTitle")}
                  </span>
                  <span className="text-[12px] font-medium text-[#4B5563]">
                    {t("ui.pdp.matrixGridSubtitle")}
                  </span>
                </div>
                {isSticky && (
                  <div
                    style={{
                      position: "fixed",
                      top: headerOffset,
                      left: containerBounds.left,
                      width: containerBounds.width,
                      zIndex: 40,
                    }}
                    className="overflow-hidden rounded-t-xl border-x border-t border-b border-[#E31E24] bg-[#FFFBFB] shadow-[0_4px_14px_rgba(227,30,36,0.12)]"
                  >
                    <div
                      ref={stickyScrollRef}
                      className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      onScroll={handleStickyScroll}
                    >
                      <table
                        className="border-collapse text-left"
                        style={{
                          width: tableWidth ? `${tableWidth}px` : "100%",
                          minWidth: tableWidth ? `${tableWidth}px` : "100%",
                        }}
                      >
                        <thead>
                          <tr className="bg-[#FFFBFB]">
                            <th
                              className="sticky left-0 z-20 border-r border-[#E31E24] bg-red-50/95 px-3 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#111827] shadow-xs"
                              style={
                                columnWidths[0]
                                  ? {
                                      width: `${columnWidths[0]}px`,
                                      minWidth: `${columnWidths[0]}px`,
                                      maxWidth: `${columnWidths[0]}px`,
                                    }
                                  : undefined
                              }
                            >
                              <span className="text-[#111827]">
                                {rowAxisAttributes.map((a) => a.name).join(" + ") || "Size"}
                              </span>
                              <span className="mx-1 text-[#111827]">/</span>
                              <span className="text-[#111827]">
                                {xAxisAttributes.map((a) => a.name).join(" + ")}
                              </span>
                            </th>
                            {activeColumnCombinations.map((columnCombination, idx) => {
                              const headerText = columnCombination.labels
                                .map((l) => l.value.value)
                                .join(" • ");
                              const colWidth = columnWidths[idx + 1];
                              return (
                                <th
                                  key={columnCombination.key}
                                  className="min-w-[88px] border-r border-red-200 bg-[#FFFBFB] px-2 py-2.5 text-center text-[12.5px] font-bold text-[#111827] last:border-r-0"
                                  style={
                                    colWidth
                                      ? {
                                          width: `${colWidth}px`,
                                          minWidth: `${colWidth}px`,
                                          maxWidth: `${colWidth}px`,
                                        }
                                      : undefined
                                  }
                                >
                                  <div className="inline-flex flex-col items-center">
                                    <span className="rounded-md bg-red-50 px-2.5 py-1 text-[12px] font-bold text-[#E31E24] border border-[#E31E24] leading-tight">
                                      {headerText}
                                    </span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                      </table>
                    </div>
                  </div>
                )}
                <div
                  ref={tableContainerRef}
                  className="overflow-hidden rounded-xl border border-[#E31E24] bg-white shadow-xs"
                >
                  <div
                    ref={tableScrollRef}
                    className="overflow-x-auto"
                    onScroll={handleTableScroll}
                  >
                    <table
                      ref={tableRef}
                      className="w-full border-collapse text-left"
                    >
                      <thead>
                        <tr className="border-b border-[#E31E24] bg-[#FFFBFB]">
                          <th className="sticky left-0 z-20 border-r border-[#E31E24] bg-red-50/70 px-3 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#111827]">
                            <span className="text-[#111827]">
                              {rowAxisAttributes.map((a) => a.name).join(" + ") || "Size"}
                            </span>
                            <span className="mx-1 text-[#111827]">/</span>
                            <span className="text-[#111827]">
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
                                className="min-w-[88px] border-r border-red-200 bg-[#FFFBFB] px-2 py-2.5 text-center text-[12.5px] font-bold text-[#111827] last:border-r-0"
                              >
                                <div className="inline-flex flex-col items-center">
                                  <span className="rounded-md bg-red-50 px-2.5 py-1 text-[12px] font-bold text-[#E31E24] border border-[#E31E24] leading-tight">
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
                            className="border-b border-red-200 hover:bg-red-50/30 transition-colors last:border-b-0"
                          >
                            <th className="sticky left-0 z-10 border-r border-[#E31E24] bg-[#FFFBFB] px-3.5 py-2.5 text-left font-bold text-[#111827] text-[13.5px] whitespace-nowrap shadow-xs">
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
                                  className="align-middle border-r border-[#E5E7EB] px-2 py-2 text-center last:border-r-0"
                                >
                                  {variant ? (
                                    <div
                                      className={`mx-auto flex flex-col items-center justify-center rounded-lg p-1.5 transition-all ${
                                        quantity > 0
                                          ? "bg-red-50/90 ring-1.5 ring-brand/40 shadow-xs"
                                          : "bg-white"
                                      } ${outOfStock || isPor ? "opacity-60" : ""}`}
                                    >
                                      <span className="mb-1 text-[10.5px] font-bold text-[#6B7280] tracking-wider uppercase">
                                        {columnCombination.labels.map((l) => l.value.value).join(" • ")}
                                      </span>
                                      <QuantityInput
                                        size="xs"
                                        value={outOfStock ? 0 : quantity}
                                        onChange={(nextQuantity) =>
                                          handleQuantityChange(
                                            variant.id,
                                            nextQuantity,
                                          )
                                        }
                                        min={0}
                                        max={availableStock > 0 ? availableStock : 0}
                                        minPositive={minPositive}
                                        disabled={!variant || outOfStock}
                                      />
                                      <div className="mt-1.5 text-center">
                                        <p className="text-[13px] font-bold text-[#111827]">
                                          {isPor ? (
                                            <span className="text-[12px] font-bold text-brand">
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
                                          <span className="text-[11px] font-bold text-red-600">
                                            Out of stock
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="py-2 text-center text-[12px] font-medium text-steel-2">
                                      
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
              </div>
            )}

            {allDropdownsSelected && filteredVariants.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-[#E7C9B5] bg-[#FBF2EB] px-4 py-3 text-brand">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p className="text-[13px]">
                  The selected dropdown filters do not match any active variants
                  for this product.
                </p>
              </div>
            )}
          </div>

          {(() => {
            const hasOrderableItems = selectedEntries.length > 0;

            return (
              <div className="grid gap-6 md:grid-cols-2 items-start">
                <div className="rounded-xl border border-[#E31E24] bg-white p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E31E24] bg-white text-brand shadow-2xs">
                      <Layers3 size={19} />
                    </div>
                    <div>
                      <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#111827]">
                        {t("ui.products.selectedVariantsTitle")}
                      </p>
                      <p className="text-[14.5px] font-bold text-[#111827]">
                        {selectedEntries.length
                          ? `${selectedEntries.length} line${selectedEntries.length === 1 ? "" : "s"} ready`
                          : t("ui.products.nothingSelectedYet")}
                      </p>
                    </div>
                  </div>

                  {selectedEntries.length ? (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedEntries.map((entry) => (
                        <div
                          key={entry.variant.id}
                          className="rounded-xl border border-[#E31E24] bg-white p-4 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[14px] font-bold text-[#111827]">
                                {entry.variant.title}
                              </p>
                              <p className="mt-1 text-[12.5px] font-semibold text-[#111827]">
                                {entry.quantity} x{" "}
                                <span className="text-[#111827] font-bold">
                                  {formatMoney(
                                    entry.price.currencySymbol,
                                    entry.resolvedUnitPrice,
                                  )}
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <QuantityInput
                                size="xs"
                                value={entry.quantity}
                                onChange={(next) =>
                                  handleQuantityChange(entry.variant.id, next)
                                }
                                min={1}
                                max={
                                  entry.variant.warehouseInventories?.length
                                    ? entry.variant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
                                    : (entry.variant.inventory?.available ?? 0)
                                }
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuantityChange(entry.variant.id, 0)
                                }
                                aria-label={`Remove ${entry.variant.title}`}
                                title="Remove variant"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 text-brand transition hover:border-brand hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E31E24] bg-white px-4 py-6 text-[13.5px] leading-relaxed text-[#111827]">
                      {t("ui.products.stageVariantsHelper")}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[#E31E24] bg-white p-5 shadow-2xs">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#111827]">
                    Order Summary
                  </p>
                  <div className="mt-4 space-y-2 text-[14px] text-[#111827]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#111827]">Variant lines</span>
                      <span className="font-bold text-[#111827]">
                        {selectedEntries.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#111827]">Total units</span>
                      <span className="font-bold text-[#111827]">
                        {totals.totalUnits}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#E31E24] pt-3 text-[16px]">
                      <span className="font-bold text-[#111827]">Subtotal</span>
                      <span className="font-bold text-[#E31E24] text-[18px]">
                        {formatMoney(totals.currencySymbol, totals.subtotal)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className={`grid gap-2.5 ${isQuoteAllowed ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                      <button
                        type="button"
                        onClick={handleAddSelectedToCart}
                        disabled={!hasOrderableItems}
                        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-brand px-4 py-3 text-[14px] font-bold text-white shadow-xs transition hover:bg-brand/90 cursor-pointer h-12 w-full ${
                          !hasOrderableItems ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <ShoppingBag size={17} />
                        {!hasOrderableItems
                          ? singleResolvedVariant && isSingleOutOfStock
                            ? "Out of Stock"
                            : "Select Options"
                          : "Add To Cart"}
                      </button>

                      {isQuoteAllowed && (
                        <button
                          type="button"
                          onClick={handleAddSelectedToQuote}
                          disabled={!hasOrderableItems}
                          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-brand px-4 py-3 text-[14px] font-bold text-white shadow-xs transition hover:bg-brand/90 cursor-pointer h-12 w-full ${
                            !hasOrderableItems ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <Layers3 size={17} />
                          {!hasOrderableItems
                            ? singleResolvedVariant && isSingleOutOfStock
                              ? "Out of Stock"
                              : "Select Options"
                            : "Add To Quote"}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleContinueShopping}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border border-[#E31E24] bg-white px-4 py-3 text-[14px] font-bold text-[#111827] shadow-xs transition hover:bg-red-50 hover:text-[#E31E24] cursor-pointer h-12"
                      >
                        Continue Shopping
                      </button>

                      <WishlistButton
                        productId={apiProduct.id}
                        showText={true}
                        className="h-12 px-4 border border-[#E31E24] bg-white hover:bg-red-50 hover:text-[#E31E24] text-[#111827] shadow-xs text-[14px] font-bold cursor-pointer w-full justify-center whitespace-nowrap"
                        iconSize={18}
                      />
                    </div>
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
            );
          })()}
        </div>
      </div>
    </section>
  );
}
