"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { useQuoteCartUI } from "@/contexts/QuoteCartUIContext";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers3,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCountries } from "@/hooks/api/useCurrencies";
import { useProduct } from "@/hooks/api/useProducts";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";
import { apiClient } from "@/lib/apiClient";
import { applyDiscount, nextDiscountTier } from "@/utils/discountRules";
import { useProductWarehouses } from "@/hooks/api/useProducts";
import { WarehouseSelectorModal } from "./WarehouseSelectorModal";
import { DynamicVariantMatrixConfigurator } from "./DynamicVariantMatrixConfigurator";
import { StockBadge } from "./StockBadge";
import { WishlistButton } from "./WishlistButton";
import { formatAttributeLabel } from "@/utils/attributeUtils";
import type {
  ApiAttribute,
  ApiProductDetail,
  ApiProductPrice,
  ApiVariant,
} from "@/types/api.types";

interface VariantConfiguratorProps {
  apiProduct: ApiProductDetail;
}

type ProductOptionAttribute = ApiAttribute & {
  values: NonNullable<ApiAttribute["values"]>;
};
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

const PACKAGE_ATTRIBUTE_NAME = "Package";

function getVariantPackageLabel(variant: ApiVariant) {
  return variant.package?.title ?? null;
}

function variantMatchesSelection(
  variant: ApiVariant,
  attributeName: string,
  value: string,
  attributeId?: string,
  attributeValues?: ApiAttribute["values"],
) {
  if (attributeName === PACKAGE_ATTRIBUTE_NAME) {
    return getVariantPackageLabel(variant) === value;
  }
  if (variant.attributeCombination && variant.attributeCombination[attributeName] === value) {
    return true;
  }
  if (variant.attributeCombination) {
    const trimmedName = attributeName.trim().toLowerCase();
    for (const [k, v] of Object.entries(variant.attributeCombination)) {
      if (k.trim().toLowerCase() === trimmedName && v === value) {
        return true;
      }
    }
  }
  if (attributeId && variant.attributeValueIdsByAttributeId && attributeValues) {
    const valId = variant.attributeValueIdsByAttributeId[attributeId];
    if (valId) {
      const matchingVal = attributeValues.find((av) => av.id === valId);
      if (matchingVal && matchingVal.value === value) {
        return true;
      }
    }
  }
  return false;
}

function buildPackageAttribute(
  variants: ApiVariant[],
): ProductOptionAttribute | null {
  const packageTitles = Array.from(
    new Set(
      variants
        .map((variant) => getVariantPackageLabel(variant))
        .filter((title): title is string => Boolean(title)),
    ),
  );
  if (packageTitles.length <= 1) return null;

  return {
    id: "__package__",
    name: PACKAGE_ATTRIBUTE_NAME,
    role: "DROPDOWN",
    displayType: "DROPDOWN",
    status: "ACTIVE",
    required: true,
    sortOrder: 999,
    values: packageTitles.map((title, index) => ({
      id: `__package__${index}`,
      attributeId: "__package__",
      value: title,
      slug: title.toLowerCase().replace(/\s+/g, "-"),
      sortOrder: index,
    })),
  };
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

function buildInitialSelections(
  attributes: ProductOptionAttribute[],
  variants: ApiVariant[],
) {
  return attributes.reduce<Record<string, string>>((acc, attribute) => {
    acc[attribute.name] = "";
    return acc;
  }, {});
}

function getAttributeDisplayType(
  attribute: ProductOptionAttribute,
): AttributeDisplayType {
  return attribute.displayType ?? attribute.role;
}

function getAttributeHelperText(
  displayType: AttributeDisplayType,
  selectedValue?: string,
) {
  if (selectedValue) return `Selected: ${selectedValue}`;
  if (displayType === "DROPDOWN")
    return "Select one option from the list below.";
  if (displayType === "X_GRID") return "Shown as the horizontal option group.";
  if (displayType === "Y_GRID") return "Shown as the vertical option group.";
  return "Choose one option to continue.";
}

function getAttributeDisplayMeta(displayType: AttributeDisplayType) {
  if (displayType === "X_GRID") {
    return {
      label: "X axis",
      cardClass: "border-brand/25 bg-[#FFFBFB]",
      badgeClass: "border-brand/20 bg-red-50 text-brand",
      optionGridClass: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
      activeClass:
        "border-brand bg-white text-brand shadow-[0_0_0_3px_rgba(227,30,36,0.08)]",
    };
  }

  if (displayType === "Y_GRID") {
    return {
      label: "Y axis",
      cardClass: "border-[#D8D8D8] bg-[#F8F8F8]",
      badgeClass: "border-[#D8D8D8] bg-white text-ink",
      optionGridClass: "grid gap-2",
      activeClass:
        "border-ink bg-white text-ink shadow-[0_0_0_3px_rgba(26,26,26,0.08)]",
    };
  }

  return {
    label: "Dropdown",
    cardClass: "border-line bg-offwhite",
    badgeClass: "border-line bg-white text-steel",
    optionGridClass: "grid gap-2",
    activeClass: "border-brand bg-white text-brand",
  };
}

export function VariantConfigurator({ apiProduct }: VariantConfiguratorProps) {
  const { data: dynamicProduct, isLoading } = useProduct(apiProduct.slug);
  const activeProduct = dynamicProduct ?? apiProduct;

  const attributes = activeProduct.attributes.map((attribute) => ({
    ...attribute,
    values: attribute.values ?? [],
  }));
  const xAxisCount = attributes.filter(
    (attribute) => getAttributeDisplayType(attribute) === "X_GRID",
  ).length;
  const yAxisCount = attributes.filter(
    (attribute) => getAttributeDisplayType(attribute) === "Y_GRID",
  ).length;

  if (isLoading && !dynamicProduct) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
      </div>
    );
  }

  if (xAxisCount >= 1 && yAxisCount >= 1) {
    return <DynamicVariantMatrixConfigurator apiProduct={activeProduct} />;
  }

  return <SingleVariantConfigurator apiProduct={activeProduct} />;
}

function SingleVariantConfigurator({ apiProduct }: VariantConfiguratorProps) {
  const { selectedCurrency, selectedCountryCode } = useCurrencyContext();
  const { addItems } = useQuoteCart();
  const { addItem, openCart } = useCart();
  const { open } = useQuoteCartUI();

  const { currentCustomer, isLoading } = useCustomerAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const variants = apiProduct.variants;
  const variantAttributeNames = new Set(
    variants.flatMap((variant) =>
      Object.keys(variant.attributeCombination ?? {}),
    ),
  );

  // Only show attributes that drive current sellable variants (avoids Size options when variants are Prescription-only).
  const attributes: ProductOptionAttribute[] = [
    ...apiProduct.attributes
      .filter(
        (attribute) =>
          variantAttributeNames.size === 0 ||
          variantAttributeNames.has(attribute.name),
      )
      .map((attribute) => {
        const values = (attribute.values ?? []).filter((value) =>
          variants.some(
            (variant) =>
              variant.attributeCombination?.[attribute.name] === value.value,
          ),
        );
        return {
          ...attribute,
          values: values.length ? values : (attribute.values ?? []),
        };
      })
      .filter((attribute) => attribute.values.length > 0),
    ...(buildPackageAttribute(variants)
      ? [buildPackageAttribute(variants)!]
      : []),
  ];

  const xAxisCount = attributes.filter(
    (attribute) => getAttributeDisplayType(attribute) === "X_GRID",
  ).length;
  const yAxisCount = attributes.filter(
    (attribute) => getAttributeDisplayType(attribute) === "Y_GRID",
  ).length;
  const isMatrixLayout = xAxisCount === 1 && yAxisCount === 1;
  const attributeSignature = attributes
    .map((attribute) => attribute.id)
    .join("|");
  const variantSignature = variants.map((variant) => variant.id).join("|");

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(() => buildInitialSelections(attributes, variants));
  const [quantity, setQuantity] = useState(1);
  const [drafts, setDrafts] = useState<DraftConfiguration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [previewPriceMap, setPreviewPriceMap] = useState<
    Record<string, number>
  >({});
  const [summaryHighlighted, setSummaryHighlighted] = useState(false);
  const [quoteSummaryHighlighted, setQuoteSummaryHighlighted] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const selectedConfigurationsRef = useRef<HTMLDivElement | null>(null);
  const quoteSummaryRef = useRef<HTMLDivElement | null>(null);

  const matchingVariants = variants.filter((variant) =>
    Object.entries(selectedOptions).every(
      ([attributeName, value]) => {
        const attr = attributes.find((a) => a.name === attributeName);
        return (
          !value ||
          variantMatchesSelection(
            variant,
            attributeName,
            value,
            attr?.id,
            attr?.values,
          )
        );
      },
    ),
  );

  const allAttributesSelected =
    attributes.length === 0 ||
    attributes.every(
      (attribute) => Boolean(selectedOptions[attribute.name]),
    );

  const currentVariant = allAttributesSelected
    ? (matchingVariants.find((variant) =>
        attributes.every((attribute) =>
          variantMatchesSelection(
            variant,
            attribute.name,
            selectedOptions[attribute.name] ?? "",
            attribute.id,
            attribute.values,
          ),
        ),
      ) ??
      (matchingVariants.length === 1
        ? matchingVariants[0]
        : variants.length === 1
          ? variants[0]
          : null))
    : null;

  const currentAvailableStock = currentVariant
    ? (currentVariant.warehouseInventories?.length
        ? currentVariant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
        : (currentVariant.inventory?.available ?? 0))
    : 0;

  useEffect(() => {
    if (currentAvailableStock > 0 && quantity > currentAvailableStock) {
      setQuantity(currentAvailableStock);
    }
  }, [currentAvailableStock, quantity]);

  const { selectedAddress } = useDeliveryAddress();

  const { data: warehouses, isLoading: isWarehousesLoading } = useProductWarehouses(
    apiProduct.slug,
    currentVariant?.id,
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

  const resolveWarehouseForCart = (variant: ApiVariant, qty: number) => {
    let finalWarehouseId = selectedWarehouse?.id;
    let finalWarehouseName = selectedWarehouse?.name;
    let finalIsLocal = selectedWarehouse?.isLocal;

    if (variant.warehouseInventories && variant.warehouseInventories.length > 0) {
      const inSelected = variant.warehouseInventories.find(
        (inv) => inv.warehouseId === (selectedWarehouse?.id || null) && inv.available >= qty
      );
      if (inSelected) {
        finalWarehouseId = inSelected.warehouseId ?? undefined;
      } else {
        const inDefault = variant.warehouseInventories.find((inv) => inv.warehouseId === null && inv.available >= qty);
        if (inDefault) {
          finalWarehouseId = undefined;
          finalWarehouseName = "Default Seller";
        } else {
          const anyOther = variant.warehouseInventories.find((inv) => inv.available >= qty);
          if (anyOther) {
            finalWarehouseId = anyOther.warehouseId ?? undefined;
            if (finalWarehouseId) {
              const wh = warehouses?.find((w) => w.id === finalWarehouseId);
              finalWarehouseName = wh ? wh.name : "Unknown Warehouse";
              finalIsLocal = wh ? wh.isLocal : undefined;
            } else {
              finalWarehouseName = "Default Seller";
            }
          } else {
            const fallback = variant.warehouseInventories.find((inv) => inv.available > 0);
            if (fallback) {
              finalWarehouseId = fallback.warehouseId ?? undefined;
              if (finalWarehouseId) {
                const wh = warehouses?.find((w) => w.id === finalWarehouseId);
                finalWarehouseName = wh ? wh.name : "Unknown Warehouse";
                finalIsLocal = wh ? wh.isLocal : undefined;
              } else {
                finalWarehouseName = "Default Seller";
              }
            }
          }
        }
      }
    }
    return { finalWarehouseId, finalWarehouseName, finalIsLocal };
  };

  const currentPrice = currentVariant
    ? getPriceForCurrency(
        currentVariant,
        selectedCurrency,
        apiProduct.prices ?? [],
      )
    : null;
  const { data: countries = [] } = useCountries();
  const activeCountry = countries.find((c) => c.code === selectedCountryCode);
  const currencySymbol =
    currentPrice?.currencySymbol ??
    activeCountry?.currency?.symbol ??
    "$";
  const currencyCode = currentPrice?.currencyCode ?? selectedCurrency;
  const currentResolvedUnitPrice = currentVariant
    ? (previewPriceMap[currentVariant.id] ?? currentPrice?.sellingPrice ?? 0)
    : 0;

  const subtotal = drafts.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discount = applyDiscount(subtotal);
  const nextTier = nextDiscountTier(subtotal);
  const totalUnits = drafts.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setSelectedOptions(buildInitialSelections(attributes, variants));
  }, [apiProduct.id, attributeSignature, variantSignature]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-variant-dropdown]")) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const previewItems =
      currentVariant && quantity >= 1
        ? [{ variantId: currentVariant.id, quantity }]
        : !apiProduct.hasVariants && quantity >= 1
          ? [{ variantId: apiProduct.id, quantity }]
          : [];

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
  }, [apiProduct.slug, apiProduct.variants, currentVariant?.id, quantity, selectedCountryCode, currentCustomer]);
  if (isMatrixLayout) {
    return <DynamicVariantMatrixConfigurator apiProduct={apiProduct} />;
  }

  if (!variants.length) return null;

  function getAvailableValuesForAttribute(attribute: ProductOptionAttribute, attrIndex: number) {
    const precedingSelections = attributes
      .slice(0, attrIndex)
      .map((a) => ({ name: a.name, value: selectedOptions[a.name] }))
      .filter((item) => Boolean(item.value));

    const sourceVariants = precedingSelections.length > 0
      ? variants.filter((variant) =>
          precedingSelections.every((item) => {
            const itemAttr = attributes.find((a) => a.name === item.name);
            return variantMatchesSelection(
              variant,
              item.name,
              item.value,
              itemAttr?.id,
              itemAttr?.values,
            );
          }),
        )
      : variants;

    const availableValueSet = new Set(
      sourceVariants
        .map((v) =>
          attribute.name === PACKAGE_ATTRIBUTE_NAME
            ? getVariantPackageLabel(v)
            : v.attributeCombination[attribute.name],
        )
        .filter((val): val is string => Boolean(val)),
    );

    return attribute.values.filter((v) => availableValueSet.has(v.value));
  }

  function handleOptionSelect(attributeName: string, value: string) {
    const attrIndex = attributes.findIndex((a) => a.name === attributeName);
    const nextSelections: Record<string, string> = {};

    for (let i = 0; i < attrIndex; i++) {
      const name = attributes[i].name;
      nextSelections[name] = selectedOptions[name] ?? "";
    }

    nextSelections[attributeName] = value;

    if (!value) {
      for (let i = attrIndex + 1; i < attributes.length; i++) {
        nextSelections[attributes[i].name] = "";
      }
    } else {
      for (let i = attrIndex + 1; i < attributes.length; i++) {
        const downstreamAttr = attributes[i];
        const validDownstreamVariants = variants.filter((v) =>
          Object.entries(nextSelections).every(([k, vVal]) => {
            const kAttr = attributes.find((a) => a.name === k);
            return (
              !vVal ||
              variantMatchesSelection(
                v,
                k,
                vVal,
                kAttr?.id,
                kAttr?.values,
              )
            );
          }),
        );

        const availableDownstreamValues = new Set(
          validDownstreamVariants
            .map((v) =>
              downstreamAttr.name === PACKAGE_ATTRIBUTE_NAME
                ? getVariantPackageLabel(v)
                : v.attributeCombination[downstreamAttr.name],
            )
            .filter((val): val is string => Boolean(val)),
        );

        const currentDownstreamVal = selectedOptions[downstreamAttr.name];
        if (currentDownstreamVal && availableDownstreamValues.has(currentDownstreamVal)) {
          nextSelections[downstreamAttr.name] = currentDownstreamVal;
        } else {
          nextSelections[downstreamAttr.name] = "";
        }
      }
    }

    setSelectedOptions(nextSelections);
    setOpenDropdown(null);
    setError(null);
    setAdded(false);
  }

  function focusPanel(
    ref: React.RefObject<HTMLDivElement | null>,
    offset = 112,
  ) {
    const element = ref.current;
    if (!element) return;

    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    element.focus({ preventScroll: true });
  }

  function handleAddConfiguration() {
    if (!currentVariant) {
      setError(
        "This configuration is not available. Please adjust the selected variant options.",
      );
      return;
    }

    const availableStock = currentAvailableStock;
    const isOutOfStock = availableStock <= 0;

    if (isOutOfStock) {
      setError("This item is currently out of stock.");
      return;
    }

    if (quantity > availableStock) {
      setError(
        `Only ${availableStock} unit${availableStock === 1 ? "" : "s"} available for this configuration.`,
      );
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
      const existingIndex = current.findIndex(
        (item) => item.variantId === line.variantId,
      );
      if (existingIndex === -1) return [...current, line];
      return current.map((item, index) =>
        index === existingIndex
          ? { ...item, quantity: item.quantity + line.quantity }
          : item,
      );
    });
    setQuantity(1);
    setError(null);
    setAdded(false);
    setSummaryHighlighted(true);

    window.setTimeout(() => focusPanel(selectedConfigurationsRef), 50);

    window.setTimeout(() => setSummaryHighlighted(false), 1400);
  }

  function handleAddToCart(isBuyNow = false) {
    if (!currentVariant) {
      setError(
        "This configuration is not available. Please adjust the selected variant options.",
      );
      return;
    }

    const availableStock = currentVariant.warehouseInventories?.length
      ? currentVariant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
      : (currentVariant.inventory?.available ?? 0);
    const isOutOfStock = availableStock <= 0;

    if (isOutOfStock) {
      setError("This item is currently out of stock.");
      return;
    }

    if (quantity > availableStock) {
      setError(
        `Only ${availableStock} unit${availableStock === 1 ? "" : "s"} available for this configuration.`,
      );
      return;
    }

    if (!currentPrice) {
      setError(
        "This configuration does not have an available purchase price yet.",
      );
      return;
    }

    const resolvedWh = resolveWarehouseForCart(currentVariant, quantity);

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
      warehouseId: resolvedWh.finalWarehouseId,
      warehouseName: resolvedWh.finalWarehouseName,
      estimatedDeliveryDays: selectedWarehouse?.estimatedDeliveryDays,
      isLocalWarehouse: resolvedWh.finalIsLocal,
    });
    setAdded(false);
    setError(null);
    
    if (isBuyNow) {
      router.push("/checkout");
    } else {
      openCart();
    }
  }

  function updateDraftQuantity(
    variantId: string,
    nextQuantity: number,
    shouldFocusQuoteSummary = false,
  ) {
    const variant = apiProduct.variants.find((v) => v.id === variantId);
    const maxStock = variant
      ? (variant.warehouseInventories?.length
          ? variant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
          : (variant.inventory?.available ?? 0))
      : 9999;

    const clampedQuantity = Math.min(maxStock > 0 ? maxStock : 9999, nextQuantity);

    setDrafts((current) =>
      clampedQuantity <= 0
        ? current.filter((item) => item.variantId !== variantId)
        : current.map((item) =>
            item.variantId === variantId
              ? { ...item, quantity: clampedQuantity }
              : item,
          ),
    );

    if (shouldFocusQuoteSummary) {
      setQuoteSummaryHighlighted(true);
      window.setTimeout(() => setQuoteSummaryHighlighted(false), 1400);
    }
  }

  function handleAddToQuote() {
    if (!drafts.length) {
      setError(
        "Add at least one configuration before sending it to the quote cart.",
      );
      return;
    }

    const items: QuoteCartItem[] = drafts.map((draft) => ({
      productId: apiProduct.id,
      productSlug: apiProduct.slug,
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

    addItems(items);
    open();
    setDrafts([]);
    setAdded(true);
    setError(null);
  }

  if (!variants.length) return null;

  return (
    <section className="pt-8 sm:pt-8.5 ">
      <div className="mb-8 rounded-lg border border-line bg-white p-3 sm:p-5 lg:p-7">
        <div className="mb-5 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <span className="mb-2 inline-flex items-center gap-2 rounded-pill border border-line bg-offwhite px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              <Sparkles size={12} />
              Premium Configurator
            </span>
            <h2 className="text-[clamp(24px,2.8vw,32px)] font-normal leading-tight tracking-tight text-ink">
              Build a quote-ready configuration without leaving the PDP
            </h2>
            <p className="mt-2 max-w-[620px] text-[14.5px] leading-relaxed text-steel">
              Select the exact variant, stage multiple configurations, review
              the consolidated quote summary, and push everything into the quote
              cart in one step.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Compact Multi-Column Attribute Controls Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {attributes.map((attribute, attrIndex) => {
                const displayType = getAttributeDisplayType(attribute);
                const selectedValue = selectedOptions[attribute.name];
                const availableValues = getAvailableValuesForAttribute(attribute, attrIndex);
                const isBinaryPill =
                  displayType !== "DROPDOWN" && availableValues.length <= 4;

                return (
                  <div
                    key={attribute.id}
                    className={[
                      "rounded-lg border border-line bg-white p-3 shadow-xs transition-colors hover:border-steel-2/60",
                      isBinaryPill && availableValues.length > 2
                        ? "sm:col-span-2"
                        : "",
                    ].join(" ")}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/80">
                        {formatAttributeLabel(attribute.name)}
                      </label>
                      <span className="rounded-pill border border-line bg-offwhite px-2 py-0.5 text-[10px] font-semibold text-steel">
                        {availableValues.length} {availableValues.length === 1 ? "opt" : "opts"}
                      </span>
                    </div>

                    {isBinaryPill ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {availableValues.map((value) => {
                          const active = selectedValue === value.value;
                          return (
                            <button
                              key={value.id}
                              type="button"
                              onClick={() =>
                                handleOptionSelect(attribute.name, value.value)
                              }
                              className={[
                                "flex-1 min-w-[60px] rounded-md border py-1.5 px-2 text-center text-[12px] font-semibold transition-all",
                                active
                                  ? "border-brand bg-brand text-white shadow-2xs"
                                  : "border-line bg-white text-ink hover:border-brand/40 hover:text-brand",
                              ].join(" ")}
                            >
                              {value.value}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="relative pt-0.5" data-variant-dropdown>
                        <select
                          value={selectedValue || ""}
                          onChange={(e) =>
                            handleOptionSelect(attribute.name, e.target.value)
                          }
                          className="w-full cursor-pointer rounded-md border border-line bg-white py-2 pl-3 pr-8 text-[12.5px] font-medium text-ink outline-none transition hover:border-steel-2 focus:border-brand focus:ring-1 focus:ring-brand"
                        >
                          <option value="">
                            Select One
                          </option>
                          {availableValues.map((value) => (
                            <option
                              key={value.id}
                              value={value.value}
                            >
                              {value.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-line bg-white p-3 md:col-span-2 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                    Quantity
                  </p>
                  <p className="mt-1 text-[13px] text-steel">
                    Set the unit count for this configuration before you add it
                    to the list.
                  </p>
                </div>
                <div className="inline-flex w-fit max-w-full items-center rounded-pill border border-line bg-offwhite p-1.5 sm:self-auto">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1 || (!currentVariant && variants.length > 0)}
                    onClick={() =>
                      setQuantity((current) => Math.max(1, current - 1))
                    }
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantity}
                    disabled={!currentVariant && variants.length > 0}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^0-9]/g, "");
                      const num = Number(raw) || 1;
                      const maxLimit = currentAvailableStock > 0 ? currentAvailableStock : 9999;
                      setQuantity(Math.min(maxLimit, Math.max(1, num)));
                    }}
                    className="w-12 appearance-none border-0 bg-transparent text-center text-[15px] font-semibold text-ink outline-none sm:w-16 disabled:opacity-40"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={(!currentVariant && variants.length > 0) || (currentAvailableStock > 0 && quantity >= currentAvailableStock)}
                    onClick={() =>
                      setQuantity((current) => {
                        const maxLimit = currentAvailableStock > 0 ? currentAvailableStock : 9999;
                        return Math.min(maxLimit, current + 1);
                      })
                    }
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-line bg-offwhite p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-steel-2">
                    Current Variant
                  </p>
                  <p className="mt-1 text-[16px] font-semibold leading-snug text-ink sm:text-[18px]">
                    {currentVariant?.title ?? (allAttributesSelected ? "No valid combination selected" : "Please select all options above")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {currentVariant ? (
                      <>
                        <StockBadge status={currentVariant.inventory?.status} available={currentVariant.inventory?.available} />
                        {Object.entries(
                          currentVariant.attributeCombination,
                        ).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-pill border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-steel"
                          >
                            {formatAttributeLabel(key)}: {value}
                          </span>
                        ))}
                        {getVariantPackageLabel(currentVariant) && (
                          <span className="rounded-pill border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-steel">
                            Package: {getVariantPackageLabel(currentVariant)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[12px] text-steel-2">
                        {allAttributesSelected
                          ? "Choose a supported combination to continue."
                          : "Choose an option for each attribute above to continue."}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-2">
                    Estimated Unit Price
                  </p>
                  {currentPrice ? (
                    <p className="mt-1 text-[24px] font-semibold text-ink">
                      {formatMoney(currencySymbol, currentResolvedUnitPrice)}
                    </p>
                  ) : currentVariant ? (
                    <span className="mt-1 inline-block rounded-pill border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-1 text-sm font-semibold text-[#E31E24]">
                      Price Upon Request
                    </span>
                  ) : (
                    <span className="mt-1 inline-block text-[13px] font-medium text-steel">
                      Select options above
                    </span>
                  )}
                  <p className="mt-1 text-[12px] text-steel">
                    {currentVariant?.sku
                      ? `SKU ${currentVariant.sku}`
                      : "SKU assigned after configuration"}
                  </p>
                </div>
              </div>

              {currentVariant && !currentPrice && (
                <div className="mt-3 rounded-lg border border-[#FDE8E8] bg-[#FEF2F2] p-3 text-[13px] text-[#B91C1C]">
                  Pricing for this region is provided via custom quote. Click <strong>Request Quote</strong> to submit your configuration.
                </div>
              )}

              {currentVariant && (currentVariant.inventory?.status === "OUT_OF_STOCK" || (currentVariant.inventory?.available ?? 0) <= 0) && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700">
                  This item is currently out of stock and cannot be added to your cart.
                </div>
              )}

              {currentVariant && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-[#E0E0E0] bg-[#F9F9F9] p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] text-steel">Sold by / Ships from</span>
                    <span className="text-[13px] font-semibold text-ink">{selectedWarehouse ? selectedWarehouse.name : "Default Seller"}</span>
                    <span className="text-[12px] text-emerald-600 font-medium">Estimated Delivery: {selectedWarehouse ? selectedWarehouse.estimatedDeliveryDays : "3-5"} days</span>
                  </div>
                  {warehouses && warehouses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsWarehouseModalOpen(true)}
                      className="text-[13px] font-medium text-brand hover:underline"
                    >
                      Change Seller
                    </button>
                  )}
                </div>
              )}
              
              <WarehouseSelectorModal
                open={isWarehouseModalOpen}
                onClose={() => setIsWarehouseModalOpen(false)}
                onSelect={(id) => {
                  setSelectedWarehouseId(id);
                  setUserSelected(true);
                  setIsWarehouseModalOpen(false);
                }}
                warehouses={warehouses || []}
                selectedWarehouseId={selectedWarehouseId}
                isLoading={isWarehousesLoading}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {(() => {
                  const totalAvailableStock = currentVariant?.warehouseInventories
                    ? currentVariant.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
                    : (currentVariant?.inventory?.available ?? 0);

                  const isGloballyInStock = Boolean(
                    currentVariant &&
                    totalAvailableStock > 0
                  );

                  const isWarehouseUnavailable = false; // Disabled because Smart Cart Splitting handles cross-warehouse fulfillment
                  
                  const isSelectedOutOfStock = currentVariant ? !isGloballyInStock : false;
                  const isReady = Boolean(currentVariant);

                  const getButtonLabel = (defaultLabel: string) => {
                    if (!isReady) return "Select Options";
                    if (!isGloballyInStock) return "Out of Stock";
                    return defaultLabel;
                  };

                  if (currentPrice) {
                    return (
                      <>
                        <button
                          type="button"
                          disabled={!isReady || isSelectedOutOfStock}
                          onClick={handleAddConfiguration}
                          className={`inline-flex items-center justify-center rounded-pill bg-brand px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90 cursor-pointer ${
                            !isReady || isSelectedOutOfStock ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                          }`}
                        >
                          Add Configuration
                        </button>
                        <button
                          type="button"
                          disabled={!isReady || isSelectedOutOfStock}
                          onClick={() => handleAddToCart(true)}
                          className={`inline-flex items-center justify-center gap-2 rounded-pill bg-[#1a1a1a] px-6 py-3 text-[13px] font-semibold text-white transition hover:bg-[#333] cursor-pointer ${
                            !isReady || isSelectedOutOfStock ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                          }`}
                        >
                          <ShoppingBag size={15} />
                          {getButtonLabel("Buy Now")}
                        </button>
                        <WishlistButton
                          productId={apiProduct.id}
                          showText={true}
                          className="h-11 px-4 border border-line bg-white hover:border-[#E31E24] hover:text-[#E31E24] shadow-2xs text-[13px] cursor-pointer"
                          iconSize={17}
                        />
                      </>
                    );
                  }

                  return (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={!isReady || isSelectedOutOfStock}
                        onClick={() => {
                          if (!currentVariant || isSelectedOutOfStock) return;
                          const resolvedWh = resolveWarehouseForCart(currentVariant, quantity);
                          addItems([
                            {
                              productId: apiProduct.id,
                              productSlug: apiProduct.slug,
                              productTitle: apiProduct.title,
                              variantId: currentVariant.id,
                              variantTitle: currentVariant.title,
                              sku: currentVariant.sku,
                              quantity,
                              unitPrice: 0,
                              currencyCode: selectedCurrency,
                              currencySymbol: "$",
                              selectedAttributes: selectedOptions,
                              priceUnavailable: true,
                              warehouseId: resolvedWh.finalWarehouseId,
                              warehouseName: resolvedWh.finalWarehouseName,
                              estimatedDeliveryDays: selectedWarehouse?.estimatedDeliveryDays,
                              isLocalWarehouse: resolvedWh.finalIsLocal,
                            },
                          ]);
                          openCart();
                        }}
                        className={`inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90 cursor-pointer ${
                          !isReady || isSelectedOutOfStock ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                        }`}
                      >
                        {getButtonLabel("Request Quote (RFQ)")}
                      </button>
                      <WishlistButton
                        productId={apiProduct.id}
                        showText={true}
                        className="h-11 px-4 border border-line bg-white hover:border-[#E31E24] hover:text-[#E31E24] shadow-2xs text-[13px] cursor-pointer"
                        iconSize={17}
                      />
                    </div>
                  );
                })()}
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
                  <p className="text-[13px]">
                    Configurations moved to the quote cart. You can review or
                    submit them from the sticky cart.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4 sm:space-y-5 xl:sticky xl:top-28 xl:self-start">
            <div
              ref={selectedConfigurationsRef}
              tabIndex={-1}
              className={[
                "rounded-lg border bg-offwhite p-4 outline-none transition-all duration-300 sm:p-5",
                summaryHighlighted
                  ? "border-brand shadow-[0_0_0_4px_rgba(227,30,36,0.10)]"
                  : "border-line",
              ].join(" ")}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-brand">
                  <Layers3 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                    Selected Configurations
                  </p>
                  <p className="text-[14px] text-steel">
                    {drafts.length
                      ? `${drafts.length} saved for this product`
                      : "Nothing staged yet"}
                  </p>
                </div>
              </div>

              {drafts.length ? (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div
                      key={draft.variantId}
                      className="rounded-lg border border-line bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-ink">
                            {draft.variantTitle}
                          </p>
                          <p className="mt-1 text-[11.5px] text-steel">
                            {draft.sku
                              ? `SKU ${draft.sku}`
                              : "Custom configuration"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraftQuantity(draft.variantId, 0)
                          }
                          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(draft.selectedAttributes).map(
                          ([key, value]) => (
                            <span
                              key={key}
                              className="rounded-pill border border-line bg-offwhite px-2.5 py-1 text-[10.5px] text-steel"
                            >
                              {key}: {value}
                            </span>
                          ),
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex w-fit max-w-full items-center rounded-pill border border-line bg-offwhite p-1">
                          <button
                            type="button"
                            aria-label="Decrease configuration quantity"
                            onClick={() =>
                              updateDraftQuantity(
                                draft.variantId,
                                draft.quantity - 1,
                                true,
                              )
                            }
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-10 text-center text-[13px] font-semibold text-ink">
                            {draft.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase configuration quantity"
                            onClick={() =>
                              updateDraftQuantity(
                                draft.variantId,
                                draft.quantity + 1,
                                true,
                              )
                            }
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-steel-2">
                            Line Total
                          </p>
                          <p className="text-[14px] font-semibold text-ink">
                            {draft.unitPrice > 0
                              ? formatMoney(
                                  draft.currencySymbol,
                                  draft.unitPrice * draft.quantity,
                                )
                              : "Price Upon Request"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-white p-4 text-[13px] leading-relaxed text-steel-2">
                  Add your first variant configuration to build a quote summary
                  here. This list is product-specific and can stage multiple
                  setups before you commit them to the quote cart.
                </div>
              )}
            </div>

            <div
              ref={quoteSummaryRef}
              tabIndex={-1}
              className={[
                "rounded-lg border bg-white p-4 outline-none transition-all duration-300 sm:p-5",
                quoteSummaryHighlighted
                  ? "border-brand shadow-[0_0_0_4px_rgba(227,30,36,0.10)]"
                  : "border-line",
              ].join(" ")}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-2">
                Quote Summary
              </p>
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
                  <strong className="text-ink">
                    {subtotal > 0
                      ? formatMoney(currencySymbol, subtotal)
                      : "Price Upon Request"}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-[13.5px] text-steel">
                  <span>Volume Discount</span>
                  <strong className="text-ink">
                    {subtotal <= 0
                      ? "Custom Quote"
                      : discount.percentage
                        ? `-${formatMoney(currencySymbol, discount.amount)} (${discount.percentage}%)`
                        : "Not applied yet"}
                  </strong>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-offwhite p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-2">
                      Estimated Total
                    </p>
                    <p className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
                      {subtotal > 0
                        ? formatMoney(currencySymbol, discount.grandTotal)
                        : "Price Upon Request"}
                    </p>
                  </div>
                  {subtotal > 0 && nextTier ? (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-steel">
                      Add{" "}
                      {formatMoney(
                        currencySymbol,
                        nextTier.minValue - subtotal,
                      )}{" "}
                      more to unlock {nextTier.percentage}% off.
                    </div>
                  ) : subtotal > 0 ? (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-[#355246]">
                      Highest volume discount tier reached.
                    </div>
                  ) : (
                    <div className="max-w-[160px] text-right text-[11.5px] leading-relaxed text-steel">
                      Custom quote pricing applies for selected region.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (drafts.length > 0) {
                    handleAddToQuote();
                  } else if (currentVariant) {
                    const resolvedWh = resolveWarehouseForCart(currentVariant, quantity);
                    addItems([
                      {
                        productId: apiProduct.id,
                        productSlug: apiProduct.slug,
                        productTitle: apiProduct.title,
                        variantId: currentVariant.id,
                        variantTitle: currentVariant.title,
                        sku: currentVariant.sku,
                        quantity,
                        unitPrice: 0,
                        currencyCode: selectedCurrency,
                        currencySymbol: "$",
                        selectedAttributes: currentVariant.attributeCombination,
                        warehouseId: resolvedWh.finalWarehouseId,
                        warehouseName: resolvedWh.finalWarehouseName,
                        estimatedDeliveryDays: selectedWarehouse?.estimatedDeliveryDays,
                        isLocalWarehouse: resolvedWh.finalIsLocal,
                      },
                    ]);
                    open();
                  }
                }}
                className="mt-5 inline-flex w-full items-center justify-center rounded-pill bg-brand px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-brand/90"
              >
                {currentPrice ? "Add To Quote" : "Request Quote (RFQ)"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
