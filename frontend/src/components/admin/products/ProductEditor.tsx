"use client";

import { useEffect, useMemo, useRef, useState, useCallback, Fragment, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import * as Yup from "yup";
import { Upload, Download, Trash2, RefreshCw, Plus, Zap, Copy, X, Pencil, Save, Globe2, Search, ChevronRight, ChevronLeft, ChevronDown, Eye, ZoomIn, CheckSquare, Square, Check, FolderUp, Image as ImageIcon, Loader2, Box, Package, Info, Star, GripVertical, FileText } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminRichTextEditor, AdminTextarea, AdminSelect, AdminMultiSelect, StatusBadge, useToast, ConfirmModal, AdminDeleteModal, DataTable, AdminSectionTable, Column, toastMessages, LoadingButton, AdminBulkActionsBar } from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import MediaSelectorModal from "@/components/admin/media/MediaSelectorModal";
import type { MediaItem } from "@/services/mediaService";
import { BulkVariantImportWizard } from "@/components/admin/products/BulkVariantImportWizard";
import { AdminImportWizard, WizardColumnDef } from "@/components/admin/AdminImportWizard";
import { ProductPaymentOverridesTab } from "@/components/admin/products/ProductPaymentOverridesTab";
import { RefreshButton } from "@/components/admin/RefreshButton";
import {
  useAdminProduct,
  useUpdateProduct,
  useAdminCategories,
  useAdminAttributes,
  useAdminAttribute,
  useAdminLanguages,
  useAdminProductCountries,
  useUpdateProductCountries,
  useAdminVariantCountries,
  useUpdateVariantCountries,
  useAdminProductAttributes,
  useAdminProductTierPricing,
  useCreateProductTierPricing,
  useUpdateProductTierPricing,
  useDeleteProductTierPricing,
  useAdminProductMoqPricing,
  useCreateProductMoqPricing,
  useUpdateProductMoqPricing,
  useDeleteProductMoqPricing,
  useAssignProductAttributes,
  useRemoveProductAttribute,
  useAdminCountries,
  useAdminWarehouses,
  useAdminTiers,
  useUpdateProductFilterVisibility,
  useReorderAttributeValues,
  useAdminCurrencies,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { SortableList } from "@/components/admin/SortableList";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  filterTranslationLanguages,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationRichTextField,
  TranslationEditorBanner,
  NoTranslationLanguagesMessage,
} from "@/components/admin/TranslationEditorUi";

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
}

interface TabConfig {
  id: number;
  label: string;
  permission?: string;
}

const ALL_TABS: TabConfig[] = [
  { id: 0, label: "Basic Info" },
  { id: 1, label: "Product Info" },
  { id: 2, label: "Media" },
  { id: 4, label: "Variants", permission: "variants.view" },
  { id: 5, label: "Pricing", permission: "pricing.view" },
  { id: 6, label: "Inventory", permission: "inventory.view" },
  { id: 7, label: "Translations", permission: "translations.view" },
  { id: 8, label: "Product Attributes", permission: "attributes.view" },
  { id: 9, label: "Country Availability", permission: "countries.view" },
  { id: 10, label: "SEO" },
  { id: 11, label: "Shipping Info" },
  { id: 12, label: "Payments", permission: "payments.view" },
];

const basicSchema = Yup.object({
  title: Yup.string().required("Title is required"),
  slug: Yup.string().optional(),
  categoryId: Yup.string().required("Category is required"),
  activeCountryIds: Yup.array().of(Yup.string()).optional(),
  status: Yup.string().optional(),
  productCode: Yup.string().optional(),
  sku: Yup.string().optional(),
  brand: Yup.string().optional(),
  shortDescription: Yup.string().max(300).optional(),
  description: Yup.string().optional(),
  informationImage: Yup.string().optional(),
  informationDescription: Yup.string().max(200).optional(),
  isFeatured: Yup.boolean().optional(),
  hasVariants: Yup.boolean().optional(),
  seoTitle: Yup.string().max(60).optional(),
  seoDescription: Yup.string().max(160).optional(),
  seoKeywords: Yup.string().optional(),
  highlights: Yup.array().optional(),
  technicalSpecs: Yup.mixed().optional(),
  specImages: Yup.array().optional(),
  warranty: Yup.array().optional(),
  primaryFeatures: Yup.array().optional(),
});

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

type ProductEditorFormValues = {
  title: string;
  slug: string;
  categoryId: string;
  activeCountryIds: string[];
  status: string;
  productCode: string;
  sku: string;
  brand: string;
  shortDescription: string;
  description: string;
  informationImage: string;
  informationDescription: string;
  isFeatured: boolean;
  hasVariants: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  highlights: Array<{ title: string; description: string; image?: string }>;
  technicalSpecs: Array<{ label: string; value: string }>;
  specImages: Array<{ url: string; title: string }>;
  warranty: string[];
  primaryFeatures: Array<{ title: string; description: string }>;
  additionalInfo: Array<{ label: string; value: string }>;
};

const DEFAULT_ADDITIONAL_INFO = [
  { label: "Manufacturer", value: "Modern Orthodontics" },
  { label: "Country of Origin", value: "India" },
  { label: "Regulatory Compliance", value: "ISO 13485 & CE Certified" },
  { label: "Shelf Life", value: "5 Years from manufacturing date" },
];

const DEFAULT_PRODUCT_HIGHLIGHTS = [
  {
    title: "High-Precision Orthodontic Design",
    description: "<p>Engineered for high clinical accuracy, optimal force delivery, and patient comfort during active treatment.</p>",
  },
  {
    title: "Medical-Grade Quality Construction",
    description: "<p>Manufactured from premium orthodontic-grade materials adhering to strict ISO 13485 quality standards.</p>",
  },
  {
    title: "Reliable Performance & Durability",
    description: "<p>Provides consistent force control, reliable shape memory, and long-lasting structural integrity.</p>",
  },
];

const DEFAULT_PRIMARY_FEATURES = [
  {
    title: "Clinical Inspection & Verification",
    description: "<p>Inspect product packaging and verify specification suitability before clinical use.</p>",
  },
  {
    title: "Treatment Site Preparation",
    description: "<p>Prepare treatment site following standard clinical orthodontic protocols.</p>",
  },
  {
    title: "Placement & Engagement",
    description: "<p>Apply product according to clinical technique and manufacturer instructions.</p>",
  },
];

const DEFAULT_TECHNICAL_SPECS = [
  { label: "Brand", value: "Modern Orthodontics" },
  { label: "Material", value: "Medical Grade Stainless Steel" },
  { label: "Base Type", value: "80-Mesh Contoured Base" },
  { label: "System", value: "Roth / MBT Compatible" },
  { label: "Slot Size", value: '.018" / .022"' },
];

type PackageRow = {
  id: string;
  title: string;
  slug: string;
  image?: string | null;
  description?: string | null;
  sortOrder?: number;
  status?: string;
};



type VariantRow = {
  id: string;
  title: string;
  sku: string;
  status: string;
  moq?: number | null;
  packageId?: string | null;
  weight?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  shippingClass?: string | null;
  fragile?: boolean;
  hazardous?: boolean;
  package?: { id: string; title: string } | null;
  inventories?: {
    id?: string;
    variantId?: string | null;
    warehouseId?: string | null;
    warehouse?: { id: string; name: string; country?: { id: string; name: string; code: string } | null; state?: string | null } | null;
    stock: number;
    reservedStock?: number | null;
    lowStockThreshold?: number | null;
    status?: string | null;
  }[];
  prices?: {
    id: string;
    countryId?: string | null;
    country?: { id: string; name: string; code: string } | null;
    mrp?: string | number | null;
    sellingPrice?: string | number | null;
    dealerPrice?: string | number | null;
    distributorPrice?: string | number | null;
    currency?: { symbol?: string | null; code?: string | null } | null;
  }[];
  attributeValues?: {
    attributeId: string;
    attributeValueId: string;
    attribute?: { name: string };
    attributeValue?: { id?: string; value: string };
  }[];
};

const productAttributeWizardColumns: WizardColumnDef[] = [
  { key: "attributeName", header: "Attribute Name", required: true, minWidth: "170px" },
  {
    key: "role",
    header: "Display Type",
    type: "select",
    options: [
      { label: "Dropdown", value: "DROPDOWN" },
      { label: "X-Axis Grid", value: "X_GRID" },
      { label: "Y-Axis Grid", value: "Y_GRID" },
    ],
    minWidth: "150px",
  },
  {
    key: "allowedValues",
    header: "Allowed Values",
    required: true,
    minWidth: "280px",
    placeholder: "e.g. MBT, Roth, Alexander",
  },
];

const productAttributeExpectedColumns = [
  { name: "attributeName", required: true, hint: "Name of attribute to map" },
  { name: "role", hint: "DROPDOWN, X_GRID, or Y_GRID" },
  { name: "allowedValues", required: true, hint: "Comma-separated allowed values" },
];

function ProductBaseInventoryEditor({
  productId,
  inventory,
  onSaved,
  notify,
  disabled = false,
  hasVariants = false,
}: {
  productId: string;
  inventory?: NonNullable<VariantRow["inventories"]>[number] | null;
  onSaved: () => Promise<unknown>;
  notify: (message: string, type?: "success" | "error") => void;
  disabled?: boolean;
  hasVariants?: boolean;
}) {
  const [stock, setStock] = useState(inventory?.stock ?? 0);
  const [reservedStock, setReservedStock] = useState(inventory?.reservedStock ?? 0);
  const [lowStockThreshold, setLowStockThreshold] = useState(inventory?.lowStockThreshold ?? 10);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (reservedStock > stock) {
      notify("Reserved stock cannot exceed stock.", "error");
      return;
    }
    setSaving(true);
    try {
      await adminApi.put(`/inventory/product/${productId}`, { stock, reservedStock, lowStockThreshold });
      await onSaved();
      notify("Base inventory saved.");
    } catch (error) {
      notify(getAdminErrorMessage(error, "Failed to save base inventory."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#E6E6E6] bg-white p-4">
      {hasVariants && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800 font-semibold">
          This product has variants enabled. Base inventory is managed at the variant level below.
        </div>
      )}
      <div className="mb-4">
        <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Product Base Inventory</h4>
        <p className="mt-1 text-[12px] text-[#6B6B6B]">This inventory is inherited by newly generated variants when no country-specific override applies.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminInput label="Stock" type="text" value={stock} onChange={(event) => setStock(Math.max(0, Math.trunc(Number(event.target.value.replace(/\D/g, ""))) || 0))} disabled={disabled} />
        <AdminInput label="Reserved stock" type="text" value={reservedStock} onChange={(event) => setReservedStock(Math.max(0, Math.trunc(Number(event.target.value.replace(/\D/g, ""))) || 0))} disabled={disabled} />
        <AdminInput label="Low-stock threshold" type="text" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(Math.max(0, Math.trunc(Number(event.target.value.replace(/\D/g, ""))) || 0))} disabled={disabled} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[12px] text-[#6B6B6B]">Available after reservations: {Math.max(0, stock - reservedStock)}</span>
        {!disabled && (
          <button type="button" onClick={save} disabled={saving} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
            {saving ? "Saving…" : inventory?.id ? "Update Base Inventory" : "Create Base Inventory"}
          </button>
        )}
      </div>
    </div>
  );
}

type GlobalAttribute = {
  id: string;
  name: string;
  role?: AttributeRole;
  values: { id: string; value: string }[];
};

type AttributeRole = "DROPDOWN" | "X_GRID" | "Y_GRID";
type GridRole = "ROW" | "COLUMN" | null;
type GridAxis = "ROW" | "COLUMN";

type AttributeValueDetail = {
  id: string;
  value: string;
  gridRole?: GridRole;
  countryId?: string | null;
  country?: { id: string; name: string; code: string } | null;
  moq?: number | null;
  tierPrice?: string | number | null;
  dealerPrice?: string | number | null;
};

const getAttributeValues = <T extends { id: string; value: string }>(attribute?: { values?: T[] | null }): T[] =>
  Array.isArray(attribute?.values) ? attribute.values : [];

const getBaseInventory = <T extends { warehouseId?: string | null }>(inventories?: T[] | null) =>
  Array.isArray(inventories) ? inventories.find((inventory) => !inventory.warehouseId) ?? null : null;

const resolveEditSelectedValue = (
  attributeId: string,
  values: { id: string; value: string }[],
  selections: SingleSelectionMap,
  variant: VariantRow | null,
) => {
  const selectedId = selections[attributeId];
  if (!selectedId) return null;
  const fromCatalog = values.find((value) => value.id === selectedId);
  if (fromCatalog) return fromCatalog;
  const fromVariant = variant?.attributeValues?.find(
    (binding) => binding.attributeId === attributeId && binding.attributeValueId === selectedId,
  )?.attributeValue;
  if (fromVariant?.value) {
    return { id: fromVariant.id ?? selectedId, value: fromVariant.value };
  }
  return null;
};

type ProductAttributeMapping = {
  id: string;
  productId: string;
  attributeId: string;
  required: boolean;
  gridAxis?: GridAxis | null;
  visibleOnStorefront?: boolean;
  attribute: {
    id: string;
    name: string;
    role: AttributeRole;
    values: AttributeValueDetail[];
  };
  allowedValues: {
    attributeValueId: string;
    attributeValue: AttributeValueDetail;
  }[];
};

type VariantGridCell = {
  columnValue: AttributeValueDetail;
  variant: VariantRow | null;
};

type VariantGridDisplayRow = {
  value: AttributeValueDetail;
  cells: VariantGridCell[];
};

type VariantGridState =
  | { mode: "flat"; reasons: string[] }
  | {
      mode: "grid";
      reasons: [];
      rowAxis: ProductAttributeMapping;
      columnAxis: ProductAttributeMapping;
      rows: VariantGridDisplayRow[];
    };

type SelectionMap = Record<string, string[]>;
type GenerateAttributeMode = "all" | "specific" | "skip";
type GenerateModeMap = Record<string, GenerateAttributeMode>;
type ManualAttributeMode = "single" | "specific" | "all";
type ManualModeMap = Record<string, ManualAttributeMode>;
type SingleSelectionMap = Record<string, string>;
type ProductTranslationField = "title" | "shortDescription" | "description" | "seoTitle" | "seoDescription" | "seoKeywords" | "highlights" | "technicalSpecs" | "warranty" | "primaryFeatures";

type ProductTranslationDraft = {
  highlights: Array<{ title: string; description: string; image?: string }>;
  technicalSpecs: Array<{ label: string; value: string; image?: string }>;
  warranty: string[];
  primaryFeatures: Array<{ title: string; description: string }>;
};

type CountryAvailability = {
  id: string;
  name: string;
  code: string;
  status: string;
  enabled: boolean;
  currency?: { symbol?: string | null; code?: string | null; exchangeRate?: number | string | null } | null;
};

type BulkVariantDraft = {
  mrp?: string;
  price?: string;
  dealerPrice?: string;
  doctorRetailerPrice?: string;
  stock?: string;
};

type BulkCountryOption = {
  id: string;
  code?: string;
  label: string;
  currencySymbol?: string | null;
};

type TierRow = { id: string; name: string; status: string };
type PricingRuleRow = {
  id: string;
  tier?: { id: string; name: string } | null;
  country?: { id: string; name: string; code: string } | null;
  variant?: { id: string; title: string; sku?: string | null } | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  discountPercent?: string | number | null;
  fixedPrice?: string | number | null;
};

type RuleDraft = {
  id?: string;
  tierId: string;
  countryId: string;
  variantId: string;
  countryIds?: string[];
  variantIds?: string[];
  minQuantity: string;
  maxQuantity: string;
  mode: "discount" | "fixed";
  discountPercent: string;
  fixedPrice: string;
};

const emptyRuleDraft: RuleDraft = {
  tierId: "",
  countryId: "",
  variantId: "",
  countryIds: [],
  variantIds: [],
  minQuantity: "10",
  maxQuantity: "",
  mode: "discount",
  discountPercent: "",
  fixedPrice: "",
};

const getVariantPriceForCountry = (variant: VariantRow, countryId?: string, productBasePrices?: any[]) => {
  const specific = countryId ? variant.prices?.find((price) => price.countryId === countryId || price.country?.id === countryId) : variant.prices?.[0];
  if (specific) return specific;
  const base = countryId ? productBasePrices?.find((price) => price.countryId === countryId || price.country?.id === countryId) : productBasePrices?.[0];
  return base ?? null;
};

const formatVariantPrice = (variant: VariantRow, productBasePrices?: any[]) => {
  const price = getVariantPriceForCountry(variant, undefined, productBasePrices);
  const amount = price?.sellingPrice ?? price?.mrp;
  if (amount === null || amount === undefined || amount === "") return "—";
  return `${price?.currency?.symbol ?? ""}${amount}`;
};

function VariantGridMatrix({
  gridState,
  onEditVariant,
  onManageCountries,
  bulkEditMode,
  bulkCountryId,
  rowErrors,
  getDraft,
  onDraftChange,
  productBasePrices,
}: {
  gridState: Extract<VariantGridState, { mode: "grid" }>;
  onEditVariant: (variant: VariantRow) => void;
  onManageCountries: (variant: VariantRow) => void;
  bulkEditMode?: boolean;
  bulkCountryId?: string;
  rowErrors?: Record<string, string>;
  getDraft?: (variant: VariantRow) => Required<BulkVariantDraft>;
  onDraftChange?: (variantId: string, patch: BulkVariantDraft) => void;
  productBasePrices?: any[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E6E6E6]">
      <table className="min-w-full border-collapse text-left text-[13px]">
        <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
          <tr>
            <th className="min-w-[180px] border-b border-r border-[#E6E6E6] px-4 py-3">
              {gridState.rowAxis.attribute.name} / {gridState.columnAxis.attribute.name}
            </th>
            {gridState.rows[0]?.cells.map((cell) => (
              <th key={cell.columnValue.id} className="min-w-[220px] border-b border-[#E6E6E6] px-4 py-3">
                {cell.columnValue.value}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridState.rows.map((row) => (
            <tr key={row.value.id} className="border-b border-[#F0F0F0] last:border-b-0">
              <th className="border-r border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]">
                {row.value.value}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.columnValue.id} className="align-top px-4 py-3">
                  {cell.variant ? (
                    <div className="space-y-2">
                      <div>
                        <div className="font-medium text-[#1A1A1A]">{cell.variant.title}</div>
                        <div className="mt-0.5 text-[12px] text-[#6B6B6B]">{cell.variant.sku || "No SKU"}</div>
                      </div>
                      {bulkEditMode && getDraft && onDraftChange ? (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Selling
                           <input
                              type="text"
                              value={getDraft(cell.variant).price}
                              onChange={(e) => onDraftChange(cell.variant!.id, { price: e.target.value.replace(/[^0-9.]/g, "") })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Dealer
                            <input
                              type="text"
                              value={getDraft(cell.variant).dealerPrice}
                              onChange={(e) => onDraftChange(cell.variant!.id, { dealerPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Doctor / Retailer
                            <input
                              type="text"
                              value={getDraft(cell.variant).doctorRetailerPrice}
                              onChange={(e) => onDraftChange(cell.variant!.id, { doctorRetailerPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Stock
                            <input
                              type="text"
                              value={getDraft(cell.variant).stock}
                              onChange={(e) => onDraftChange(cell.variant!.id, { stock: e.target.value.replace(/\D/g, "") })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          {rowErrors?.[cell.variant.id] && (
                            <p className="col-span-2 text-[11.5px] text-red-600">{rowErrors[cell.variant.id]}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#555]">
                          <span>Stock: {getBaseInventory(cell.variant.inventories)?.stock ?? "No stock"}</span>
                          <span>Price: {bulkCountryId ? `${getVariantPriceForCountry(cell.variant, bulkCountryId, productBasePrices)?.currency?.symbol ?? ""}${getVariantPriceForCountry(cell.variant, bulkCountryId, productBasePrices)?.sellingPrice ?? "No price"}` : formatVariantPrice(cell.variant, productBasePrices)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={cell.variant.status} />
                        <button
                          type="button"
                          onClick={() => onEditVariant(cell.variant!)}
                          className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
                          title="Edit variant"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onManageCountries(cell.variant!)}
                          className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
                          title="Country availability"
                        >
                          <Globe2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[12px] text-[#9A9A9A]">No variant</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ProductEditorProps = {
  productId: string;
  isEmbed?: boolean;
};

export function ProductEditor({ productId, isEmbed }: ProductEditorProps) {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("products.update");
  const isReadOnly = !canUpdate;
  const canManageAttributes = hasPermission("attributes.update");

  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter((t) => !t.permission || hasPermission(t.permission));
  }, [hasPermission]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const variantIdFromQuery = searchParams.get("variant");
  const [activeTab, setActiveTab] = useState(0);
  const [pricingSubTab, setPricingSubTab] = useState<"base" | "variant_prices" | "tier" | "moq">("base");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingMediaCount, setUploadingMediaCount] = useState(0);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [isDragOverPdf, setIsDragOverPdf] = useState(false);
  const [pdfMediaSelectorOpen, setPdfMediaSelectorOpen] = useState(false);
  const [imageMediaSelectorOpen, setImageMediaSelectorOpen] = useState(false);
  const [infoImageSelectorOpen, setInfoImageSelectorOpen] = useState(false);
  const [specDiagramSelectorOpen, setSpecDiagramSelectorOpen] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<string | null>(null);
  const [settingCoverMediaId, setSettingCoverMediaId] = useState<string | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const lastSelectedMediaIndexRef = useRef<number | null>(null);
  const [previewMediaIndex, setPreviewMediaIndex] = useState<number | null>(null);
  const [isDragOverMedia, setIsDragOverMedia] = useState(false);
  const [deletingBulkMedia, setDeletingBulkMedia] = useState(false);
  const [deletingAllMedia, setDeletingAllMedia] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<PackageRow | null>(null);
  const [deletedDefaultPackageIds, setDeletedDefaultPackageIds] = useState<string[]>([]);
  const [deletingVariant, setDeletingVariant] = useState<VariantRow | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageRow | null>(null);
  const [packageTitle, setPackageTitle] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageImage, setPackageImage] = useState("");
  const [uploadingPackageImage, setUploadingPackageImage] = useState(false);
  const [packageMediaSelectorOpen, setPackageMediaSelectorOpen] = useState(false);
  const [packageSortOrder, setPackageSortOrder] = useState(0);
  const [packageStatus, setPackageStatus] = useState("ACTIVE");

  const [deletingInventoryAssignment, setDeletingInventoryAssignment] = useState<{ id: string; warehouseName: string } | null>(null);
  const [showBulkDeleteInventoryModal, setShowBulkDeleteInventoryModal] = useState(false);
  const [deletingPriceId, setDeletingPriceId] = useState<string | null>(null);
  const [deletingBulkPrices, setDeletingBulkPrices] = useState(false);
  const [deletingBulkVariantPrices, setDeletingBulkVariantPrices] = useState(false);
  const [deletingAllBasePrices, setDeletingAllBasePrices] = useState(false);
  const [deletingBulkVariantsModal, setDeletingBulkVariantsModal] = useState(false);

  // Modals state for Product Info tab sections
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [featureTitleState, setFeatureTitleState] = useState("");
  const [featureDescriptionState, setFeatureDescriptionState] = useState("");

  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingSpecIndex, setEditingSpecIndex] = useState<number | null>(null);
  const [specLabelState, setSpecLabelState] = useState("");
  const [specValueState, setSpecValueState] = useState("");
  const [uploadingSpecDiagrams, setUploadingSpecDiagrams] = useState(false);

  const [directionModalOpen, setDirectionModalOpen] = useState(false);
  const [editingDirectionIndex, setEditingDirectionIndex] = useState<number | null>(null);
  const [directionTitleState, setDirectionTitleState] = useState("");
  const [directionDescriptionState, setDirectionDescriptionState] = useState("");

  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [editingWarrantyIndex, setEditingWarrantyIndex] = useState<number | null>(null);
  const [warrantyTextState, setWarrantyTextState] = useState("");

  const [additionalInfoModalOpen, setAdditionalInfoModalOpen] = useState(false);
  const [editingAdditionalInfoIndex, setEditingAdditionalInfoIndex] = useState<number | null>(null);
  const [additionalInfoLabelState, setAdditionalInfoLabelState] = useState("");
  const [additionalInfoValueState, setAdditionalInfoValueState] = useState("");

  const [highlightProductCode, setHighlightProductCode] = useState(false);

  const goToBasicInfoAndFocusProductCode = () => {
    setActiveTab(0);
    setHighlightProductCode(true);
    setTimeout(() => {
      const el = document.getElementById("product-code-input") as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }, 120);
    setTimeout(() => {
      setHighlightProductCode(false);
    }, 3000);
  };

  // Additional Info Modal Handlers
  const openAdditionalInfoModal = (index?: number) => {
    const list = form.values.additionalInfo || [];
    if (index !== undefined && list[index]) {
      setEditingAdditionalInfoIndex(index);
      setAdditionalInfoLabelState(list[index].label || "");
      setAdditionalInfoValueState(list[index].value || "");
    } else {
      setEditingAdditionalInfoIndex(null);
      setAdditionalInfoLabelState("");
      setAdditionalInfoValueState("");
    }
    setAdditionalInfoModalOpen(true);
  };

  const handleSaveAdditionalInfoModal = () => {
    const list = [...(form.values.additionalInfo || [])];
    const newItem = { label: additionalInfoLabelState.trim(), value: additionalInfoValueState.trim() };
    if (editingAdditionalInfoIndex !== null) {
      list[editingAdditionalInfoIndex] = newItem;
    } else {
      list.push(newItem);
    }
    form.setFieldValue("additionalInfo", list);
    setAdditionalInfoModalOpen(false);
  };

  const handleDeleteAdditionalInfoItem = (index: number) => {
    const list = [...(form.values.additionalInfo || [])];
    list.splice(index, 1);
    form.setFieldValue("additionalInfo", list);
  };

  // Feature Modal Handlers
  const openFeatureModal = (index?: number) => {
    const list = form.values.highlights || [];
    if (index !== undefined && list[index]) {
      setEditingFeatureIndex(index);
      setFeatureTitleState(list[index].title || "");
      setFeatureDescriptionState(list[index].description || "");
    } else {
      setEditingFeatureIndex(null);
      setFeatureTitleState("");
      setFeatureDescriptionState("");
    }
    setFeatureModalOpen(true);
  };

  const handleSaveFeatureModal = () => {
    const list = [...(form.values.highlights || [])];
    const newItem = { title: featureTitleState.trim(), description: featureDescriptionState.trim() };
    if (editingFeatureIndex !== null) {
      list[editingFeatureIndex] = newItem;
    } else {
      list.push(newItem);
    }
    form.setFieldValue("highlights", list);
    setFeatureModalOpen(false);
  };

  const handleDeleteFeatureItem = (index: number) => {
    const list = [...(form.values.highlights || [])];
    list.splice(index, 1);
    form.setFieldValue("highlights", list);
  };

  // Key Spec Modal Handlers
  const openSpecModal = (index?: number) => {
    const list = form.values.technicalSpecs || [];
    if (index !== undefined && list[index]) {
      setEditingSpecIndex(index);
      setSpecLabelState(list[index].label || "");
      setSpecValueState(list[index].value || "");
    } else {
      setEditingSpecIndex(null);
      setSpecLabelState("");
      setSpecValueState("");
    }
    setSpecModalOpen(true);
  };

  const handleSaveSpecModal = () => {
    const list = [...(form.values.technicalSpecs || [])];
    const newItem = {
      label: specLabelState.trim(),
      value: specValueState.trim(),
    };
    if (editingSpecIndex !== null) {
      list[editingSpecIndex] = newItem;
    } else {
      list.push(newItem);
    }
    form.setFieldValue("technicalSpecs", list);
    setSpecModalOpen(false);
  };

  const handleDeleteSpecItem = (index: number) => {
    const list = [...(form.values.technicalSpecs || [])];
    list.splice(index, 1);
    form.setFieldValue("technicalSpecs", list);
  };

  // Multiple Diagram Upload Handlers for Key Specifications
  const handleUploadSpecDiagrams = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setUploadingSpecDiagrams(true);
    try {
      const results = await uploadMediaFiles(files, {
        entityType: "SYSTEM",
        purpose: "SPEC_DIAGRAM",
      });
      const newDiagrams = results
        .filter((r) => r?.url)
        .map((r, idx) => ({
          url: r.url,
          title: `Specification Diagram ${(form.values.specImages?.length || 0) + idx + 1}`,
        }));
      if (newDiagrams.length > 0) {
        form.setFieldValue("specImages", [...(form.values.specImages || []), ...newDiagrams]);
        showToast(`${newDiagrams.length} specification diagram(s) uploaded.`);
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to upload specification diagrams."), "error");
    } finally {
      setUploadingSpecDiagrams(false);
    }
  };

  const handleDeleteSpecDiagram = (index: number) => {
    const list = [...(form.values.specImages || [])];
    list.splice(index, 1);
    form.setFieldValue("specImages", list);
    showToast("Diagram removed.");
  };

  const handleUpdateSpecDiagramTitle = (index: number, newTitle: string) => {
    const list = [...(form.values.specImages || [])];
    if (list[index]) {
      list[index] = { ...list[index], title: newTitle };
      form.setFieldValue("specImages", list);
    }
  };

  // Direction To Use Modal Handlers
  const openDirectionModal = (index?: number) => {
    const list = form.values.primaryFeatures || [];
    if (index !== undefined && list[index]) {
      setEditingDirectionIndex(index);
      setDirectionTitleState(list[index].title || "");
      setDirectionDescriptionState(list[index].description || "");
    } else {
      setEditingDirectionIndex(null);
      setDirectionTitleState("");
      setDirectionDescriptionState("");
    }
    setDirectionModalOpen(true);
  };

  const handleSaveDirectionModal = () => {
    const list = [...(form.values.primaryFeatures || [])];
    const newItem = { title: directionTitleState.trim(), description: directionDescriptionState.trim() };
    if (editingDirectionIndex !== null) {
      list[editingDirectionIndex] = newItem;
    } else {
      list.push(newItem);
    }
    form.setFieldValue("primaryFeatures", list);
    setDirectionModalOpen(false);
  };

  const handleDeleteDirectionItem = (index: number) => {
    const list = [...(form.values.primaryFeatures || [])];
    list.splice(index, 1);
    form.setFieldValue("primaryFeatures", list);
  };

  // Warranty Modal Handlers
  const openWarrantyModal = (index?: number) => {
    const list = form.values.warranty || [];
    if (index !== undefined && list[index] !== undefined) {
      setEditingWarrantyIndex(index);
      setWarrantyTextState(list[index] || "");
    } else {
      setEditingWarrantyIndex(null);
      setWarrantyTextState("");
    }
    setWarrantyModalOpen(true);
  };

  const handleSaveWarrantyModal = () => {
    const list = [...(form.values.warranty || [])];
    if (editingWarrantyIndex !== null) {
      list[editingWarrantyIndex] = warrantyTextState.trim();
    } else {
      list.push(warrantyTextState.trim());
    }
    form.setFieldValue("warranty", list);
    setWarrantyModalOpen(false);
  };

  const handleDeleteWarrantyItem = (index: number) => {
    const list = [...(form.values.warranty || [])];
    list.splice(index, 1);
    form.setFieldValue("warranty", list);
  };
  const [manualVariantOpen, setManualVariantOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantRow | null>(null);
  const [isUpdatingVariant, setIsUpdatingVariant] = useState(false);
  const [editVariantSubTab, setEditVariantSubTab] = useState<"general" | "prices" | "tiers" | "moqs">("general");
  const [editVariantCountryPrices, setEditVariantCountryPrices] = useState<Record<string, { mrp: string; sellingPrice: string; dealerPrice: string; doctorRetailerPrice: string; stock?: string }>>({});
  const [modalTierRuleDraft, setModalTierRuleDraft] = useState({
    tierId: "",
    countryId: "",
    mode: "discount" as "discount" | "fixed",
    discountPercent: "",
    fixedPrice: "",
  });
  const [modalMoqRuleDraft, setModalMoqRuleDraft] = useState({
    countryId: "",
    minQuantity: "",
    maxQuantity: "",
    mode: "discount" as "discount" | "fixed",
    discountPercent: "",
    fixedPrice: "",
  });
  const [bulkPriceUpdateModalContext, setBulkPriceUpdateModalContext] = useState<'variants' | 'base' | 'variant_prices' | null>(null);
  const [bulkCountryAvailabilityCountryIds, setBulkCountryAvailabilityCountryIds] = useState<string[]>([]);
  const [modalCountryIds, setModalCountryIds] = useState<string[]>(["ALL_COUNTRIES"]);
  const [bulkPriceUpdateDraft, setBulkPriceUpdateDraft] = useState({
    mrp: "",
    sellingPrice: "",
    dealerPrice: "",
    doctorRetailerPrice: "",
  });
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [generateVariantOpen, setGenerateVariantOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [generateVariantBasePrice, setGenerateVariantBasePrice] = useState("");
  const [generateAttributeIds, setGenerateAttributeIds] = useState<string[]>([]);
  const [manualVariantAttributeIds, setManualVariantAttributeIds] = useState<string[]>([]);
  const [manualVariantSelectionMap, setManualVariantSelectionMap] = useState<SelectionMap>({});
  const [manualVariantModeMap, setManualVariantModeMap] = useState<ManualModeMap>({});
  const [manualVariantAttributePicker, setManualVariantAttributePicker] = useState("");
  const [editVariantAttributeIds, setEditVariantAttributeIds] = useState<string[]>([]);
  const [editVariantSelections, setEditVariantSelections] = useState<SingleSelectionMap>({});
  const [editVariantAttributePicker, setEditVariantAttributePicker] = useState("");
  const [generateSelectionMap, setGenerateSelectionMap] = useState<SelectionMap>({});
  const [lastSelectedValueMap, setLastSelectedValueMap] = useState<Record<string, string>>({});
  const [generateModeMap, setGenerateModeMap] = useState<GenerateModeMap>({});
  const [generatePackageIds, setGeneratePackageIds] = useState<string[]>([]);
  const [generateAttributePicker, setGenerateAttributePicker] = useState("");
  const [generateValuePickerMap, setGenerateValuePickerMap] = useState<Record<string, string>>({});
  const [manualVariantPackageId, setManualVariantPackageId] = useState("");
  const [manualVariantSku, setManualVariantSku] = useState("");
  const [manualVariantMoq, setManualVariantMoq] = useState(1);
  const [editVariantPackageId, setEditVariantPackageId] = useState("");
  const [editVariantSku, setEditVariantSku] = useState("");
  const [editVariantTitle, setEditVariantTitle] = useState("");
  const [editVariantMoq, setEditVariantMoq] = useState(1);
  const [editVariantWeight, setEditVariantWeight] = useState("");
  const [editVariantLength, setEditVariantLength] = useState("");
  const [editVariantWidth, setEditVariantWidth] = useState("");
  const [editVariantHeight, setEditVariantHeight] = useState("");
  const [editVariantShippingClass, setEditVariantShippingClass] = useState("");
  const [editVariantFragile, setEditVariantFragile] = useState(false);
  const [editVariantHazardous, setEditVariantHazardous] = useState(false);
  const [editVariantStatus, setEditVariantStatus] = useState("ACTIVE");
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, ProductTranslationDraft>>({});
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [variantTabSearchQuery, setVariantTabSearchQuery] = useState("");
  const [variantTabStatusFilter, setVariantTabStatusFilter] = useState("");
  const [variantTabStockFilter, setVariantTabStockFilter] = useState("");
  const [variantTabWarehouseFilter, setVariantTabWarehouseFilter] = useState("");
  const [filterSku, setFilterSku] = useState("");
  const [filterVariantName, setFilterVariantName] = useState("");
  const [filterAttributes, setFilterAttributes] = useState("");
  const [filterStock, setFilterStock] = useState("");
  const [filterPrice, setFilterPrice] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [shippingPackageWeight, setShippingPackageWeight] = useState("");
  const [shippingPackageLength, setShippingPackageLength] = useState("");
  const [shippingPackageWidth, setShippingPackageWidth] = useState("");
  const [shippingPackageHeight, setShippingPackageHeight] = useState("");
  const [shippingClass, setShippingClass] = useState("");
  const [shippingFragile, setShippingFragile] = useState(false);
  const [shippingHazardous, setShippingHazardous] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [bulkActionType, setBulkActionType] = useState("Bulk Action");
  const [bulkActionValue, setBulkActionValue] = useState("");
  const [filterPriceCountry, setFilterPriceCountry] = useState("");
  const [filterPriceMRP, setFilterPriceMRP] = useState("");
  const [filterPriceSelling, setFilterPriceSelling] = useState("");
  const [filterPriceDealer, setFilterPriceDealer] = useState("");
  const [filterPriceDoctor, setFilterPriceDoctor] = useState("");
  const [filterPriceStatus, setFilterPriceStatus] = useState("");
  const [pricePageSize, setPricePageSize] = useState(100);
  const [priceCurrentPage, setPriceCurrentPage] = useState(1);
  const [priceSortField, setPriceSortField] = useState<string | null>(null);
  const [priceSortDirection, setPriceSortDirection] = useState<"asc" | "desc">("asc");
  const [priceBulkActionType, setPriceBulkActionType] = useState("Bulk Action");
  const [filterVPVariant, setFilterVPVariant] = useState("");
  const [filterVPCountry, setFilterVPCountry] = useState("");
  const [filterVPMRP, setFilterVPMRP] = useState("");
  const [filterVPSelling, setFilterVPSelling] = useState("");
  const [filterVPDealer, setFilterVPDealer] = useState("");
  const [filterVPDoctor, setFilterVPDoctor] = useState("");
  const [filterVPStatus, setFilterVPStatus] = useState("");
  const [vpPageSize, setVpPageSize] = useState(100);
  const [vpCurrentPage, setVpCurrentPage] = useState(1);
  const [vpSortField, setVpSortField] = useState<string | null>(null);
  const [vpSortDirection, setVpSortDirection] = useState<"asc" | "desc">("asc");
  const [vpBulkActionType, setVpBulkActionType] = useState("Bulk Action");
  const [selectedVPIds, setSelectedVPIds] = useState<string[]>([]);
  const lastSelectedVPIndexRef = useRef<number | null>(null);
  const [expandedVPVariantIds, setExpandedVPVariantIds] = useState<string[]>([]);
  const [filterInvVariant, setFilterInvVariant] = useState("");
  const [filterInvType, setFilterInvType] = useState("");
  const [filterInvStock, setFilterInvStock] = useState("");
  const [filterInvLowStock, setFilterInvLowStock] = useState("");
  const [invPageSize, setInvPageSize] = useState(100);
  const [invCurrentPage, setInvCurrentPage] = useState(1);
  const [invSortField, setInvSortField] = useState<string | null>(null);
  const [invSortDirection, setInvSortDirection] = useState<"asc" | "desc">("asc");
  const [invBulkActionType, setInvBulkActionType] = useState("Bulk Action");
  const [invBulkActionValue, setInvBulkActionValue] = useState("");
  const [invBulkCountryId, setInvBulkCountryId] = useState("");
  const [selectedInvIds, setSelectedInvIds] = useState<string[]>([]);
  const lastSelectedGroupIndexRef = useRef<number | null>(null);
  const [variantCountryModalVariant, setVariantCountryModalVariant] = useState<VariantRow | null>(null);
  const [variantCountryOverrides, setVariantCountryOverrides] = useState<Record<string, boolean>>({});
  const [inventoryOverrideDrafts, setInventoryOverrideDrafts] = useState<Record<string, { countryId: string; stock: string }>>({});
  const [selectedMappingAttributeId, setSelectedMappingAttributeId] = useState("");
  const [newMappingRequired, setNewMappingRequired] = useState(true);
  const [newMappingGridAxis, setNewMappingGridAxis] = useState<GridAxis | null>(null);
  const [newMappingValueIds, setNewMappingValueIds] = useState<string[]>([]);
  const [mappingValueFilter, setMappingValueFilter] = useState<"ALL" | "SELECTED" | "UNSELECTED">("ALL");
  const [mappingValueSearch, setMappingValueSearch] = useState("");
  const [attrImportOpen, setAttrImportOpen] = useState(false);
  const [attrExporting, setAttrExporting] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkCountryIds, setBulkCountryIds] = useState<string[]>(["ALL"]);
  const [variantTableDisplayCountryId, setVariantTableDisplayCountryId] = useState("");
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, BulkVariantDraft>>({});
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [variantPriceExporting, setVariantPriceExporting] = useState(false);
  const [variantPriceImporting, setVariantPriceImporting] = useState(false);
  const variantPriceImportInputRef = useRef<HTMLInputElement>(null);
  const attributeEditPanelRef = useRef<HTMLDivElement>(null);
  const draggingCardAttrRef = useRef<string | null>(null);
  const draggedCardElementRef = useRef<HTMLElement | null>(null);

  const clearCardDragStyles = () => {
    if (draggedCardElementRef.current) {
      draggedCardElementRef.current.classList.remove("opacity-40", "border-dashed", "border-[#E31E24]");
      draggedCardElementRef.current = null;
    }
    if (typeof document !== "undefined") {
      document.body.classList.remove("card-drag-in-progress");
      document.querySelectorAll(".mapped-attr-card").forEach((el) => {
        el.classList.remove("opacity-40", "border-dashed", "border-[#E31E24]", "ring-2", "ring-[#E31E24]/20", "shadow-md");
      });
    }
  };
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const lastSelectedVariantIndexRef = useRef<number | null>(null);
  const [tierRuleDraft, setTierRuleDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [moqRuleDraft, setMoqRuleDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [editingTierRuleId, setEditingTierRuleId] = useState<string | null>(null);
  const [editingMoqRuleId, setEditingMoqRuleId] = useState<string | null>(null);
  const [countryPriceModalOpen, setCountryPriceModalOpen] = useState(false);
  const [warehouseAssignModalOpen, setWarehouseAssignModalOpen] = useState(false);
  const [warehouseAssignSelections, setWarehouseAssignSelections] = useState<Record<string, boolean>>({});
  const [warehouseAssignStocks, setWarehouseAssignStocks] = useState<Record<string, string>>({});
  const [countryPriceMRP, setCountryPriceMRP] = useState("");
  const [countryPriceSellingPrice, setCountryPriceSellingPrice] = useState("");
  const [countryPriceDealerPrice, setCountryPriceDealerPrice] = useState("");
  const [countryPriceDistributorPrice, setCountryPriceDistributorPrice] = useState("");
  const [variantPriceOverrides, setVariantPriceOverrides] = useState<Record<string, { mrp?: string; sellingPrice?: string; dealerPrice?: string; distributorPrice?: string }>>({});
  const [generatingCountryPrices, setGeneratingCountryPrices] = useState(false);
  const [editingProductPrice, setEditingProductPrice] = useState<any | null>(null);
  const [editPriceForm, setEditPriceForm] = useState({
    mrp: "",
    sellingPrice: "",
    dealerPrice: "",
    distributorPrice: "",
    status: "ACTIVE",
  });
  const [basePriceBulkEditMode, setBasePriceBulkEditMode] = useState(false);
  const [basePriceBulkDrafts, setBasePriceBulkDrafts] = useState<Record<string, { mrp: string; sellingPrice: string; dealerPrice: string; distributorPrice: string; status: string }>>({});
  const [selectedPriceIds, setSelectedPriceIds] = useState<string[]>([]);
  const lastSelectedPriceIndexRef = useRef<number | null>(null);
  const [bulkEditPricesModalOpen, setBulkEditPricesModalOpen] = useState(false);
  const [bulkEditPricesForm, setBulkEditPricesForm] = useState({
    mrp: "",
    sellingPrice: "",
    dealerPrice: "",
    distributorPrice: "",
    status: "ACTIVE",
    updateMrp: false,
    updateSellingPrice: false,
    updateDealerPrice: false,
    updateDistributorPrice: false,
    updateStatus: false,
  });
  
  const [addVariantOverrideModalOpen, setAddVariantOverrideModalOpen] = useState(false);
  const [addVariantOverrideForm, setAddVariantOverrideForm] = useState({
    variantId: "",
    countryId: "",
    mrp: "",
    sellingPrice: "",
    dealerPrice: "",
    distributorPrice: "",
  });

  const { showToast, ToastComponent } = useToast();

  const { data: product, isLoading, isFetching, refetch } = useAdminProduct(productId);
  const { data: adminCurrencies = [] } = useAdminCurrencies();
  const baseCurrency = useMemo(() => {
    const list = Array.isArray(adminCurrencies) ? adminCurrencies : [];
    return (
      list.find((c: any) => c.isBase) ||
      list.find((c: any) => c.code === "USD") || {
        name: "US Dollar",
        code: "USD",
        symbol: "$",
        exchangeRate: 1,
        isBase: true,
      }
    );
  }, [adminCurrencies]);

  useEffect(() => {
    if (previewMediaIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const mediaList = (product?.media ?? []) as any[];
      if (!mediaList.length) return;
      if (e.key === "ArrowLeft") {
        setPreviewMediaIndex((prev) => (prev === null ? null : (prev - 1 + mediaList.length) % mediaList.length));
      } else if (e.key === "ArrowRight") {
        setPreviewMediaIndex((prev) => (prev === null ? null : (prev + 1) % mediaList.length));
      } else if (e.key === "Escape") {
        setPreviewMediaIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewMediaIndex, product]);

  const productBasePrices = useMemo(() => {
    return (product?.prices || []).filter((p: any) => !p.variantId);
  }, [product?.prices]);

  const filteredBasePrices = useMemo(() => {
    let rows = (product?.prices || []).filter((p: any) => !p.variantId);

    // Client-side column filters
    if (filterPriceCountry.trim()) {
      const q = filterPriceCountry.toLowerCase().trim();
      rows = rows.filter((p: any) => {
        const countryName = p.country?.name?.toLowerCase() ?? "";
        const countryCode = p.country?.code?.toLowerCase() ?? "";
        return countryName.includes(q) || countryCode.includes(q);
      });
    }

    if (filterPriceMRP.trim()) {
      const q = filterPriceMRP.trim();
      rows = rows.filter((p: any) => {
        const val = Number(p.mrp ?? 0);
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterPriceSelling.trim()) {
      const q = filterPriceSelling.trim();
      rows = rows.filter((p: any) => {
        const val = Number(p.sellingPrice ?? 0);
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterPriceDealer.trim()) {
      const q = filterPriceDealer.trim();
      rows = rows.filter((p: any) => {
        const val = p.dealerPrice != null ? Number(p.dealerPrice) : null;
        if (val === null) return false;
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterPriceDoctor.trim()) {
      const q = filterPriceDoctor.trim();
      rows = rows.filter((p: any) => {
        const val = p.distributorPrice != null ? Number(p.distributorPrice) : null;
        if (val === null) return false;
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterPriceStatus && filterPriceStatus !== "") {
      rows = rows.filter((p: any) => p.status === filterPriceStatus);
    }

    // Client-side sorting
    if (priceSortField) {
      rows = [...rows].sort((a: any, b: any) => {
        let valA: any = "";
        let valB: any = "";
        if (priceSortField === "country") {
          valA = a.country?.name ?? "";
          valB = b.country?.name ?? "";
        } else if (priceSortField === "mrp") {
          valA = Number(a.mrp ?? 0);
          valB = Number(b.mrp ?? 0);
        } else if (priceSortField === "sellingPrice") {
          valA = Number(a.sellingPrice ?? 0);
          valB = Number(b.sellingPrice ?? 0);
        } else if (priceSortField === "dealerPrice") {
          valA = a.dealerPrice != null ? Number(a.dealerPrice) : -1;
          valB = b.dealerPrice != null ? Number(b.dealerPrice) : -1;
        } else if (priceSortField === "distributorPrice") {
          valA = a.distributorPrice != null ? Number(a.distributorPrice) : -1;
          valB = b.distributorPrice != null ? Number(b.distributorPrice) : -1;
        } else if (priceSortField === "status") {
          valA = a.status ?? "";
          valB = b.status ?? "";
        }
        if (valA < valB) return priceSortDirection === "asc" ? -1 : 1;
        if (valA > valB) return priceSortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [
    product?.prices,
    filterPriceCountry,
    filterPriceMRP,
    filterPriceSelling,
    filterPriceDealer,
    filterPriceDoctor,
    filterPriceStatus,
    priceSortField,
    priceSortDirection,
  ]);

  const totalPriceItems = filteredBasePrices.length;
  const totalPricePages = Math.ceil(totalPriceItems / pricePageSize) || 1;

  useEffect(() => {
    if (priceCurrentPage > totalPricePages) {
      setPriceCurrentPage(1);
    }
  }, [totalPricePages, priceCurrentPage]);

  const paginatedBasePrices = useMemo(() => {
    const start = (priceCurrentPage - 1) * pricePageSize;
    const end = start + pricePageSize;
    return filteredBasePrices.slice(start, end);
  }, [filteredBasePrices, priceCurrentPage, pricePageSize]);


  const handleToggleBasePriceBulkEdit = () => {
    if (basePriceBulkEditMode) {
      setBasePriceBulkEditMode(false);
      setBasePriceBulkDrafts({});
    } else {
      const initialDrafts: any = {};
      productBasePrices.forEach((price: any) => {
        initialDrafts[price.id] = {
          mrp: String(price.mrp),
          sellingPrice: String(price.sellingPrice),
          dealerPrice: price.dealerPrice != null ? String(price.dealerPrice) : "",
          distributorPrice: price.distributorPrice != null ? String(price.distributorPrice) : "",
          status: price.status,
        };
      });
      setBasePriceBulkDrafts(initialDrafts);
      setBasePriceBulkEditMode(true);
    }
  };

  const handleSaveAllBasePrices = async () => {
    try {
      setBulkSaving(true);
      const updatePromises = Object.entries(basePriceBulkDrafts).map(([priceId, draft]: [string, any]) => {
        return adminApi.put(`/pricing/${priceId}`, {
          mrp: Number(draft.mrp),
          sellingPrice: Number(draft.sellingPrice),
          dealerPrice: draft.dealerPrice ? Number(draft.dealerPrice) : null,
          distributorPrice: draft.distributorPrice ? Number(draft.distributorPrice) : null,
          status: draft.status,
        });
      });
      await Promise.all(updatePromises);
      showToast("All base prices updated successfully.");
      setBasePriceBulkEditMode(false);
      setBasePriceBulkDrafts({});
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save base prices."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const renderBulkBasePriceTable = () => (
    <div className="overflow-x-auto rounded-lg border border-[#E6E6E6]">
      <table className="min-w-full border-collapse text-left text-[13px]">
        <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
          <tr>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Country</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">MRP</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Selling Price</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Dealer</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Doctor / Retailer</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {productBasePrices.map((price: any) => {
            const draft = basePriceBulkDrafts[price.id] || { mrp: "", sellingPrice: "", dealerPrice: "", distributorPrice: "", status: "ACTIVE" };
            return (
              <tr key={price.id} className="border-b border-[#F0F0F0] last:border-b-0">
                <td className="px-4 py-3 font-medium text-[#1A1A1A]">
                  {price.country.name} ({price.country.code})
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="text"
                      value={draft.mrp}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], mrp: e.target.value.replace(/[^0-9.]/g, "") }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="text"
                      value={draft.sellingPrice}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], sellingPrice: e.target.value.replace(/[^0-9.]/g, "") }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="text"
                      value={draft.dealerPrice}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], dealerPrice: e.target.value.replace(/[^0-9.]/g, "") }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="text"
                      value={draft.distributorPrice}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], distributorPrice: e.target.value.replace(/[^0-9.]/g, "") }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={draft.status}
                    onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                      ...prev,
                      [price.id]: { ...prev[price.id], status: e.target.value }
                    }))}
                    className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24] bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const handleStartEditPrice = (price: any) => {
    setEditingProductPrice(price);
    setEditPriceForm({
      mrp: String(price.mrp),
      sellingPrice: String(price.sellingPrice),
      dealerPrice: price.dealerPrice != null ? String(price.dealerPrice) : "",
      distributorPrice: price.distributorPrice != null ? String(price.distributorPrice) : "",
      status: price.status,
    });
  };

  const handleSaveProductPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductPrice) return;
    try {
      await adminApi.put(`/pricing/${editingProductPrice.id}`, {
        mrp: Number(editPriceForm.mrp),
        sellingPrice: Number(editPriceForm.sellingPrice),
        dealerPrice: editPriceForm.dealerPrice ? Number(editPriceForm.dealerPrice) : null,
        distributorPrice: editPriceForm.distributorPrice ? Number(editPriceForm.distributorPrice) : null,
        status: editPriceForm.status,
      });
      showToast("Price updated successfully.");
      setEditingProductPrice(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update price."), "error");
    }
  };

  const handleAddVariantOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addVariantOverrideForm.variantId || !addVariantOverrideForm.countryId) {
      showToast("Please select both a variant and a country.", "error");
      return;
    }
    
    try {
      await adminApi.post("/pricing", {
        productId,
        variantId: addVariantOverrideForm.variantId,
        countryId: addVariantOverrideForm.countryId,
        mrp: Number(addVariantOverrideForm.mrp) || null,
        sellingPrice: Number(addVariantOverrideForm.sellingPrice) || null,
        dealerPrice: addVariantOverrideForm.dealerPrice ? Number(addVariantOverrideForm.dealerPrice) : null,
        distributorPrice: addVariantOverrideForm.distributorPrice ? Number(addVariantOverrideForm.distributorPrice) : null,
        status: "ACTIVE",
      });
      showToast("Variant override added successfully.", "success");
      setAddVariantOverrideModalOpen(false);
      setAddVariantOverrideForm({
        variantId: "",
        countryId: "",
        mrp: "",
        sellingPrice: "",
        dealerPrice: "",
        distributorPrice: "",
      });
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to add override."), "error");
    }
  };

  const handleDeleteProductPrice = (priceId: string) => {
    setDeletingPriceId(priceId);
  };

  const confirmDeleteProductPrice = async () => {
    if (!deletingPriceId) return;
    try {
      await adminApi.delete(`/pricing/${deletingPriceId}`);
      showToast("Price deleted successfully.");
      setDeletingPriceId(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete price."), "error");
    }
  };

  const handleSelectAllPrices = () => {
    const allIds = productBasePrices.map((p: any) => p.id);
    if (selectedPriceIds.length === allIds.length) {
      setSelectedPriceIds([]);
    } else {
      setSelectedPriceIds(allIds);
    }
  };

  const handleToggleSelectPrice = (id: string) => {
    setSelectedPriceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartBulkEditPrices = () => {
    setBulkEditPricesForm({
      mrp: "",
      sellingPrice: "",
      dealerPrice: "",
      distributorPrice: "",
      status: "ACTIVE",
      updateMrp: false,
      updateSellingPrice: false,
      updateDealerPrice: false,
      updateDistributorPrice: false,
      updateStatus: false,
    });
    setBulkEditPricesModalOpen(true);
  };

  const handleSaveBulkEditPrices = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {};
      if (bulkEditPricesForm.updateMrp) payload.mrp = Number(bulkEditPricesForm.mrp);
      if (bulkEditPricesForm.updateSellingPrice) payload.sellingPrice = Number(bulkEditPricesForm.sellingPrice);
      if (bulkEditPricesForm.updateDealerPrice) {
        payload.dealerPrice = bulkEditPricesForm.updateDealerPrice && bulkEditPricesForm.dealerPrice ? Number(bulkEditPricesForm.dealerPrice) : null;
      }
      if (bulkEditPricesForm.updateDistributorPrice) {
        payload.distributorPrice = bulkEditPricesForm.updateDistributorPrice && bulkEditPricesForm.distributorPrice ? Number(bulkEditPricesForm.distributorPrice) : null;
      }
      if (bulkEditPricesForm.updateStatus) payload.status = bulkEditPricesForm.status;

      if (Object.keys(payload).length === 0) {
        showToast("No fields selected for update.", "error");
        return;
      }

      await Promise.all(
        selectedPriceIds.map((id) => adminApi.put(`/pricing/${id}`, payload))
      );

      showToast("Bulk edit completed successfully.");
      setBulkEditPricesModalOpen(false);
      setSelectedPriceIds([]);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to perform bulk edit."), "error");
    }
  };

  const handleBulkDeletePrices = () => {
    if (!selectedPriceIds.length) return;
    setDeletingBulkPrices(true);
  };

  const confirmBulkDeletePrices = async () => {
    try {
      await Promise.all(
        selectedPriceIds.map((id) => adminApi.delete(`/pricing/${id}`))
      );
      showToast(`${selectedPriceIds.length} price(s) deleted successfully.`);
      setSelectedPriceIds([]);
      setDeletingBulkPrices(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete selected prices."), "error");
    }
  };

  const handlePriceBulkApplyAction = async () => {
    if (!selectedPriceIds.length) {
      showToast("Please select at least one price row.", "error");
      return;
    }
    if (priceBulkActionType === "Bulk Action") {
      showToast("Please select a bulk action.", "error");
      return;
    }
    setBulkSaving(true);
    try {
      if (priceBulkActionType === "Delete selected") {
        setDeletingBulkPrices(true);
        setBulkSaving(false);
        return;
      } else {
        const payload: any = {};
        if (priceBulkActionType === "Mark active") {
          payload.status = "ACTIVE";
        } else if (priceBulkActionType === "Mark inactive") {
          payload.status = "INACTIVE";
        }
        await Promise.all(
          selectedPriceIds.map((id) => adminApi.put(`/pricing/${id}`, payload))
        );
        showToast(`Successfully updated ${selectedPriceIds.length} price(s).`, "success");
      }
      setSelectedPriceIds([]);
      setPriceBulkActionType("Bulk Action");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk update failed."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmBulkDeleteVariantPrices = async () => {
    try {
      const overridesToDelete = selectedVPIds.filter((id) => !id.startsWith("base-"));
      await Promise.all(overridesToDelete.map((id) => adminApi.delete(`/pricing/${id}`)));
      showToast(`Successfully deleted ${overridesToDelete.length} variant price(s). (Base prices ignored)`, "success");
      setSelectedVPIds([]);
      setVpBulkActionType("Bulk Action");
      setDeletingBulkVariantPrices(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete variant prices."), "error");
    }
  };

  const handleVPBulkApplyAction = async () => {
    if (!selectedVPIds.length) {
      showToast("Please select at least one variant price row.", "error");
      return;
    }
    if (vpBulkActionType === "Bulk Action") {
      showToast("Please select a bulk action.", "error");
      return;
    }
    setBulkSaving(true);
    try {
      if (vpBulkActionType === "Delete selected") {
        setDeletingBulkVariantPrices(true);
        setBulkSaving(false);
        return;
      } else {
        const payload: any = {};
        if (vpBulkActionType === "Mark active") {
          payload.status = "ACTIVE";
        } else if (vpBulkActionType === "Mark inactive") {
          payload.status = "INACTIVE";
        }
        const overridesToUpdate = selectedVPIds.filter(id => !id.startsWith("base-"));
        await Promise.all(
          overridesToUpdate.map((id) => adminApi.put(`/pricing/${id}`, payload))
        );
        showToast(`Successfully updated ${overridesToUpdate.length} variant price(s). (Base prices ignored)`, "success");
      }
      setSelectedVPIds([]);
      setVpBulkActionType("Bulk Action");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk update failed."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleWarehouseAssignSubmit = async () => {
    const selectedWarehouseIds = Object.keys(warehouseAssignSelections).filter(id => warehouseAssignSelections[id]);
    if (!selectedWarehouseIds.length) {
      showToast("Please select at least one warehouse.", "error");
      return;
    }

    // Validate stocks
    for (const wId of selectedWarehouseIds) {
      const stockVal = warehouseAssignStocks[wId]?.trim();
      if (stockVal && (isNaN(parseInt(stockVal)) || parseInt(stockVal) < 0)) {
        showToast("Please enter a valid stock level.", "error");
        return;
      }
    }

    setBulkSaving(true);
    try {
      const selectedInventories = paginatedVariantInventories.filter((inv: any) => selectedInvIds.includes(inv.id));
      
      const variantIds = Array.from(
        new Set(selectedInventories.filter((inv: any) => inv.variantId).map((inv: any) => inv.variantId))
      ) as string[];
      const hasBaseProductSelected = selectedInventories.some((inv: any) => !inv.variantId);

      // Perform updates
      for (const wId of selectedWarehouseIds) {
        const stockStr = warehouseAssignStocks[wId]?.trim();
        const stockVal = stockStr ? parseInt(stockStr) : null;

        if (variantIds.length > 0) {
          await Promise.all(
            variantIds.map((vId) => {
              let finalStock = 0;
              if (stockVal !== null) {
                finalStock = stockVal;
              } else {
                const variant = (product?.variants ?? []).find((v: any) => v.id === vId);
                const baseInv = getBaseInventory(variant?.inventories) as any;
                finalStock = baseInv ? (baseInv.stock ?? 0) : 0;
              }
              return adminApi.post("/inventory/upsert", {
                variantId: vId,
                warehouseId: wId,
                stock: finalStock,
              });
            })
          );
        }

        if (hasBaseProductSelected) {
          let finalStock = 0;
          if (stockVal !== null) {
            finalStock = stockVal;
          } else {
            const productLevelInventories = ((product?.inventories ?? []) as any[]).filter((inv) => !inv.variantId);
            const baseInv = productLevelInventories.find((inv) => !inv.warehouseId);
            finalStock = baseInv ? (baseInv.stock ?? 0) : 0;
          }
          await adminApi.put(`/inventory/product/${productId}`, {
            warehouseId: wId,
            stock: finalStock,
            lowStockThreshold: 10,
          });
        }
      }

      showToast(`Successfully assigned selected items to warehouses.`, "success");
      setWarehouseAssignModalOpen(false);
      setSelectedInvIds([]);
      setInvBulkActionType("Bulk Action");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to assign warehouses."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleInvBulkApplyAction = async () => {
    if (!selectedInvIds.length) {
      showToast("Please select at least one inventory row.", "error");
      return;
    }
    if (invBulkActionType === "Bulk Action") {
      showToast("Please select a bulk action.", "error");
      return;
    }
    setBulkSaving(true);
    try {
      if (invBulkActionType === "Delete selected assignments") {
        const assignmentsToDelete = paginatedVariantInventories.filter(
          (inv: any) => selectedInvIds.includes(inv.id) && inv.isOverride
        );
        if (!assignmentsToDelete.length) {
          showToast("No warehouse assignment inventory rows were selected to delete.", "error");
          setBulkSaving(false);
          return;
        }

        setShowBulkDeleteInventoryModal(true);
        setBulkSaving(false);
        return;
      } else if (invBulkActionType === "Assign to new warehouse") {
        setWarehouseAssignSelections({});
        setWarehouseAssignStocks({});
        setWarehouseAssignModalOpen(true);
        setBulkSaving(false);
        return;
      } else {
        const payload: any = {};
        if (invBulkActionType === "Update stock") {
          if (!invBulkActionValue.trim() || isNaN(parseInt(invBulkActionValue))) {
            showToast("Please enter a valid stock number.", "error");
            setBulkSaving(false);
            return;
          }
          payload.stock = parseInt(invBulkActionValue);
        } else if (invBulkActionType === "Update low stock threshold") {
          if (!invBulkActionValue.trim() || isNaN(parseInt(invBulkActionValue))) {
            showToast("Please enter a valid low stock threshold.", "error");
            setBulkSaving(false);
            return;
          }
          payload.lowStockThreshold = parseInt(invBulkActionValue);
        }
        await Promise.all(
          selectedInvIds.map(async (id) => {
            const inv = variantGroups.flatMap((g) => g.inventories).find((i) => i.id === id);
            if (!inv) return;
            if (id === "dummy-base-product") {
              return adminApi.put(`/inventory/product/${product?.id}`, payload);
            } else if (id.startsWith("dummy-")) {
              return adminApi.post(`/inventory/upsert`, { variantId: inv.variantId, warehouseId: inv.isOverride ? inv.warehouseId : null, ...payload });
            } else {
              return adminApi.put(`/inventory/${id}`, payload);
            }
          })
        );
        showToast(`Successfully updated ${selectedInvIds.length} inventory record(s).`, "success");
      }
      setSelectedInvIds([]);
      setInvBulkActionValue("");
      setInvBulkCountryId("");
      setInvBulkActionType("Bulk Action");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk update failed."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmBulkDeleteInventory = async () => {
    const assignmentsToDelete = paginatedVariantInventories.filter(
      (inv: any) => selectedInvIds.includes(inv.id) && inv.isOverride
    );
    if (!assignmentsToDelete.length) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        assignmentsToDelete.map((inv) => adminApi.delete(`/inventory/${inv.id}`))
      );
      showToast(`Successfully deleted ${assignmentsToDelete.length} warehouse assignment(s).`, "success");
      setSelectedInvIds([]);
      setInvBulkActionType("Bulk Action");
      setShowBulkDeleteInventoryModal(false);
      await refetch();
    } catch (err: any) {
      showToast(err?.response?.data?.error || err?.response?.data?.message || "Error removing assignments.", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmDeleteInventoryAssignment = async () => {
    if (!deletingInventoryAssignment) return;
    try {
      await adminApi.delete(`/inventory/${deletingInventoryAssignment.id}`);
      showToast("Assignment removed.", "success");
      setDeletingInventoryAssignment(null);
      await refetch();
    } catch (err: any) {
      showToast(err?.response?.data?.error || err?.response?.data?.message || "Error removing assignment.", "error");
    }
  };

  const handleDeleteAllBasePrices = () => {
    if (!productBasePrices.length) return;
    setDeletingAllBasePrices(true);
  };

  const confirmDeleteAllBasePrices = async () => {
    try {
      await Promise.all(
        productBasePrices.map((p: any) => adminApi.delete(`/pricing/${p.id}`))
      );
      showToast(`All ${productBasePrices.length} base price(s) deleted successfully.`);
      setSelectedPriceIds([]);
      setDeletingAllBasePrices(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete base prices."), "error");
    }
  };

  const { data: productCountries = [], isLoading: countriesLoading, isFetching: countriesFetching, refetch: refetchCountries } = useAdminProductCountries(productId);
  const { data: variantCountries = [], isLoading: variantCountriesLoading, isFetching: variantCountriesFetching, refetch: refetchVariantCountries } = useAdminVariantCountries(productId, editingVariant?.id || variantCountryModalVariant?.id);
  const { data: productAttributeMappings = [], isLoading: productAttributesLoading, isFetching: productAttributesFetching, refetch: refetchProductAttributes } = useAdminProductAttributes(productId);
  const { data: tierPricingRules = [], isLoading: tierPricingLoading, isFetching: tierPricingFetching, refetch: refetchTierPricing } = useAdminProductTierPricing(productId);
  const { data: moqPricingRules = [], isLoading: moqPricingLoading, isFetching: moqPricingFetching, refetch: refetchMoqPricing } = useAdminProductMoqPricing(productId);

  const isRefreshingProduct = isFetching || countriesFetching || productAttributesFetching || tierPricingFetching || moqPricingFetching;

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      refetch(),
      refetchCountries(),
      refetchProductAttributes(),
      refetchTierPricing(),
      refetchMoqPricing(),
    ]);
  }, [refetch, refetchCountries, refetchProductAttributes, refetchTierPricing, refetchMoqPricing]);
  const { data: categories = [] } = useAdminCategories();
  const { data: attributes = [] } = useAdminAttributes();
  const { data: countries = [] } = useAdminCountries();
  const { data: warehouses = [] } = useAdminWarehouses({ limit: 30 });
  const { data: tiers = [] } = useAdminTiers();
  const { data: selectedAttributeDetail } = useAdminAttribute(selectedMappingAttributeId);
  const { data: languages = [] } = useAdminLanguages();
  const updateProduct = useUpdateProduct(productId);
  const updateProductCountries = useUpdateProductCountries(productId);
  const updateVariantCountries = useUpdateVariantCountries(productId, variantCountryModalVariant?.id);
  const createTierPricing = useCreateProductTierPricing(productId);
  const deleteTierPricing = useDeleteProductTierPricing(productId);
  const updateTierPricing = useUpdateProductTierPricing(productId);
  const createMoqPricing = useCreateProductMoqPricing(productId);
  const deleteMoqPricing = useDeleteProductMoqPricing(productId);
  const updateMoqPricing = useUpdateProductMoqPricing(productId);
  const queryClient = useQueryClient();
  const assignProductAttributes = useAssignProductAttributes(productId);
  const removeProductAttribute = useRemoveProductAttribute(productId);
  const updateProductFilterVisibility = useUpdateProductFilterVisibility(productId);
  const reorderAttributeValues = useReorderAttributeValues();

  const translationLanguages = useMemo(() => filterTranslationLanguages(languages), [languages]);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];

  useEffect(() => {
    if (!activeTranslationLang?.id || !product) return;
    setTranslationDrafts((current) => {
      if (current[activeTranslationLang.id]) return current;
      const translation = product.translations?.find((tr: { languageId: string }) => tr.languageId === activeTranslationLang.id) as {
        seoKeywords?: string | null;
        highlights?: unknown;
        technicalSpecs?: unknown;
        warranty?: unknown;
        primaryFeatures?: unknown;
      } | undefined;
      const parseArray = <T,>(value: unknown, fallback: T[]) => (Array.isArray(value) ? (value as T[]) : fallback);
      return {
        ...current,
        [activeTranslationLang.id]: {
          highlights: parseArray(translation?.highlights, Array.isArray(product.highlights) ? product.highlights : []),
          technicalSpecs: parseArray(translation?.technicalSpecs, Array.isArray(product.technicalSpecs) ? product.technicalSpecs : []),
          warranty: parseArray(translation?.warranty, Array.isArray(product.warranty) ? product.warranty : []),
          primaryFeatures: parseArray(translation?.primaryFeatures, Array.isArray(product.primaryFeatures) ? product.primaryFeatures : []),
        },
      };
    });
  }, [activeTranslationLang?.id, product]);

  const attributeCatalog = useMemo(() => attributes as GlobalAttribute[], [attributes]);
  const mappedAttributeRows = useMemo(() => productAttributeMappings as ProductAttributeMapping[], [productAttributeMappings]);
  const mappedAttributeIds = useMemo(() => new Set(mappedAttributeRows.map((mapping) => mapping.attributeId)), [mappedAttributeRows]);
  const selectedAttributeValues = useMemo(
    () => ((selectedAttributeDetail?.values ?? []) as AttributeValueDetail[]),
    [selectedAttributeDetail]
  );
  const filteredAttributeValues = useMemo(() => {
    let list = selectedAttributeValues;
    if (mappingValueFilter === "SELECTED") {
      const valMap = new Map(selectedAttributeValues.map((val) => [val.id, val]));
      list = newMappingValueIds.map((id) => valMap.get(id)).filter(Boolean) as AttributeValueDetail[];
    } else if (mappingValueFilter === "UNSELECTED") {
      list = list.filter((val) => !newMappingValueIds.includes(val.id));
    }
    if (mappingValueSearch.trim()) {
      const q = mappingValueSearch.trim().toLowerCase();
      list = list.filter((val) => val.value.toLowerCase().includes(q));
    }
    return list;
  }, [selectedAttributeValues, mappingValueFilter, mappingValueSearch, newMappingValueIds]);
  const availableMappingAttributes = useMemo(
    () => attributeCatalog.filter((attribute) => !mappedAttributeIds.has(attribute.id) || attribute.id === selectedMappingAttributeId),
    [attributeCatalog, mappedAttributeIds, selectedMappingAttributeId]
  );
  const hasMappedProductAttributes = mappedAttributeRows.length > 0;
  const variantGenerationCatalog = useMemo(
    () =>
      hasMappedProductAttributes
        ? mappedAttributeRows.map((mapping) => ({
            id: mapping.attributeId,
            name: mapping.attribute.name,
            role: mapping.attribute.role,
            values: (mapping.allowedValues.length ? mapping.allowedValues.map((allowedValue) => allowedValue.attributeValue) : mapping.attribute.values).map(
              (value) => ({
                id: value.id,
                value: value.value,
              }),
            ),
          }))
        : attributeCatalog,
    [attributeCatalog, hasMappedProductAttributes, mappedAttributeRows]
  );
  const editVariantAttributeCatalog = useMemo(() => {
    const catalog = new Map<string, GlobalAttribute>();

    variantGenerationCatalog.forEach((attribute) => {
      catalog.set(attribute.id, {
        id: attribute.id,
        name: attribute.name,
        role: attribute.role,
        values: [...getAttributeValues(attribute)],
      });
    });

    attributeCatalog.forEach((attribute) => {
      if (!catalog.has(attribute.id)) {
        catalog.set(attribute.id, {
          id: attribute.id,
          name: attribute.name,
          role: attribute.role,
          values: [...getAttributeValues(attribute)],
        });
      }
    });

    (editingVariant?.attributeValues ?? []).forEach((binding) => {
      const attributeId = binding.attributeId;
      const existing = catalog.get(attributeId) ?? {
        id: attributeId,
        name: binding.attribute?.name ?? "Attribute",
        role: undefined,
        values: [] as { id: string; value: string }[],
      };
      if (binding.attribute?.name) existing.name = binding.attribute.name;
      const value = binding.attributeValue;
      if (value?.value && !existing.values.some((item) => item.id === (value.id ?? binding.attributeValueId))) {
        existing.values.push({ id: value.id ?? binding.attributeValueId, value: value.value });
      }
      catalog.set(attributeId, existing);
    });

    return catalog;
  }, [attributeCatalog, editingVariant, variantGenerationCatalog]);
  const packageRows = useMemo(() => {
    const dbPackages = ((product?.packages ?? []) as PackageRow[]).slice();
    dbPackages.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const occupied = new Set<number>();
    return dbPackages.map((pkg) => {
      let order = pkg.sortOrder ?? 1;
      while (occupied.has(order)) {
        order++;
      }
      occupied.add(order);
      return { ...pkg, sortOrder: order };
    });
  }, [product?.packages]);
  const variantRows = useMemo(() => (product?.variants ?? []) as VariantRow[], [product?.variants]);

  const productVariantPrices = useMemo(() => {
    const rawPrices = (product?.prices || []).filter((p: any) => p.variantId != null);
    const enabledCountries = (productCountries as CountryAvailability[]).filter((c) => c.enabled);
    const rows: any[] = [];

    variantRows.forEach((variant) => {
      enabledCountries.forEach((country) => {
        const override = rawPrices.find((p: any) => p.variantId === variant.id && p.countryId === country.id);
        
        if (override) {
          rows.push({
            ...override,
            variantTitle: variant.title ?? "Unknown Variant",
            variantSku: variant.sku ?? "",
            isOverride: true
          });
        } else {
          const basePrice = product?.prices?.find((p: any) => p.variantId == null && p.countryId === country.id);
          rows.push({
            id: `base-${variant.id}-${country.id}`, 
            variantId: variant.id,
            countryId: country.id,
            country: country,
            mrp: basePrice?.mrp ?? 0,
            sellingPrice: basePrice?.sellingPrice ?? 0,
            dealerPrice: basePrice?.dealerPrice ?? null,
            distributorPrice: basePrice?.distributorPrice ?? null,
            status: basePrice?.status ?? "ACTIVE",
            variantTitle: variant.title ?? "Unknown Variant",
            variantSku: variant.sku ?? "",
            isOverride: false
          });
        }
      });
    });

    return rows;
  }, [product?.prices, variantRows, productCountries]);

  const filteredVariantPrices = useMemo(() => {
    let rows = productVariantPrices;

    if (filterVPVariant.trim()) {
      const q = filterVPVariant.toLowerCase().trim();
      rows = rows.filter(
        (p: any) =>
          p.variantTitle.toLowerCase().includes(q) ||
          p.variantSku.toLowerCase().includes(q)
      );
    }

    if (filterVPCountry.trim()) {
      const q = filterVPCountry.toLowerCase().trim();
      rows = rows.filter((p: any) => {
        const countryName = p.country?.name?.toLowerCase() ?? "";
        const countryCode = p.country?.code?.toLowerCase() ?? "";
        return countryName.includes(q) || countryCode.includes(q);
      });
    }

    if (filterVPMRP.trim()) {
      const q = filterVPMRP.trim();
      rows = rows.filter((p: any) => {
        const val = Number(p.mrp ?? 0);
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterVPSelling.trim()) {
      const q = filterVPSelling.trim();
      rows = rows.filter((p: any) => {
        const val = Number(p.sellingPrice ?? 0);
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterVPDealer.trim()) {
      const q = filterVPDealer.trim();
      rows = rows.filter((p: any) => {
        const val = p.dealerPrice != null ? Number(p.dealerPrice) : null;
        if (val === null) return false;
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterVPDoctor.trim()) {
      const q = filterVPDoctor.trim();
      rows = rows.filter((p: any) => {
        const val = p.distributorPrice != null ? Number(p.distributorPrice) : null;
        if (val === null) return false;
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseFloat(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterVPStatus && filterVPStatus !== "") {
      rows = rows.filter((p: any) => p.status === filterVPStatus);
    }

    // Client-side sorting
    if (vpSortField) {
      rows = [...rows].sort((a: any, b: any) => {
        let valA: any = "";
        let valB: any = "";
        if (vpSortField === "variant") {
          valA = a.variantTitle ?? "";
          valB = b.variantTitle ?? "";
        } else if (vpSortField === "country") {
          valA = a.country?.name ?? "";
          valB = b.country?.name ?? "";
        } else if (vpSortField === "mrp") {
          valA = Number(a.mrp ?? 0);
          valB = Number(b.mrp ?? 0);
        } else if (vpSortField === "sellingPrice") {
          valA = Number(a.sellingPrice ?? 0);
          valB = Number(b.sellingPrice ?? 0);
        } else if (vpSortField === "dealerPrice") {
          valA = a.dealerPrice != null ? Number(a.dealerPrice) : -1;
          valB = b.dealerPrice != null ? Number(b.dealerPrice) : -1;
        } else if (vpSortField === "distributorPrice") {
          valA = a.distributorPrice != null ? Number(a.distributorPrice) : -1;
          valB = b.distributorPrice != null ? Number(b.distributorPrice) : -1;
        } else if (vpSortField === "status") {
          valA = a.status ?? "";
          valB = b.status ?? "";
        }
        if (valA < valB) return vpSortDirection === "asc" ? -1 : 1;
        if (valA > valB) return vpSortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [
    productVariantPrices,
    filterVPVariant,
    filterVPCountry,
    filterVPMRP,
    filterVPSelling,
    filterVPDealer,
    filterVPDoctor,
    filterVPStatus,
    vpSortField,
    vpSortDirection,
  ]);

  const groupedVariantPrices = useMemo(() => {
    const groups: Record<string, { variantTitle: string; variantSku: string; prices: any[] }> = {};
    filteredVariantPrices.forEach((p: any) => {
      if (!groups[p.variantId]) {
        groups[p.variantId] = {
          variantTitle: p.variantTitle,
          variantSku: p.variantSku,
          prices: []
        };
      }
      groups[p.variantId].prices.push(p);
    });
    return groups;
  }, [filteredVariantPrices]);

  const groupedVariantIds = useMemo(() => Object.keys(groupedVariantPrices), [groupedVariantPrices]);

  const totalVPItems = groupedVariantIds.length;
  const totalVPPages = Math.ceil(totalVPItems / vpPageSize) || 1;

  useEffect(() => {
    if (vpCurrentPage > totalVPPages) {
      setVpCurrentPage(1);
    }
  }, [totalVPPages, vpCurrentPage]);

  const paginatedGroupedVariantIds = useMemo(() => {
    const start = (vpCurrentPage - 1) * vpPageSize;
    const end = start + vpPageSize;
    return groupedVariantIds.slice(start, end);
  }, [groupedVariantIds, vpCurrentPage, vpPageSize]);

  const paginatedVariantPrices = useMemo(() => {
    const prices: any[] = [];
    paginatedGroupedVariantIds.forEach(id => {
      prices.push(...groupedVariantPrices[id].prices);
    });
    return prices;
  }, [paginatedGroupedVariantIds, groupedVariantPrices]);

  const allVariantInventories = useMemo(() => {
    const list: any[] = [];

    const productLevelInventories = ((product?.inventories ?? []) as any[]).filter((inv) => !inv.variantId);
    
    const baseBase = productLevelInventories.find((inv) => !inv.warehouseId);
    if (baseBase) {
      list.push({
        ...baseBase,
        id: baseBase.id,
        variantId: null,
        variantTitle: product?.title ?? "Product Base",
        variantSku: product?.sku ?? "",
        type: "Base",
        countryName: "Base Inventory",
        countryCode: "",
        isOverride: false,
      });
    } else if (variantRows.length === 0) {
      list.push({
        id: "dummy-base-product",
        variantId: null,
        variantTitle: product?.title ?? "Product Base",
        variantSku: product?.sku ?? "",
        type: "Base",
        countryName: "Base Inventory (Not Created)",
        countryCode: "",
        isOverride: false,
        stock: 0,
        reservedStock: 0,
      });
    }

    const productWarehouseAssignments = productLevelInventories.filter((inv) => inv.warehouseId);
    productWarehouseAssignments.forEach((inv) => {
      list.push({
        ...inv,
        id: inv.id,
        variantId: null,
        variantTitle: product?.title ?? "Product Base",
        variantSku: product?.sku ?? "",
        type: "Warehouse Assignment",
        warehouseName: inv.warehouse?.name ?? "Unknown Warehouse",
        warehouseState: inv.warehouse?.state ?? "",
        warehouseCountryCode: inv.warehouse?.country?.code ?? "",
        isOverride: true,
      });
    });

    variantRows.forEach((variant) => {
      const base = getBaseInventory(variant.inventories);
      if (base) {
        list.push({
          ...base,
          id: base.id,
          variantId: variant.id,
          variantTitle: variant.title,
          variantSku: variant.sku ?? "",
          type: "Base",
          countryName: "Base Inventory",
          countryCode: "",
          isOverride: false,
        });
      } else {
        list.push({
          id: `dummy-var-${variant.id}`,
          variantId: variant.id,
          variantTitle: variant.title,
          variantSku: variant.sku ?? "",
          type: "Base",
          countryName: "Base Inventory (Not Created)",
          countryCode: "",
          isOverride: false,
          stock: 0,
          reservedStock: 0,
        });
      }
      
      const warehouseAssignmentsList = (variant.inventories ?? []).filter((inv) => inv.warehouseId);
      warehouseAssignmentsList.forEach((inv) => {
        list.push({
          ...inv,
          id: inv.id,
          variantId: variant.id,
          variantTitle: variant.title,
          variantSku: variant.sku ?? "",
          type: "Warehouse Assignment",
          warehouseName: inv.warehouse?.name ?? "Unknown Warehouse",
          warehouseState: inv.warehouse?.state ?? "",
          warehouseCountryCode: inv.warehouse?.country?.code ?? "",
          isOverride: true,
        });
      });
    });
    return list;
  }, [variantRows, product]);

  const filteredVariantInventories = useMemo(() => {
    let rows = allVariantInventories;

    if (filterInvVariant.trim()) {
      const q = filterInvVariant.toLowerCase().trim();
      rows = rows.filter(
        (inv: any) =>
          inv.variantTitle.toLowerCase().includes(q) ||
          inv.variantSku.toLowerCase().includes(q)
      );
    }

    if (filterInvType.trim()) {
      const q = filterInvType.toLowerCase().trim();
      rows = rows.filter(
        (inv: any) =>
          (inv.countryName?.toLowerCase() || "").includes(q) ||
          (inv.countryCode?.toLowerCase() || "").includes(q) ||
          (inv.warehouseName?.toLowerCase() || "").includes(q) ||
          (inv.warehouseCountryCode?.toLowerCase() || "").includes(q) ||
          (inv.type?.toLowerCase() || "").includes(q)
      );
    }

    if (filterInvStock.trim()) {
      const q = filterInvStock.trim();
      rows = rows.filter((inv: any) => {
        const val = inv.stock ?? 0;
        if (q.startsWith(">")) {
          const num = parseInt(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseInt(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseInt(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    if (filterInvLowStock.trim()) {
      const q = filterInvLowStock.trim();
      rows = rows.filter((inv: any) => {
        const val = inv.lowStockThreshold ?? 10;
        if (q.startsWith(">")) {
          const num = parseInt(q.slice(1));
          return !isNaN(num) && val > num;
        } else if (q.startsWith("<")) {
          const num = parseInt(q.slice(1));
          return !isNaN(num) && val < num;
        } else {
          const num = parseInt(q);
          return !isNaN(num) && val === num;
        }
      });
    }

    // Client-side sorting
    if (invSortField) {
      rows = [...rows].sort((a: any, b: any) => {
        let valA: any = "";
        let valB: any = "";
        if (invSortField === "variant") {
          valA = a.variantTitle ?? "";
          valB = b.variantTitle ?? "";
        } else if (invSortField === "type") {
          valA = a.countryName ?? a.warehouseName ?? "";
          valB = b.countryName ?? b.warehouseName ?? "";
        } else if (invSortField === "stock") {
          valA = a.stock ?? 0;
          valB = b.stock ?? 0;
        } else if (invSortField === "lowStockThreshold") {
          valA = a.lowStockThreshold ?? 0;
          valB = b.lowStockThreshold ?? 0;
        }
        if (valA < valB) return invSortDirection === "asc" ? -1 : 1;
        if (valA > valB) return invSortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [
    allVariantInventories,
    filterInvVariant,
    filterInvType,
    filterInvStock,
    filterInvLowStock,
    invSortField,
    invSortDirection,
  ]);

  const variantGroups = useMemo(() => {
    const groups: { variantId: string | null; variantTitle: string; variantSku: string; inventories: any[] }[] = [];
    const groupMap = new Map<string | null, typeof groups[number]>();

    filteredVariantInventories.forEach((inv) => {
      const key = inv.variantId ?? "base";
      let group = groupMap.get(key);
      if (!group) {
        group = {
          variantId: inv.variantId ?? null,
          variantTitle: inv.variantTitle,
          variantSku: inv.variantSku,
          inventories: [],
        };
        groupMap.set(key, group);
        groups.push(group);
      }
      group.inventories.push(inv);
    });
    return groups;
  }, [filteredVariantInventories]);

  const totalInvItems = variantGroups.length;
  const totalInvPages = Math.ceil(totalInvItems / invPageSize) || 1;

  useEffect(() => {
    if (invCurrentPage > totalInvPages) {
      setInvCurrentPage(1);
    }
  }, [totalInvPages, invCurrentPage]);

  const paginatedVariantGroups = useMemo(() => {
    const start = (invCurrentPage - 1) * invPageSize;
    const end = start + invPageSize;
    return variantGroups.slice(start, end);
  }, [variantGroups, invCurrentPage, invPageSize]);

  const paginatedVariantInventories = useMemo(() => {
    return paginatedVariantGroups.flatMap((group) => group.inventories);
  }, [paginatedVariantGroups]);
  const filteredVariantRows = useMemo(() => {
    const getDisplayStock = (v: any) => {
      if (variantTabWarehouseFilter) {
        const inv = v.inventories?.find((i: any) => i.warehouseId === variantTabWarehouseFilter) as any;
        return inv ? inv.stock ?? 0 : 0;
      }
      return (getBaseInventory(v.inventories) as any)?.stock ?? 0;
    };

    let rows = variantRows.filter((variant) => {
      if (variantTabStatusFilter && variant.status !== variantTabStatusFilter) return false;
      if (variantTabWarehouseFilter) {
        const hasAssignment = variant.inventories?.some((inv: any) => inv.warehouseId === variantTabWarehouseFilter);
        if (!hasAssignment) return false;
      }
      if (variantTabStockFilter) {
        const stock = getDisplayStock(variant);
        if (variantTabStockFilter === "IN_STOCK" && stock <= 0) return false;
        if (variantTabStockFilter === "OUT_OF_STOCK" && stock > 0) return false;
      }
      if (variantTabSearchQuery.trim()) {
        const q = variantTabSearchQuery.toLowerCase().trim();
        const matchesTitle = variant.title.toLowerCase().includes(q);
        const matchesSku = variant.sku && variant.sku.toLowerCase().includes(q);
        const matchesAttr = variant.attributeValues?.some((attr) => attr.attributeValue?.value?.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSku && !matchesAttr) return false;
      }

      // Column client-side filters
      if (filterSku.trim()) {
        const q = filterSku.toLowerCase().trim();
        if (!variant.sku || !variant.sku.toLowerCase().includes(q)) return false;
      }
      if (filterVariantName.trim()) {
        const q = filterVariantName.toLowerCase().trim();
        if (!variant.title.toLowerCase().includes(q)) return false;
      }
      if (filterAttributes.trim()) {
        const q = filterAttributes.toLowerCase().trim();
        const matchesAttr = variant.attributeValues?.some((attr) => {
          const attrVal = attr.attributeValue?.value?.toLowerCase() ?? "";
          const attrName = attr.attribute?.name?.toLowerCase() ?? "";
          return attrVal.includes(q) || attrName.includes(q);
        });
        if (!matchesAttr) return false;
      }
      if (filterStock.trim()) {
        const q = filterStock.trim();
        const stock = getDisplayStock(variant);
        if (q.startsWith(">")) {
          const num = parseInt(q.slice(1), 10);
          if (isNaN(num) || stock <= num) return false;
        } else if (q.startsWith("<")) {
          const num = parseInt(q.slice(1), 10);
          if (isNaN(num) || stock >= num) return false;
        } else {
          const num = parseInt(q, 10);
          if (isNaN(num) || stock !== num) return false;
        }
      }
      if (filterPrice.trim()) {
        const q = filterPrice.trim();
        const basePrice = getVariantPriceForCountry(variant)?.sellingPrice ?? getVariantPriceForCountry(variant)?.mrp ?? 0;
        if (q.startsWith(">")) {
          const num = parseFloat(q.slice(1));
          if (isNaN(num) || Number(basePrice) <= num) return false;
        } else if (q.startsWith("<")) {
          const num = parseFloat(q.slice(1));
          if (isNaN(num) || Number(basePrice) >= num) return false;
        } else {
          const num = parseFloat(q);
          if (isNaN(num) || Number(basePrice) !== num) return false;
        }
      }
      if (filterStatus && variant.status !== filterStatus) return false;

      return true;
    });

    if (sortField) {
      rows = [...rows].sort((a, b) => {
        let valA: any = "";
        let valB: any = "";
        if (sortField === "sku") {
          valA = a.sku || "";
          valB = b.sku || "";
        } else if (sortField === "title") {
          valA = a.title || "";
          valB = b.title || "";
        } else if (sortField === "stock") {
          valA = getDisplayStock(a);
          valB = getDisplayStock(b);
        } else if (sortField === "price") {
          const aPrice = getVariantPriceForCountry(a, variantTableDisplayCountryId || undefined, productBasePrices);
          const bPrice = getVariantPriceForCountry(b, variantTableDisplayCountryId || undefined, productBasePrices);
          if (aPrice && !bPrice) return sortDirection === "asc" ? -1 : 1;
          if (!aPrice && bPrice) return sortDirection === "asc" ? 1 : -1;
          if (!aPrice && !bPrice) return 0;
          valA = aPrice?.sellingPrice ?? aPrice?.mrp ?? 0;
          valB = bPrice?.sellingPrice ?? bPrice?.mrp ?? 0;
        } else if (sortField === "status") {
          valA = a.status || "";
          valB = b.status || "";
        } else if (sortField === "attributes") {
          valA = a.attributeValues?.map(av => av.attributeValue?.value).join(", ") || "";
          valB = b.attributeValues?.map(av => av.attributeValue?.value).join(", ") || "";
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [
    variantRows,
    variantTabStatusFilter,
    variantTabStockFilter,
    variantTabWarehouseFilter,
    variantTabSearchQuery,
    filterSku,
    filterVariantName,
    filterAttributes,
    filterStock,
    filterPrice,
    filterStatus,
    sortField,
    sortDirection,
    productBasePrices,
    variantTableDisplayCountryId
  ]);

  const totalItems = filteredVariantRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (product) {
      setShippingPackageWeight(product.packageWeight != null ? String(product.packageWeight) : "");
      setShippingPackageLength(product.packageLength != null ? String(product.packageLength) : "");
      setShippingPackageWidth(product.packageWidth != null ? String(product.packageWidth) : "");
      setShippingPackageHeight(product.packageHeight != null ? String(product.packageHeight) : "");
      setShippingClass(product.shippingClass || "");
      setShippingFragile(product.fragile || false);
      setShippingHazardous(product.hazardous || false);
    }
  }, [product]);

  const paginatedVariantRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredVariantRows.slice(start, end);
  }, [filteredVariantRows, currentPage, pageSize]);
  const bulkCountryOptions = useMemo(() => {
    const countries = new Map<string, BulkCountryOption>();
    (productCountries as CountryAvailability[]).forEach((country) => {
      countries.set(country.id, {
        id: country.id,
        code: country.code,
        label: `${country.name} (${country.code})`,
        currencySymbol: country.currency?.symbol,
      });
    });
    (product?.prices ?? []).forEach((price: { countryId?: string; country?: { id: string; name: string; code: string }; currency?: { symbol?: string | null } }) => {
      const countryId = price.countryId ?? price.country?.id;
      if (!countryId || countries.has(countryId)) return;
      countries.set(countryId, {
        id: countryId,
        label: price.country ? `${price.country.name} (${price.country.code})` : countryId,
        currencySymbol: price.currency?.symbol,
      });
    });
    variantRows.forEach((variant) => {
      variant.prices?.forEach((price) => {
        const countryId = price.countryId ?? price.country?.id;
        if (!countryId || countries.has(countryId)) return;
        countries.set(countryId, {
          id: countryId,
          code: price.country?.code,
          label: price.country ? `${price.country.name} (${price.country.code})` : countryId,
          currencySymbol: price.currency?.symbol,
        });
      });
    });
    return Array.from(countries.values());
  }, [product?.prices, productCountries, variantRows]);
  const primarySelectedBulkCountryId = bulkCountryIds.includes("ALL") ? "" : (bulkCountryIds[0] || product?.defaultCountryId || bulkCountryOptions[0]?.id || "");
  const tierRows = useMemo(() => tiers as TierRow[], [tiers]);
  const countryRows = useMemo(() => countries as { id: string; name: string; code: string }[], [countries]);
  const tierPricingRows = useMemo(() => tierPricingRules as PricingRuleRow[], [tierPricingRules]);
  const moqPricingRows = useMemo(() => moqPricingRules as PricingRuleRow[], [moqPricingRules]);

  const resetTierRuleDraft = () => {
    setTierRuleDraft({
      ...emptyRuleDraft,
      countryIds: countryRows.map((c) => c.id),
    });
    setEditingTierRuleId(null);
  };

  const resetMoqRuleDraft = () => {
    setMoqRuleDraft({
      ...emptyRuleDraft,
      countryIds: countryRows.map((c) => c.id),
    });
  };

  useEffect(() => {
    if (countryRows.length > 0) {
      setTierRuleDraft((d) => ({
        ...d,
        countryIds: d.countryIds?.length ? d.countryIds : countryRows.map((c) => c.id),
      }));
      setMoqRuleDraft((d) => ({
        ...d,
        countryIds: d.countryIds?.length ? d.countryIds : countryRows.map((c) => c.id),
      }));
    }
  }, [countryRows]);

  const form = useAdminForm<ProductEditorFormValues>({
    enableReinitialize: true,
    initialValues: {
      title: product?.title || "",
      slug: product?.slug || "",
      categoryId: product?.categoryId || "",
      activeCountryIds: (productCountries as CountryAvailability[])?.filter(c => c.enabled)?.map(c => c.id) || (product?.defaultCountryId ? [product.defaultCountryId] : []),
      status: product?.status || "DRAFT",
      productCode: product?.productCode || "",
      sku: product?.sku || "",
      brand: product?.brand || "Modern Orthodontics",
      shortDescription: product?.shortDescription || "",
      description: product?.description || "",
      informationImage: product?.informationImage || "",
      informationDescription: product?.informationDescription || "",
      isFeatured: product?.isFeatured || false,
      hasVariants: product?.hasVariants || false,
      seoTitle: product?.seoTitle || "",
      seoDescription: product?.seoDescription || "",
      seoKeywords: product?.seoKeywords || "",
      highlights:
        Array.isArray(product?.highlights) && product.highlights.length > 0
          ? product.highlights
          : DEFAULT_PRODUCT_HIGHLIGHTS,
      technicalSpecs:
        Array.isArray(product?.technicalSpecs) && product.technicalSpecs.length > 0
          ? product.technicalSpecs.map((s: any) => ({ label: String(s?.label ?? ""), value: String(s?.value ?? "") }))
          : Array.isArray((product?.technicalSpecs as any)?.specs) && (product?.technicalSpecs as any).specs.length > 0
            ? (product?.technicalSpecs as any).specs
            : DEFAULT_TECHNICAL_SPECS,
      specImages:
        Array.isArray((product?.technicalSpecs as any)?.images)
          ? (product?.technicalSpecs as any).images
          : Array.isArray(product?.technicalSpecs)
            ? product.technicalSpecs.filter((s: any) => s?.image).map((s: any, idx: number) => ({ url: s.image, title: s.label || `Specification Diagram ${idx + 1}` }))
            : [],
      warranty: Array.isArray(product?.warranty) ? product.warranty : [],
      primaryFeatures:
        Array.isArray(product?.primaryFeatures) && product.primaryFeatures.length > 0
          ? product.primaryFeatures
          : DEFAULT_PRIMARY_FEATURES,
      additionalInfo:
        Array.isArray(product?.additionalInfo) && product.additionalInfo.length > 0
          ? product.additionalInfo
          : DEFAULT_ADDITIONAL_INFO,
    },
    validationSchema: basicSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        const hasContent = (text?: string | null) =>
          Boolean(text && text.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, "").trim().length > 0);

        const cleanSpecs = Array.isArray(values.technicalSpecs)
          ? values.technicalSpecs
              .map((s) => ({ label: String(s?.label ?? "").trim(), value: String(s?.value ?? "").trim() }))
              .filter((s) => hasContent(s.label) || hasContent(s.value))
          : [];

        const cleanSpecImages = Array.isArray(values.specImages)
          ? values.specImages
              .map((img) => ({ url: String(img?.url ?? "").trim(), title: String(img?.title ?? "").trim() }))
              .filter((img) => Boolean(img.url))
          : [];

        // Build a sanitized payload to avoid sending unexpected types or empty array items to the API
        const { specImages: _discardSpecImages, ...otherValues } = values;
        const payload = {
          ...otherValues,
          highlights: Array.isArray(values.highlights)
            ? values.highlights
                .map((h) => ({ title: String(h?.title ?? "").trim(), description: String(h?.description ?? "").trim() }))
                .filter((h) => hasContent(h.title) || hasContent(h.description))
            : [],
          technicalSpecs: {
            specs: cleanSpecs,
            images: cleanSpecImages,
          },
          warranty: Array.isArray(values.warranty)
            ? values.warranty
                .map((w) => String(w ?? "").trim())
                .filter((w) => hasContent(w))
            : [],
          primaryFeatures: Array.isArray(values.primaryFeatures)
            ? values.primaryFeatures
                .map((p) => ({ title: String(p?.title ?? "").trim(), description: String(p?.description ?? "").trim() }))
                .filter((p) => hasContent(p.title) || hasContent(p.description))
            : [],
          additionalInfo: Array.isArray(values.additionalInfo)
            ? values.additionalInfo
                .map((a) => ({ label: String(a?.label ?? "").trim(), value: String(a?.value ?? "").trim() }))
                .filter((a) => hasContent(a.label) || hasContent(a.value))
            : [],
        } as unknown as typeof values;

        // Debug: log sanitized payload
        // eslint-disable-next-line no-console
        console.log("[ProductEditor] saving sanitized product payload:", payload);

        await updateProduct.mutateAsync(payload);
        resetForm(values);
        showToast("Product saved.");
        await refetch();
      } catch (error) {
        // Log full error for debugging
        // eslint-disable-next-line no-console
        console.error("[ProductEditor] save error:", error, (error as any)?.response?.data);
        // Prefer server message if available
        const serverMessage = (error as any)?.response?.data?.message;
        showToast(serverMessage || getAdminErrorMessage(error, "Save failed."), "error");
      }
    },
  });

  const packageOptions = useMemo(
    () => [{ value: "", label: "Select package…" }, ...packageRows.map((pkg) => ({ value: pkg.id, label: pkg.title }))],
    [packageRows]
  );

  const catOptions = [
    { value: "", label: "Select category…" },
    ...categories.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })),
  ];

  const featureCols: Column<{ title: string; description: string; index: number }>[] = [
    { key: "title", label: "Feature", render: (row) => <span className="font-semibold text-[#1A1A1A]">{row.title || "—"}</span> },
    {
      key: "description",
      label: "Description",
      render: (row) => <span className="line-clamp-2 text-[#4B5563] text-[13px]">{stripHtml(row.description) || "—"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Edit feature"
            onClick={(e) => { e.stopPropagation(); openFeatureModal(row.index); }}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete feature"
            onClick={(e) => { e.stopPropagation(); handleDeleteFeatureItem(row.index); }}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const specCols: Column<{ label: string; value: string; index: number }>[] = [
    { key: "label", label: "Label", render: (row) => <span className="font-semibold text-[#1A1A1A]">{row.label || "—"}</span> },
    { key: "value", label: "Value", render: (row) => <span className="text-[#374151] text-[13px]">{row.value || "—"}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Edit key specification"
            onClick={(e) => { e.stopPropagation(); openSpecModal(row.index); }}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete key specification"
            onClick={(e) => { e.stopPropagation(); handleDeleteSpecItem(row.index); }}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const additionalInfoCols: Column<{ label: string; value: string; index: number; isProductCode?: boolean }>[] = [
    {
      key: "label",
      label: "Label",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1A1A1A]">{row.label || "—"}</span>
          {row.isProductCode && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
              Basic Info Synced
            </span>
          )}
        </div>
      ),
    },
    {
      key: "value",
      label: "Value",
      render: (row) => (
        <span className={row.isProductCode ? "font-mono font-semibold text-blue-900 bg-blue-50/70 px-2 py-0.5 rounded border border-blue-100 text-[12.5px]" : "text-[#374151] text-[13px]"}>
          {row.value || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        if (row.isProductCode) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToBasicInfoAndFocusProductCode();
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors shadow-2xs"
              title="Click to edit Product Code in Basic Info tab"
            >
              <Pencil size={12} />
              Edit in Basic Info
            </button>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Edit additional info"
              onClick={(e) => { e.stopPropagation(); openAdditionalInfoModal(row.index); }}
              className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              title="Delete additional info"
              onClick={(e) => { e.stopPropagation(); handleDeleteAdditionalInfoItem(row.index); }}
              className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      },
    },
  ];

  const directionCols: Column<{ title: string; description: string; index: number }>[] = [
    { key: "title", label: "Title", render: (row) => <span className="font-semibold text-[#1A1A1A]">{row.title || "—"}</span> },
    {
      key: "description",
      label: "Instruction / Guideline",
      render: (row) => <span className="line-clamp-2 text-[#4B5563] text-[13px]">{stripHtml(row.description) || "—"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Edit guideline"
            onClick={(e) => { e.stopPropagation(); openDirectionModal(row.index); }}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete guideline"
            onClick={(e) => { e.stopPropagation(); handleDeleteDirectionItem(row.index); }}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const warrantyCols: Column<{ line: string; index: number }>[] = [
    { key: "index", label: "#", render: (row) => <span className="font-semibold text-[#6B7280]">{row.index + 1}</span> },
    {
      key: "line",
      label: "Warranty Clause / Term",
      render: (row) => <span className="line-clamp-2 text-[#374151] text-[13px]">{stripHtml(row.line) || "—"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Edit warranty clause"
            onClick={(e) => { e.stopPropagation(); openWarrantyModal(row.index); }}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete warranty clause"
            onClick={(e) => { e.stopPropagation(); handleDeleteWarrantyItem(row.index); }}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const packageCols: Column<PackageRow>[] = [
    { key: "title", label: "Package" },
    { key: "sortOrder", label: "Sort", render: (row) => row.sortOrder ?? 0 },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status || "ACTIVE"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Edit package"
            onClick={(e) => { e.stopPropagation(); openPackageModal(row); }}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete package"
            onClick={(e) => { e.stopPropagation(); setDeletingPackage(row); }}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const variantCols: Column<VariantRow>[] = [
    {
      key: "select",
      label: "Select",
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.title}`}
          checked={selectedVariantIds.includes(row.id)}
          onChange={(event) => setSelectedVariantIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
          className="h-4 w-4 accent-[#E31E24]"
        />
      ),
    },
    { key: "title", label: "Variant" },
    { key: "package", label: "Package", render: (row) => row.package?.title ?? "Default" },
    { key: "sku", label: "SKU" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "stock", label: "Stock", render: (row) => getBaseInventory(row.inventories)?.stock ?? "—" },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEditVariantModal(row)} className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]">
            <Pencil size={12} />
          </button>
          <button onClick={() => openVariantCountriesModal(row)} className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]" title="Country availability">
            <Globe2 size={12} />
          </button>
          <button onClick={() => handleCloneVariant(row.id)} className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]">
            <Copy size={12} />
          </button>
          <button onClick={() => setDeletingVariant(row)} className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50">
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const variantGridState: VariantGridState = useMemo(() => {
    const rowAxisMappings = mappedAttributeRows.filter((mapping) => mapping.attribute.role === "Y_GRID");
    const columnAxisMappings = mappedAttributeRows.filter((mapping) => mapping.attribute.role === "X_GRID");
    const reasons: string[] = [];

    if (rowAxisMappings.length !== 1 || columnAxisMappings.length !== 1) {
      reasons.push("exactly one Grid Y Axis attribute and one Grid X Axis attribute must be mapped to this product");
    }

    const rowAxis = rowAxisMappings[0];
    const columnAxis = columnAxisMappings[0];

    if (rowAxis && rowAxis.attribute.role !== "Y_GRID") {
      reasons.push(`${rowAxis.attribute.name} must use the Grid Y Axis display type to drive matrix rows`);
    }
    if (columnAxis && columnAxis.attribute.role !== "X_GRID") {
      reasons.push(`${columnAxis.attribute.name} must use the Grid X Axis display type to drive matrix columns`);
    }

    const rowValues = rowAxis?.allowedValues.map((allowedValue) => allowedValue.attributeValue) ?? [];
    const columnValues = columnAxis?.allowedValues.map((allowedValue) => allowedValue.attributeValue) ?? [];

    if (rowAxis && rowValues.length === 0) {
      reasons.push(`${rowAxis.attribute.name} has no allowed row values`);
    }
    if (columnAxis && columnValues.length === 0) {
      reasons.push(`${columnAxis.attribute.name} has no allowed column values`);
    }

    if (rowAxis && columnAxis) {
      const extraVariableMappings = mappedAttributeRows.filter(
        (mapping) =>
          mapping.attributeId !== rowAxis.attributeId &&
          mapping.attributeId !== columnAxis.attributeId &&
          mapping.allowedValues.length > 1
      );
      if (extraVariableMappings.length) {
        reasons.push(`extra variant dimensions are not fixed: ${extraVariableMappings.map((mapping) => mapping.attribute.name).join(", ")}`);
      }
    }

    const variantPackageKeys = new Set(filteredVariantRows.map((variant) => variant.packageId ?? "default"));
    if (variantPackageKeys.size > 1) {
      reasons.push("more than one package is present, so each row/column cell would match multiple package variants");
    }

    const rows = rowValues.map((rowValue) => ({
      value: rowValue,
      cells: columnValues.map((columnValue) => {
        const matches = filteredVariantRows.filter((variant) => {
          const selectedValueIds = new Set((variant.attributeValues ?? []).map((attributeValue) => attributeValue.attributeValueId));
          return selectedValueIds.has(rowValue.id) && selectedValueIds.has(columnValue.id);
        });
        if (matches.length === 0) {
          reasons.push(`missing variant for ${rowValue.value} / ${columnValue.value}`);
        }
        if (matches.length > 1) {
          reasons.push(`multiple variants match ${rowValue.value} / ${columnValue.value}`);
        }
        return { columnValue, variant: matches.length === 1 ? matches[0] : null };
      }),
    }));

    const uniqueReasons = Array.from(new Set(reasons));
    if (uniqueReasons.length || !rowAxis || !columnAxis) {
      return { mode: "flat" as const, reasons: uniqueReasons };
    }

    return { mode: "grid" as const, reasons: [], rowAxis, columnAxis, rows };
  }, [mappedAttributeRows, filteredVariantRows]);
  const variantDisplayMode = variantGridState.mode;

  const pricingCols = useMemo(() => {
    const cols: Column<{
      id: string;
      country: { name: string; code: string };
      currency: { symbol: string };
      mrp: number;
      sellingPrice: number;
      dealerPrice?: number | null;
      distributorPrice?: number | null;
      status: string;
    }>[] = [
      {
        key: "selection",
        label: (
          <input
            type="checkbox"
            checked={selectedPriceIds.length === productBasePrices.length && productBasePrices.length > 0}
            onChange={handleSelectAllPrices}
            className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
          />
        ) as unknown as string,
        width: "40px",
        render: (r) => (
          <input
            type="checkbox"
            checked={selectedPriceIds.includes(r.id)}
            onChange={() => handleToggleSelectPrice(r.id)}
            className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
          />
        ),
      },
      { key: "country", label: "Country", render: (r) => `${r.country.name} (${r.country.code})` },
      { key: "mrp", label: "MRP", render: (r) => `${r.currency.symbol}${r.mrp}` },
      { key: "sellingPrice", label: "Selling Price", render: (r) => `${r.currency.symbol}${r.sellingPrice}` },
      { key: "dealerPrice", label: "Dealer", render: (r) => (r.dealerPrice != null ? `${r.currency.symbol}${r.dealerPrice}` : "—") },
      { key: "distributorPrice", label: "Doctor / Retailer", render: (r) => (r.distributorPrice != null ? `${r.currency.symbol}${r.distributorPrice}` : "—") },
      { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        label: "Actions",
        width: "100px",
        render: (r) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartEditPrice(r)}
              className="rounded border border-[#E6E6E6] p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteProductPrice(r.id)}
              className="rounded border border-[#F2C9C9] p-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ];
    return cols;
  }, [productBasePrices, selectedPriceIds]);

  const enabledCountryCount = (productCountries as CountryAvailability[]).filter((country) => countryOverrides[country.id] ?? country.enabled).length;

  const saveCountryAvailability = async () => {
    try {
      await updateProductCountries.mutateAsync((productCountries as CountryAvailability[]).map((country) => ({
        countryId: country.id,
        enabled: countryOverrides[country.id] ?? country.enabled,
      })));
      setCountryOverrides({});
      showToast("Country availability saved.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save country availability."), "error");
    }
  };

  const openVariantCountriesModal = (variant: VariantRow) => {
    setVariantCountryModalVariant(variant);
    setVariantCountryOverrides({});
  };

  const closeVariantCountriesModal = () => {
    setVariantCountryModalVariant(null);
    setVariantCountryOverrides({});
  };

  const saveVariantCountryAvailability = async () => {
    if (!variantCountryModalVariant) return;
    try {
      await updateVariantCountries.mutateAsync((variantCountries as CountryAvailability[]).map((country) => ({
        countryId: country.id,
        enabled: variantCountryOverrides[country.id] ?? country.enabled,
      })));
      showToast("Variant country availability saved.");
      closeVariantCountriesModal();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save variant country availability."), "error");
    }
  };

  const getBulkVariantDraft = (variant: VariantRow): Required<BulkVariantDraft> => {
    const price = getVariantPriceForCountry(variant, primarySelectedBulkCountryId, productBasePrices);
    return {
      mrp: bulkDrafts[variant.id]?.mrp ?? (price?.mrp !== undefined && price?.mrp !== null ? `${price.mrp}` : ""),
      price: bulkDrafts[variant.id]?.price ?? (price?.sellingPrice !== undefined && price?.sellingPrice !== null ? `${price.sellingPrice}` : ""),
      dealerPrice: bulkDrafts[variant.id]?.dealerPrice ?? (price?.dealerPrice !== undefined && price?.dealerPrice !== null ? `${price.dealerPrice}` : ""),
      doctorRetailerPrice:
        bulkDrafts[variant.id]?.doctorRetailerPrice ??
        (price?.distributorPrice !== undefined && price?.distributorPrice !== null ? `${price.distributorPrice}` : ""),
      stock:
        bulkDrafts[variant.id]?.stock ??
        (getBaseInventory(variant.inventories)?.stock !== undefined && getBaseInventory(variant.inventories)?.stock !== null
          ? `${getBaseInventory(variant.inventories)?.stock}`
          : ""),
    };
  };

  const updateBulkDraft = (variantId: string, patch: BulkVariantDraft) => {
    setBulkDrafts((current) => ({
      ...current,
      [variantId]: { ...(current[variantId] ?? {}), ...patch },
    }));
    setBulkRowErrors((current) => {
      if (!current[variantId]) return current;
      const next = { ...current };
      delete next[variantId];
      return next;
    });
  };

  const applyToAllBulkDraft = (field: keyof BulkVariantDraft) => {
    if (!filteredVariantRows.length) return;
    const firstRowDraft = getBulkVariantDraft(filteredVariantRows[0]);
    const valueToApply = firstRowDraft[field];

    setBulkDrafts((prev) => {
      const next = { ...prev };
      filteredVariantRows.forEach((row) => {
        next[row.id] = {
          ...next[row.id],
          [field]: valueToApply
        };
      });
      return next;
    });
    showToast(`Applied value to all ${filteredVariantRows.length} variants.`);
  };

  const saveBulkVariantEdits = async () => {
    const updates = variantRows
      .flatMap((variant) => {
        const draft = bulkDrafts[variant.id];
        if (!draft) return [];
        const currentPrice = getVariantPriceForCountry(variant, primarySelectedBulkCountryId, productBasePrices);
        const currentMrpValue = currentPrice?.mrp !== undefined && currentPrice?.mrp !== null ? `${currentPrice.mrp}` : "";
        const currentPriceValue = currentPrice?.sellingPrice !== undefined && currentPrice?.sellingPrice !== null ? `${currentPrice.sellingPrice}` : "";
        const currentDealerPriceValue = currentPrice?.dealerPrice !== undefined && currentPrice?.dealerPrice !== null ? `${currentPrice.dealerPrice}` : "";
        const currentDoctorRetailerPriceValue =
          currentPrice?.distributorPrice !== undefined && currentPrice?.distributorPrice !== null ? `${currentPrice.distributorPrice}` : "";
        const currentStockValue =
          getBaseInventory(variant.inventories)?.stock !== undefined && getBaseInventory(variant.inventories)?.stock !== null
            ? `${getBaseInventory(variant.inventories)?.stock}`
            : "";
        const mrpChanged = draft.mrp !== undefined && draft.mrp !== currentMrpValue;
        const priceChanged = draft.price !== undefined && draft.price !== currentPriceValue;
        const dealerPriceChanged = draft.dealerPrice !== undefined && draft.dealerPrice !== currentDealerPriceValue;
        const doctorRetailerPriceChanged =
          draft.doctorRetailerPrice !== undefined && draft.doctorRetailerPrice !== currentDoctorRetailerPriceValue;
        const stockChanged = draft.stock !== undefined && draft.stock !== currentStockValue;
        if (!mrpChanged && !priceChanged && !dealerPriceChanged && !doctorRetailerPriceChanged && !stockChanged) return [];
        
        const updates: any[] = [];
        if (stockChanged) {
          updates.push({
            variantId: variant.id,
            stock: draft.stock
          });
        }
        
        if (mrpChanged || priceChanged || dealerPriceChanged || doctorRetailerPriceChanged) {
          const countriesToUpdate = bulkCountryIds.length > 0 ? bulkCountryIds : ["ALL"];
          countriesToUpdate.forEach(cid => {
            updates.push({
              variantId: variant.id,
              countryId: cid === "ALL" ? undefined : cid,
              price: {
                ...(mrpChanged ? { mrp: draft.mrp } : {}),
                ...(priceChanged ? { sellingPrice: draft.price } : {}),
                ...(dealerPriceChanged ? { dealerPrice: draft.dealerPrice } : {}),
                ...(doctorRetailerPriceChanged ? { distributorPrice: draft.doctorRetailerPrice } : {}),
              },
            });
          });
        }
        return updates;
      });

    if (!updates.length) {
      showToast("No bulk changes to save.");
      return;
    }

    setBulkSaving(true);
    try {
      const response = await adminApi.put(`/products/${productId}/variants/bulk`, { updates });
      const results = response.data.data.results as { index: number; variantId?: string; success: boolean; error?: string }[];
      const nextErrors: Record<string, string> = {};
      results.forEach((result) => {
        if (!result.success && result.variantId) nextErrors[result.variantId] = result.error || "Failed to save this variant.";
      });
      setBulkRowErrors(nextErrors);
      const failed = Object.keys(nextErrors).length;
      const succeeded = results.filter((result) => result.success).length;
      showToast(failed ? `Saved ${succeeded}; ${failed} row${failed === 1 ? "" : "s"} failed.` : `Saved ${succeeded} variant update${succeeded === 1 ? "" : "s"}.`, failed ? "error" : "success");
      await refetch();
      if (!failed) setBulkDrafts({});
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk update failed."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const exportSelectedCountryVariantPrices = async () => {
    if (!bulkCountryIds.length) {
      showToast("Select at least one country before exporting variant prices.", "error");
      return;
    }
    const cid = primarySelectedBulkCountryId;
    const country = bulkCountryOptions.find((option) => option.id === cid);
    setVariantPriceExporting(true);
    try {
      const response = await adminApi.get(`/products/${productId}/variants/prices/export`, {
        params: { countryId: cid },
        responseType: "blob",
      });
      const countryCode = country?.code || "country";
      downloadBlob(response.data as Blob, `${product.slug || productId}-${countryCode}-variant-prices.xlsx`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export variant prices."), "error");
    } finally {
      setVariantPriceExporting(false);
    }
  };

  const importSelectedCountryVariantPrices = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!bulkCountryIds.length) {
      showToast("Select a country before importing variant prices.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("countryId", primarySelectedBulkCountryId);

    setVariantPriceImporting(true);
    try {
      const response = await adminApi.post(`/products/${productId}/variants/prices/import`, formData);
      const summary = response.data?.data?.summary as { succeeded?: number; failed?: number } | undefined;
      showToast(
        summary?.failed
          ? `Imported ${summary.succeeded ?? 0}; ${summary.failed} failed.`
          : `Imported ${summary?.succeeded ?? 0} variant price${summary?.succeeded === 1 ? "" : "s"}.`,
        summary?.failed ? "error" : "success",
      );
      setBulkDrafts({});
      setBulkRowErrors({});
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import variant prices."), "error");
    } finally {
      setVariantPriceImporting(false);
    }
  };

  const handleBulkDeleteVariants = () => {
    if (!selectedVariantIds.length) {
      showToast("Select at least one variant.", "error");
      return;
    }
    setDeletingBulkVariantsModal(true);
  };

  const confirmBulkDeleteVariants = async () => {
    setBulkSaving(true);
    try {
      const response = await adminApi.put(`/products/${productId}/variants/bulk`, {
        updates: selectedVariantIds.map((variantId) => ({ variantId, action: "delete" })),
      });
      const summary = response.data.data.summary as { succeeded: number; failed: number };
      showToast(summary.failed ? `Deleted ${summary.succeeded}; ${summary.failed} failed.` : `${summary.succeeded} variant${summary.succeeded === 1 ? "" : "s"} deleted.`, summary.failed ? "error" : "success");
      setSelectedVariantIds([]);
      setDeletingBulkVariantsModal(false);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk delete failed."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const buildRulePayload = (draft: RuleDraft, includeMoq: boolean) => ({
    ...(draft.tierId ? { tierId: draft.tierId } : {}),
    countryId: draft.countryId,
    variantId: draft.variantId || null,
    ...(includeMoq ? { 
      minQuantity: Number(draft.minQuantity),
      maxQuantity: draft.maxQuantity ? Number(draft.maxQuantity) : null
    } : {}),
    discountPercent: draft.mode === "discount" ? draft.discountPercent : null,
    fixedPrice: draft.mode === "fixed" ? draft.fixedPrice : null,
  });

  const handleCreateTierRule = async () => {
    const countriesToApply = tierRuleDraft.countryIds?.length ? tierRuleDraft.countryIds : [tierRuleDraft.countryId].filter(Boolean);
    const variantsToApply = tierRuleDraft.variantIds?.length ? tierRuleDraft.variantIds : [tierRuleDraft.variantId];

    if (!tierRuleDraft.tierId || countriesToApply.length === 0) {
      showToast("Choose tier and at least one country.", "error");
      return;
    }

    try {
      let createdCount = 0;
      for (const countryId of countriesToApply) {
        for (const variantId of variantsToApply) {
          await createTierPricing.mutateAsync(buildRulePayload({ ...tierRuleDraft, countryId, variantId }, false));
          createdCount++;
        }
      }
      resetTierRuleDraft();
      showToast(`${createdCount} Tier pricing rule(s) created.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create tier pricing rule."), "error");
    }
  };

  const handleEditTierRuleClick = (rule: any) => {
    setEditingTierRuleId(rule.id);
    setTierRuleDraft({
      tierId: rule.tierId || rule.tier?.id || "",
      countryId: rule.countryId || rule.country?.id || "",
      variantId: rule.variantId || rule.variant?.id || "",
      countryIds: rule.countryId || rule.country?.id ? [rule.countryId || rule.country?.id] : [],
      variantIds: rule.variantId || rule.variant?.id ? [rule.variantId || rule.variant?.id] : [""],
      minQuantity: "10",
      maxQuantity: "",
      mode: rule.discountPercent !== null && rule.discountPercent !== undefined ? "discount" : "fixed",
      discountPercent: rule.discountPercent ? rule.discountPercent.toString() : "",
      fixedPrice: rule.fixedPrice ? rule.fixedPrice.toString() : "",
    });
  };

  const handleUpdateTierRule = async () => {
    if (!editingTierRuleId) return;

    try {
      const payload = buildRulePayload(tierRuleDraft, false);
      await updateTierPricing.mutateAsync({
        id: editingTierRuleId,
        ...payload,
      });
      resetTierRuleDraft();
      showToast("Tier pricing rule updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update tier pricing rule."), "error");
    }
  };

  const handleCreateMoqRule = async () => {
    const countriesToApply = moqRuleDraft.countryIds?.length ? moqRuleDraft.countryIds : [moqRuleDraft.countryId].filter(Boolean);
    const variantsToApply = moqRuleDraft.variantIds?.length ? moqRuleDraft.variantIds : [moqRuleDraft.variantId];

    if (countriesToApply.length === 0) {
      showToast("Choose at least one country.", "error");
      return;
    }

    try {
      let createdCount = 0;
      for (const countryId of countriesToApply) {
        for (const variantId of variantsToApply) {
          await createMoqPricing.mutateAsync(buildRulePayload({ ...moqRuleDraft, countryId, variantId }, true));
          createdCount++;
        }
      }
      resetMoqRuleDraft();
      showToast(`${createdCount} MOQ pricing rule(s) created.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create MOQ pricing rule."), "error");
    }
  };

  const handleEditMoqRuleClick = (rule: any) => {
    setEditingMoqRuleId(rule.id);
    setMoqRuleDraft({
      tierId: "",
      countryId: rule.countryId || rule.country?.id || "",
      variantId: rule.variantId || rule.variant?.id || "",
      countryIds: rule.countryId || rule.country?.id ? [rule.countryId || rule.country?.id] : [],
      variantIds: rule.variantId || rule.variant?.id ? [rule.variantId || rule.variant?.id] : [""],
      minQuantity: rule.minQuantity ? rule.minQuantity.toString() : "10",
      maxQuantity: rule.maxQuantity ? rule.maxQuantity.toString() : "",
      mode: rule.discountPercent !== null && rule.discountPercent !== undefined ? "discount" : "fixed",
      discountPercent: rule.discountPercent ? rule.discountPercent.toString() : "",
      fixedPrice: rule.fixedPrice ? rule.fixedPrice.toString() : "",
    });
  };

  const handleUpdateMoqRule = async () => {
    if (!editingMoqRuleId) return;

    try {
      const payload = buildRulePayload(moqRuleDraft, true);
      await updateMoqPricing.mutateAsync({
        id: editingMoqRuleId,
        ...payload,
      });
      resetMoqRuleDraft();
      showToast("MOQ pricing rule updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update MOQ pricing rule."), "error");
    }
  };

  const handleDeleteTierRule = async (ruleId: string) => {
    try {
      await deleteTierPricing.mutateAsync(ruleId);
      showToast("Tier pricing rule deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete tier pricing rule."), "error");
    }
  };

  const handleDeleteMoqRule = async (ruleId: string) => {
    try {
      await deleteMoqPricing.mutateAsync(ruleId);
      showToast("MOQ pricing rule deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete MOQ pricing rule."), "error");
    }
  };

  const toProductAttributePayload = (rows: ProductAttributeMapping[]) =>
    rows.map((mapping) => ({
      attributeId: mapping.attributeId,
      required: mapping.required,
      gridAxis: mapping.gridAxis ?? null,
      allowedValueIds: mapping.allowedValues.map((allowedValue) => allowedValue.attributeValueId),
    }));

  const resetAttributeMappingForm = () => {
    setSelectedMappingAttributeId("");
    setNewMappingRequired(true);
    setNewMappingGridAxis(null);
    setNewMappingValueIds([]);
    setMappingValueFilter("ALL");
    setMappingValueSearch("");
  };

  const toggleNewMappingValue = (valueId: string) => {
    setNewMappingValueIds((current) =>
      current.includes(valueId) ? current.filter((id) => id !== valueId) : [...current, valueId]
    );
  };

  const selectAllNewMappingValues = () => {
    setNewMappingValueIds(selectedAttributeValues.map((value) => value.id));
  };

  const clearAllNewMappingValues = () => {
    setNewMappingValueIds([]);
  };

  const handleReorderValues = async (nextValues: any[]) => {
    if (!selectedMappingAttributeId) return;
    try {
      await reorderAttributeValues.mutateAsync({
        attributeId: selectedMappingAttributeId,
        items: nextValues.map((v, idx) => ({ id: v.id, sortOrder: idx })),
      });
      await refetchProductAttributes();
      showToast("Attribute values order updated.");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update values order."), "error");
    }
  };

  const handleReorderSelectedValues = async (
    mapping: ProductAttributeMapping,
    newOrderedValueIds: string[]
  ) => {
    const allValues = [...mapping.attribute.values];
    const selectedIdSet = new Set(newOrderedValueIds);

    const slotIndices: number[] = [];
    allValues.forEach((val, idx) => {
      if (selectedIdSet.has(val.id)) {
        slotIndices.push(idx);
      }
    });

    const valueMap = new Map(allValues.map((v) => [v.id, v]));
    const reorderedSubset = newOrderedValueIds
      .map((id) => valueMap.get(id))
      .filter(Boolean) as AttributeValueDetail[];

    slotIndices.forEach((slotIdx, i) => {
      if (reorderedSubset[i]) {
        allValues[slotIdx] = reorderedSubset[i];
      }
    });

    const items = allValues.map((val, idx) => ({ id: val.id, sortOrder: idx }));

    try {
      await reorderAttributeValues.mutateAsync({
        attributeId: mapping.attributeId,
        items,
      });
      await refetchProductAttributes();
      showToast("Option values order updated.");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update values order."), "error");
    }
  };

  const handleMoveSelectedItem = (fromIdx: number, toIdx: number) => {
    if (fromIdx < 0 || fromIdx >= newMappingValueIds.length || toIdx < 0 || toIdx >= newMappingValueIds.length) return;
    setNewMappingValueIds((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleMoveCardAllowedValue = async (
    mapping: ProductAttributeMapping,
    fromIdx: number,
    toIdx: number
  ) => {
    const currentItems = mapping.allowedValues.map((av) => av.attributeValueId);
    if (fromIdx < 0 || fromIdx >= currentItems.length || toIdx < 0 || toIdx >= currentItems.length) return;
    const nextItems = [...currentItems];
    const [moved] = nextItems.splice(fromIdx, 1);
    nextItems.splice(toIdx, 0, moved);
    await handleReorderSelectedValues(mapping, nextItems);
  };


  const handleReorderFilteredValues = async (nextFilteredValues: AttributeValueDetail[]) => {
    if (!selectedMappingAttributeId) return;
    if (mappingValueFilter === "SELECTED") {
      setNewMappingValueIds(nextFilteredValues.map((v) => v.id));
    }
    if (mappingValueFilter === "ALL" && !mappingValueSearch.trim()) {
      return handleReorderValues(nextFilteredValues);
    }
    const filteredIdSet = new Set(nextFilteredValues.map((v) => v.id));
    let nextFilteredIdx = 0;
    const nextFullValues = selectedAttributeValues.map((v) => {
      if (filteredIdSet.has(v.id)) {
        return nextFilteredValues[nextFilteredIdx++];
      }
      return v;
    });
    return handleReorderValues(nextFullValues);
  };

  const handleAddProductAttribute = async () => {
    if (!selectedMappingAttributeId) {
      showToast("Choose an attribute to map.", "error");
      return;
    }

    try {
      const existingMappings = toProductAttributePayload(mappedAttributeRows);
      const isUpdate = existingMappings.some(m => m.attributeId === selectedMappingAttributeId);
      
      const nextMappings = isUpdate 
        ? existingMappings.map(m => m.attributeId === selectedMappingAttributeId ? {
            attributeId: selectedMappingAttributeId,
            required: newMappingRequired,
            gridAxis: newMappingGridAxis,
            allowedValueIds: newMappingValueIds,
          } : m)
        : [
            ...existingMappings,
            {
              attributeId: selectedMappingAttributeId,
              required: newMappingRequired,
              gridAxis: newMappingGridAxis,
              allowedValueIds: newMappingValueIds,
            },
          ];

      await assignProductAttributes.mutateAsync(nextMappings);
      resetAttributeMappingForm();
      showToast(isUpdate ? "Product attribute updated." : "Product attribute mapped.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to map product attribute."), "error");
    }
  };

  const handleEditMappedAttribute = (mapping: ProductAttributeMapping) => {
    setSelectedMappingAttributeId(mapping.attributeId);
    setNewMappingRequired(mapping.required);
    setNewMappingGridAxis(mapping.gridAxis ?? null);
    setNewMappingValueIds(mapping.allowedValues.map((v) => v.attributeValueId));
    setMappingValueFilter(mapping.allowedValues.length > 0 ? "SELECTED" : "ALL");
    setMappingValueSearch("");
    // Scroll edit panel into view without pushing header off-screen
    attributeEditPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleToggleMappedRequired = async (attributeId: string, required: boolean) => {
    try {
      await assignProductAttributes.mutateAsync(
        toProductAttributePayload(mappedAttributeRows).map((mapping) =>
          mapping.attributeId === attributeId ? { ...mapping, required } : mapping
        )
      );
      showToast("Attribute requirement updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update attribute requirement."), "error");
    }
  };

  const handleSetMappedGridAxis = async (attributeId: string, gridAxis: GridAxis | null) => {
    try {
      await assignProductAttributes.mutateAsync(
        toProductAttributePayload(mappedAttributeRows).map((mapping) =>
          mapping.attributeId === attributeId
            ? { ...mapping, gridAxis }
            : mapping
        )
      );
      showToast(gridAxis === "COLUMN" ? "Column attribute updated." : gridAxis === "ROW" ? "Row attribute updated." : "Attribute changed to Dropdown.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update grid axis."), "error");
    }
  };

  const handleRemoveProductAttribute = async (attributeId: string) => {
    try {
      await removeProductAttribute.mutateAsync(attributeId);
      showToast("Attribute unmapped.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to unmap attribute."), "error");
    }
  };

  const handleToggleMappedVisibility = async (attributeId: string, visibleOnStorefront: boolean) => {
    try {
      await updateProductFilterVisibility.mutateAsync(
        mappedAttributeRows.map((mapping) => ({
          attributeId: mapping.attributeId,
          attributeName: mapping.attribute.name,
          visibleOnStorefront:
            mapping.attributeId === attributeId ? visibleOnStorefront : mapping.visibleOnStorefront !== false,
        }))
      );
      showToast(visibleOnStorefront ? "Filter will appear on the storefront." : "Filter hidden from the storefront.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update storefront visibility."), "error");
    }
  };

  const handleMoveMappedAttributeIdx = async (fromIdx: number, toIdx: number) => {
    if (fromIdx < 0 || fromIdx >= mappedAttributeRows.length || toIdx < 0 || toIdx >= mappedAttributeRows.length) return;
    const next = [...mappedAttributeRows];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    try {
      queryClient.setQueryData(["admin-product-attributes", productId], next);
      await assignProductAttributes.mutateAsync(toProductAttributePayload(next));
      await refetchProductAttributes();
      showToast("Attribute order updated.");
    } catch (error) {
      await refetchProductAttributes();
      showToast(getAdminErrorMessage(error, "Failed to reorder attributes."), "error");
    }
  };

  const handleReorderMappedAttributes = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = mappedAttributeRows.findIndex((m) => m.id === fromId || m.attributeId === fromId);
    const toIndex = mappedAttributeRows.findIndex((m) => m.id === toId || m.attributeId === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...mappedAttributeRows];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    try {
      queryClient.setQueryData(["admin-product-attributes", productId], next);
      await assignProductAttributes.mutateAsync(toProductAttributePayload(next));
      await refetchProductAttributes();
      showToast("Attribute order updated.");
    } catch (error) {
      await refetchProductAttributes();
      showToast(getAdminErrorMessage(error, "Failed to reorder attributes."), "error");
    }
  };

  const handleExportProductAttributes = async () => {
    setAttrExporting(true);
    try {
      const response = await adminApi.get(`/products/${productId}/attributes/export`, {
        responseType: "blob",
      });
      downloadBlob(response.data as Blob, `product-${product.slug || productId}-attributes.xlsx`);
      showToast("Product attributes exported successfully.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export product attributes."), "error");
    } finally {
      setAttrExporting(false);
    }
  };

  const downloadProductAttributesSampleTemplate = async () => {
    try {
      const response = await adminApi.get(`/products/${productId}/attributes/sample-template`, {
        responseType: "blob",
      });
      downloadBlob(response.data as Blob, "product-attributes-template.xlsx");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download sample template."), "error");
    }
  };

  const openProductAttributesImportDialog = () => {
    setAttrImportOpen(true);
  };

  const roleBadgeClass = (role: AttributeRole) =>
    role === "DROPDOWN"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : role === "X_GRID"
        ? "border-purple-200 bg-purple-50 text-purple-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const getDisplayTypeLabel = (gridAxis?: GridAxis | null) => {
    const role = gridAxis === "ROW" ? "Y_GRID" : gridAxis === "COLUMN" ? "X_GRID" : "DROPDOWN";
    return role === "X_GRID" ? "Matrix columns" : role === "Y_GRID" ? "Matrix rows" : "Dropdown filter";
  };

  const getDisplayTypeRole = (gridAxis?: GridAxis | null): AttributeRole =>
    gridAxis === "ROW" ? "Y_GRID" : gridAxis === "COLUMN" ? "X_GRID" : "DROPDOWN";

  const getDisplayTypeValue = (gridAxis?: GridAxis | null) => {
    if (gridAxis === "ROW") return "ROW";
    if (gridAxis === "COLUMN") return "COLUMN";
    return "";
  };

  const formatPriceValue = (value?: string | number | null) => (value === null || value === undefined || value === "" ? "Not set" : `${value}`);

  const saveProductTranslation = async (languageId: string, field: ProductTranslationField, value: string) => {
    const trimmed = value.trim();
    try {
      await adminApi.put(`/translations/products/${productId}/${languageId}`, { [field]: trimmed });
      showToast(toastMessages.translationSaved);
      refetch();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  };

  const resetPackageForm = () => {
    setEditingPackage(null);
    setPackageTitle("");
    setPackageDescription("");
    setPackageImage("");
    setUploadingPackageImage(false);
    setPackageSortOrder(0);
    setPackageStatus("ACTIVE");
  };

  const openPackageModal = (pkg?: PackageRow) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageTitle(pkg.title);
      setPackageDescription(pkg.description || "");
      setPackageImage(pkg.image || "");
      setPackageSortOrder(pkg.sortOrder ?? 0);
      setPackageStatus(pkg.status || "ACTIVE");
    } else {
      resetPackageForm();
      setPackageSortOrder(packageRows.length + 1);
    }
    setPackageModalOpen(true);
  };

  const handleSavePackage = async () => {
    if (!packageTitle.trim()) {
      showToast("Package title is required.", "error");
      return;
    }

    try {
      const targetSortOrder = Number(packageSortOrder) || 1;
      const payload = {
        title: packageTitle.trim(),
        description: packageDescription.trim() || null,
        image: packageImage.trim() || null,
        sortOrder: targetSortOrder,
        status: packageStatus,
      };

      // Auto-adjust existing DB packages that conflict with targetSortOrder
      const dbPackages = (product?.packages ?? []) as PackageRow[];
      const conflictingDbPackages = dbPackages.filter((pkg) => {
        if (editingPackage && pkg.id === editingPackage.id) return false;
        return (pkg.sortOrder ?? 0) >= targetSortOrder;
      });

      for (const confPkg of conflictingDbPackages) {
        await adminApi.put(`/products/${productId}/packages/${confPkg.id}`, {
          sortOrder: (confPkg.sortOrder ?? 0) + 1,
        });
      }

      if (editingPackage && !editingPackage.id.startsWith("default-")) {
        await adminApi.put(`/products/${productId}/packages/${editingPackage.id}`, payload);
        showToast("Package updated.");
      } else {
        await adminApi.post(`/products/${productId}/packages`, payload);
        showToast(editingPackage ? "Package updated." : "Package created.");
      }
      setPackageModalOpen(false);
      resetPackageForm();
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save package."), "error");
    }
  };

  const uploadPackageImage = async (file?: File) => {
    if (!file) return;
    setUploadingPackageImage(true);
    try {
      const results = await uploadMediaFiles([file], {
        entityType: "PRODUCT",
        entityId: productId && productId !== "new" ? productId : undefined,
        purpose: "PACKAGE"
      });
      
      const uploaded = results[0];
      if (uploaded?.url) {
        setPackageImage(uploaded.url);
        showToast("Package image uploaded.");
      } else {
        throw new Error("Upload completed, but no image URL was returned.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Package image upload failed."), "error");
    } finally {
      setUploadingPackageImage(false);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (packageId.startsWith("default-")) {
      setDeletedDefaultPackageIds((prev) => [...prev, packageId]);
      showToast("Package deleted.");
      setDeletingPackage(null);
      return;
    }
    try {
      await adminApi.delete(`/products/${productId}/packages/${packageId}`);
      showToast("Package deleted.");
      refetch();
    } catch {
      showToast("Failed to delete package.", "error");
    } finally {
      setDeletingPackage(null);
    }
  };

  const handleMediaFilesUpload = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    // Filter image files
    const validImageFiles = fileList.filter((file) => file.type.startsWith("image/"));
    if (validImageFiles.length < fileList.length) {
      showToast("Only image files (JPG, PNG, WEBP, GIF, SVG) are supported.", "error");
    }
    if (validImageFiles.length === 0) return;

    setUploadingMedia(true);
    setUploadingMediaCount(validImageFiles.length);
    let totalUploadedCount = 0;
    let hasError = false;

    // Backend multer route accepts up to 10 files per request (upload.array("files", 10))
    const BATCH_SIZE = 10;
    const fileBatches: File[][] = [];
    for (let i = 0; i < validImageFiles.length; i += BATCH_SIZE) {
      fileBatches.push(validImageFiles.slice(i, i + BATCH_SIZE));
    }

    try {
      for (const batch of fileBatches) {
        try {
          const results = await uploadMediaFiles(batch, {
            entityType: "PRODUCT",
            entityId: productId && productId !== "new" ? productId : undefined
          });
          const mediaIds = results.map(r => r.mediaId).filter(Boolean);
          // Only link manually if the product is new or has no ID yet, as the backend already auto-links existing products
          const needsManualLink = !productId || productId === "new";
          if (mediaIds.length > 0 && needsManualLink) {
            await adminApi.post(`/products/${productId}/media`, { mediaIds });
          } else if (results.length > 0 && needsManualLink) {
            // Fallback for purely local that didn't return mediaIds (though uploadMediaFiles should)
            const formData = new FormData();
            batch.forEach((file) => formData.append("files", file));
            await adminApi.post(`/products/${productId}/media`, formData);
          }
          totalUploadedCount += batch.length;
        } catch (err) {
          hasError = true;
        } finally {
          setUploadingMediaCount((prev) => Math.max(0, prev - batch.length));
        }
      }

      if (totalUploadedCount > 0) {
        if (hasError) {
          showToast(`Uploaded ${totalUploadedCount} image(s). Some files failed to upload.`, "error");
        } else {
          showToast(totalUploadedCount === 1 ? "Product image uploaded." : `${totalUploadedCount} product images uploaded.`);
        }
        refetch();
      } else if (hasError) {
        showToast("Failed to upload image(s).", "error");
      }
    } finally {
      setUploadingMedia(false);
      setUploadingMediaCount(0);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const filesArray = Array.from(files);
    e.target.value = "";
    await handleMediaFilesUpload(filesArray);
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverMedia(false);
    if (uploadingMedia) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleMediaFilesUpload(droppedFiles);
    }
  };

  const handleMediaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOverMedia) setIsDragOverMedia(true);
  };

  const handleMediaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragOverMedia) setIsDragOverMedia(false);
  };

  const handlePdfFilesUpload = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const pdfFile = fileList.find(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfFile) {
      showToast("Only PDF files (.pdf) are supported for product catalogue.", "error");
      return;
    }

    try {
      setUploadingPdf(true);

      // Clean up previous PDF catalogue media records so there is strictly 1 single catalogue PDF
      const existingPdfMedia = (product.media ?? []).filter(
        (m: any) => m.type === "PDF" || m.mimeType?.includes("pdf") || m.url?.toLowerCase().endsWith(".pdf")
      );
      if (productId && productId !== "new" && existingPdfMedia.length > 0) {
        await Promise.all(
          existingPdfMedia.map((m: any) =>
            m.id ? adminApi.delete(`/products/${productId}/media/${m.id}`).catch(() => {}) : Promise.resolve()
          )
        );
      }

      const results = await uploadMediaFiles([pdfFile], {
        entityType: "PRODUCT",
        entityId: productId && productId !== "new" ? productId : undefined,
        purpose: "CATALOGUE",
      });

      const mediaIds = results.map((r) => r.mediaId).filter(Boolean);
      const needsManualLink = !productId || productId === "new";
      if (mediaIds.length > 0 && needsManualLink) {
        await adminApi.post(`/products/${productId}/media`, { mediaIds });
      }
      showToast("Product catalogue PDF uploaded successfully.");
      refetch();
    } catch {
      showToast("Failed to upload catalogue PDF.", "error");
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeletePdfCatalogue = async () => {
    const pdfMedia = (product.media ?? []).filter(
      (m: any) => m.type === "PDF" || m.mimeType?.includes("pdf") || m.url?.toLowerCase().endsWith(".pdf")
    );
    if (pdfMedia.length === 0) return;
    try {
      setUploadingPdf(true);
      await Promise.all(
        pdfMedia.map((m: any) =>
          m.id ? adminApi.delete(`/products/${productId}/media/${m.id}`).catch(() => {}) : Promise.resolve()
        )
      );
      showToast("Catalogue PDF removed.");
      refetch();
    } catch {
      showToast("Failed to remove catalogue PDF.", "error");
    } finally {
      setUploadingPdf(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const filesArray = Array.from(files);
    e.target.value = "";
    await handlePdfFilesUpload(filesArray);
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverPdf(false);
    if (uploadingPdf) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handlePdfFilesUpload(droppedFiles);
    }
  };

  const handlePdfDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOverPdf) setIsDragOverPdf(true);
  };

  const handlePdfDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragOverPdf) setIsDragOverPdf(false);
  };

  const handleAttachCatalogueFromMedia = async (media: MediaItem) => {
    try {
      setUploadingPdf(true);
      const pdfMedia = (product?.media ?? []).filter(
        (m: any) => m.type === "PDF" || m.mimeType?.includes("pdf") || m.url?.toLowerCase().endsWith(".pdf")
      );
      if (pdfMedia.length > 0 && productId && productId !== "new") {
        await Promise.all(
          pdfMedia.map((m: any) =>
            m.id ? adminApi.delete(`/products/${productId}/media/${m.id}`).catch(() => {}) : Promise.resolve()
          )
        );
      }

      if (productId && productId !== "new") {
        if (media.id) {
          await adminApi.post(`/products/${productId}/media`, {
            mediaIds: [media.id],
          });
        }
        await adminApi.put(`/products/${productId}`, { catalogueUrl: media.url }).catch(() => {});
        refetch();
      }
      showToast("Product catalogue PDF linked successfully.");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to link catalogue PDF."), "error");
    } finally {
      setUploadingPdf(false);
      setPdfMediaSelectorOpen(false);
    }
  };

  const handleAttachProductImageFromMedia = async (media: MediaItem) => {
    try {
      setUploadingMedia(true);
      if (productId && productId !== "new" && media.id) {
        await adminApi.post(`/products/${productId}/media`, {
          mediaIds: [media.id],
        });
        refetch();
      }
      showToast("Image added to product gallery.");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to attach image to product gallery."), "error");
    } finally {
      setUploadingMedia(false);
      setImageMediaSelectorOpen(false);
    }
  };

  const handleToggleSelectMedia = (mediaId: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const handleToggleSelectAllMedia = (allIds: string[]) => {
    if (selectedMediaIds.size === allIds.length) {
      setSelectedMediaIds(new Set());
    } else {
      setSelectedMediaIds(new Set(allIds));
    }
  };

  const handleSetCoverMedia = async (mediaId: string) => {
    if (!mediaId || settingCoverMediaId) return;
    setSettingCoverMediaId(mediaId);
    try {
      await adminApi.put(`/products/${productId}/media/${mediaId}/cover`);
      showToast("Cover image updated.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update cover image."), "error");
    } finally {
      setSettingCoverMediaId(null);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await adminApi.delete(`/products/${productId}/media/${mediaId}`);
      showToast("Media deleted.");
      setSelectedMediaIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
      refetch();
    } catch {
      showToast("Delete failed.", "error");
    } finally {
      setDeletingMedia(null);
    }
  };

  const handleBulkDeleteMedia = async () => {
    const idsToDelete = Array.from(selectedMediaIds);
    if (idsToDelete.length === 0) return;
    try {
      await Promise.all(idsToDelete.map((id) => adminApi.delete(`/products/${productId}/media/${id}`)));
      showToast(`${idsToDelete.length} image(s) deleted.`);
      setSelectedMediaIds(new Set());
      refetch();
    } catch {
      showToast("Failed to delete selected images.", "error");
    } finally {
      setDeletingBulkMedia(false);
    }
  };

  const handleDeleteAllMedia = async (allIds: string[]) => {
    if (allIds.length === 0) return;
    try {
      await Promise.all(allIds.map((id) => adminApi.delete(`/products/${productId}/media/${id}`)));
      showToast("All product media deleted.");
      setSelectedMediaIds(new Set());
      refetch();
    } catch {
      showToast("Failed to delete product media.", "error");
    } finally {
      setDeletingAllMedia(false);
    }
  };

  const openManualVariantModal = () => {
    setManualVariantAttributeIds([]);
    setManualVariantSelectionMap({});
    setManualVariantModeMap({});
    setManualVariantAttributePicker("");
    setManualVariantPackageId(packageRows[0]?.id ?? "");
    setManualVariantSku("");
    setManualVariantMoq(1);
    setManualVariantOpen(true);
  };

  const openGenerateVariantModal = () => {
    const seedAttributeIds = hasMappedProductAttributes
      ? mappedAttributeRows.map((mapping) => mapping.attributeId)
      : attributeCatalog.map((attribute) => attribute.id);
    setGeneratePackageIds([]);
    setGenerateAttributeIds(seedAttributeIds);
    
    // Auto-select all available values for each attribute by default
    const initialSelections: Record<string, string[]> = {};
    for (const attributeId of seedAttributeIds) {
      const attribute = variantGenerationCatalog.find((item) => item.id === attributeId);
      if (attribute) {
        initialSelections[attributeId] = getAttributeValues(attribute).map((v) => v.id);
      }
    }
    setGenerateSelectionMap(initialSelections);

    setGenerateModeMap(
      Object.fromEntries(seedAttributeIds.map((attributeId) => [attributeId, "all"])) as GenerateModeMap,
    );
    setGenerateAttributePicker("");
    setGenerateValuePickerMap({});
    setGenerateVariantBasePrice("");
    setGenerateVariantOpen(true);
  };

  const openEditVariantModal = useCallback((variant: VariantRow) => {
    const usedAttributeIds = (variant.attributeValues ?? []).map((value) => value.attributeId);
    setEditingVariant(variant);
    setEditVariantAttributeIds(usedAttributeIds);
    setEditVariantAttributePicker("");
    setEditVariantPackageId(variant.packageId ?? "");
    setEditVariantSku(variant.sku ?? "");
    setEditVariantTitle(variant.title ?? "");
    setEditVariantMoq(Math.max(1, Number(variant.moq) || 1));
    setEditVariantWeight(variant.weight != null ? String(variant.weight) : "");
    setEditVariantLength(variant.length != null ? String(variant.length) : "");
    setEditVariantWidth(variant.width != null ? String(variant.width) : "");
    setEditVariantHeight(variant.height != null ? String(variant.height) : "");
    setEditVariantShippingClass(variant.shippingClass || "");
    setEditVariantFragile(variant.fragile || false);
    setEditVariantHazardous(variant.hazardous || false);
    setEditVariantStatus(variant.status || "ACTIVE");
    setEditVariantSelections(
      Object.fromEntries((variant.attributeValues ?? []).map((value) => [value.attributeId, value.attributeValueId]))
    );
    setEditVariantSubTab("general");
    const pricesMap: Record<string, any> = {};
    (variant.prices ?? []).forEach((price: any) => {
      const inv = (variant.inventories ?? []).find((i: any) => i.countryId === price.countryId);
      pricesMap[price.countryId] = {
        mrp: price.mrp !== undefined && price.mrp !== null ? `${price.mrp}` : "",
        sellingPrice: price.sellingPrice !== undefined && price.sellingPrice !== null ? `${price.sellingPrice}` : "",
        dealerPrice: price.dealerPrice !== undefined && price.dealerPrice !== null ? `${price.dealerPrice}` : "",
        doctorRetailerPrice: price.distributorPrice !== undefined && price.distributorPrice !== null ? `${price.distributorPrice}` : "",
        stock: inv?.stock !== undefined && inv?.stock !== null ? `${inv.stock}` : "",
      };
    });
    (variant.inventories ?? []).forEach((inv: any) => {
      if (inv.countryId && !pricesMap[inv.countryId]) {
        pricesMap[inv.countryId] = {
          mrp: "",
          sellingPrice: "",
          dealerPrice: "",
          doctorRetailerPrice: "",
          stock: `${inv.stock}`,
        };
      } else if (inv.countryId && pricesMap[inv.countryId]) {
        pricesMap[inv.countryId].stock = `${inv.stock}`;
      }
    });
    setEditVariantCountryPrices(pricesMap);
  }, []);

  const closeEditVariantModal = useCallback(() => {
    setEditingVariant(null);
    if (!variantIdFromQuery) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("variant");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, variantIdFromQuery]);

  const openCountryPriceModal = useCallback(() => {
    const mrp = "";
    const sellingPrice = "";
    const overrides: Record<string, { mrp?: string; sellingPrice?: string }> = {};
    variantRows.forEach((variant) => {
      overrides[variant.id] = {};
    });
    setCountryPriceMRP(mrp);
    setCountryPriceSellingPrice(sellingPrice);
    setVariantPriceOverrides(overrides);
    setCountryPriceModalOpen(true);
  }, [variantRows]);

  const closeCountryPriceModal = useCallback(() => {
    if (generatingCountryPrices) return;
    setCountryPriceModalOpen(false);
    setCountryPriceMRP("");
    setCountryPriceSellingPrice("");
    setCountryPriceDealerPrice("");
    setCountryPriceDistributorPrice("");
    setVariantPriceOverrides({});
    setVariantSearchQuery("");
  }, [generatingCountryPrices]);

  const applyMRPToAllVariants = useCallback(() => {
    setVariantPriceOverrides((current) => {
      const next: Record<string, { mrp?: string; sellingPrice?: string; dealerPrice?: string; distributorPrice?: string }> = {};
      variantRows.forEach((variant) => {
        next[variant.id] = {
          mrp: countryPriceMRP,
          sellingPrice: countryPriceSellingPrice,
          dealerPrice: countryPriceDealerPrice,
          distributorPrice: countryPriceDistributorPrice,
        };
      });
      return next;
    });
  }, [countryPriceMRP, countryPriceSellingPrice, countryPriceDealerPrice, countryPriceDistributorPrice, variantRows]);

  const handleGenerateCountryPrices = useCallback(async () => {
    const mrp = Number(countryPriceMRP);
    if (!Number.isFinite(mrp) || mrp <= 0) {
      showToast("Enter a valid MRP greater than 0.", "error");
      return;
    }

    const variantOverrides: Record<string, { mrp: number; sellingPrice?: number; dealerPrice?: number; distributorPrice?: number }> = {};
    variantRows.forEach((variant) => {
      const override = variantPriceOverrides[variant.id];
      if (!override) return;

      const hasMRP = override.mrp != null && override.mrp.trim() !== "";
      const hasSelling = override.sellingPrice != null && override.sellingPrice.trim() !== "";
      const hasDealer = override.dealerPrice != null && override.dealerPrice.trim() !== "";
      const hasDistributor = override.distributorPrice != null && override.distributorPrice.trim() !== "";

      if (hasMRP || hasSelling || hasDealer || hasDistributor) {
        variantOverrides[variant.id] = {
          mrp: hasMRP ? Number(override.mrp) : mrp,
          ...(hasSelling && { sellingPrice: Number(override.sellingPrice) }),
          ...(hasDealer && { dealerPrice: Number(override.dealerPrice) }),
          ...(hasDistributor && { distributorPrice: Number(override.distributorPrice) }),
        };
      }
    });

    try {
      setGeneratingCountryPrices(true);
      const result = await adminApi.post("/pricing/generate-country-prices", {
        productId,
        mrp,
        sellingPrice: countryPriceSellingPrice ? Number(countryPriceSellingPrice) : undefined,
        dealerPrice: countryPriceDealerPrice ? Number(countryPriceDealerPrice) : undefined,
        distributorPrice: countryPriceDistributorPrice ? Number(countryPriceDistributorPrice) : undefined,
        variantOverrides: Object.keys(variantOverrides).length ? variantOverrides : undefined,
      });
      showToast(result.data?.message || "Country prices generated.");
      closeCountryPriceModal();
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to generate country prices."), "error");
    } finally {
      setGeneratingCountryPrices(false);
    }
  }, [closeCountryPriceModal, countryPriceMRP, countryPriceSellingPrice, countryPriceDealerPrice, countryPriceDistributorPrice, productId, refetch, showToast, variantPriceOverrides, variantRows]);

  useEffect(() => {
    if (!variantIdFromQuery || editingVariant) return;
    const match = variantRows.find((variant) => variant.id === variantIdFromQuery);
    if (match) openEditVariantModal(match);
  }, [editingVariant, openEditVariantModal, variantIdFromQuery, variantRows]);

  const handleCloneVariant = async (variantId: string) => {
    try {
      await adminApi.post(`/products/${productId}/variants/${variantId}/clone`);
      showToast("Variant cloned.");
      refetch();
    } catch {
      showToast("Failed to clone variant.", "error");
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await adminApi.delete(`/products/${productId}/variants/${variantId}`);
      showToast("Variant deleted.");
      refetch();
    } catch {
      showToast("Failed to delete variant.", "error");
    } finally {
      setDeletingVariant(null);
    }
  };

  const handleCreateManualVariant = async () => {
    if (!manualVariantAttributeIds.length) {
      showToast("Choose the attributes used by this variant.", "error");
      return;
    }
    if (packageRows.length > 0 && !manualVariantPackageId) {
      showToast("Select a package for this variant.", "error");
      return;
    }

    const attributesPayload = manualVariantAttributeIds
      .map((attributeId) => {
        const attribute = attributeCatalog.find((item) => item.id === attributeId);
        const mode = manualVariantModeMap[attributeId] ?? "single";
        const selectedIds = manualVariantSelectionMap[attributeId] ?? [];

        if (!attribute) return null;
        if (mode === "all") {
          return { attributeId, attributeValueIds: getAttributeValues(attribute).map((value) => value.id) };
        }
        return { attributeId, attributeValueIds: selectedIds };
      })
      .filter(Boolean) as { attributeId: string; attributeValueIds: string[] }[];

    const hasInvalid = manualVariantAttributeIds.some((attributeId) => {
      const mode = manualVariantModeMap[attributeId] ?? "single";
      const selectedIds = manualVariantSelectionMap[attributeId] ?? [];
      if (mode === "single") return selectedIds.length !== 1;
      if (mode === "specific") return selectedIds.length === 0;
      return false;
    });
    if (hasInvalid) {
      showToast("Choose valid values for every selected attribute.", "error");
      return;
    }

    const isSingleVariant = manualVariantAttributeIds.every((attributeId) => (manualVariantModeMap[attributeId] ?? "single") === "single");

    try {
      if (isSingleVariant) {
        await adminApi.post(`/products/${productId}/variants`, {
          attributeValueIds: attributesPayload.flatMap((attribute) => attribute.attributeValueIds),
          packageId: manualVariantPackageId || null,
          sku: manualVariantSku.trim() || undefined,
          moq: manualVariantMoq,
        });
        showToast("Variant created.");
      } else {
        const result = await adminApi.post(`/products/${productId}/generate-variants`, {
          packageIds: manualVariantPackageId ? [manualVariantPackageId] : [],
          attributes: attributesPayload,
        });
        showToast(result.data.message || "Variants created.");
      }
      setManualVariantOpen(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create variant."), "error");
    }
  };

  const handleUpdateVariant = async () => {
    if (!editingVariant) return;
    if (!editVariantAttributeIds.length) {
      showToast("Choose the attributes used by this variant.", "error");
      return;
    }
    const selectedValueIds = editVariantAttributeIds.map((attributeId) => editVariantSelections[attributeId]).filter(Boolean);
    if (selectedValueIds.length !== editVariantAttributeIds.length) {
      showToast("Select one value for every chosen attribute.", "error");
      return;
    }

    setIsUpdatingVariant(true);
    try {
      await adminApi.put(`/products/${productId}/variants/${editingVariant.id}`, {
        attributeValueIds: selectedValueIds,
        packageId: editVariantPackageId || null,
        sku: editVariantSku.trim() || null,
        title: editVariantTitle.trim() || null,
        moq: Math.max(1, editVariantMoq),
        weight: editVariantWeight ? Number(editVariantWeight) : null,
        length: editVariantLength ? Number(editVariantLength) : null,
        width: editVariantWidth ? Number(editVariantWidth) : null,
        height: editVariantHeight ? Number(editVariantHeight) : null,
        shippingClass: editVariantShippingClass.trim() || null,
        fragile: editVariantFragile,
        hazardous: editVariantHazardous,
        status: editVariantStatus,
      });

      const pricingUpdates: any[] = [];
      const countries = (variantCountries as CountryAvailability[]).filter(
        (c) => c.enabled && (productCountries as CountryAvailability[]).find((pc) => pc.id === c.id)?.enabled
      );

      countries.forEach((country) => {
        const draft = editVariantCountryPrices[country.id];
        const existing = (editingVariant.prices ?? []).find((p: any) => p.countryId === country.id);
        const existingInv = (editingVariant.inventories ?? []).find((i: any) => i.countryId === country.id);

        const currentPriceValue = existing?.sellingPrice !== undefined && existing?.sellingPrice !== null ? `${existing.sellingPrice}` : "";
        const currentDealerPriceValue = existing?.dealerPrice !== undefined && existing?.dealerPrice !== null ? `${existing.dealerPrice}` : "";
        const currentDoctorRetailerPriceValue = existing?.distributorPrice !== undefined && existing?.distributorPrice !== null ? `${existing.distributorPrice}` : "";
        const currentMrpValue = existing?.mrp !== undefined && existing?.mrp !== null ? `${existing.mrp}` : "";
        const currentStockValue = existingInv?.stock !== undefined && existingInv?.stock !== null ? `${existingInv.stock}` : "";

        const mrp = draft?.mrp ?? "";
        const sellingPrice = draft?.sellingPrice ?? "";
        const dealerPrice = draft?.dealerPrice ?? "";
        const doctorRetailerPrice = draft?.doctorRetailerPrice ?? "";
        const stock = draft?.stock ?? "";

        const priceChanged =
          mrp !== currentMrpValue ||
          sellingPrice !== currentPriceValue ||
          dealerPrice !== currentDealerPriceValue ||
          doctorRetailerPrice !== currentDoctorRetailerPriceValue;

        const stockChanged = stock !== currentStockValue;

        if (priceChanged || stockChanged) {
          pricingUpdates.push({
            variantId: editingVariant.id,
            countryId: country.id,
            ...(priceChanged
              ? {
                  price: {
                    mrp: mrp ? Number(mrp) : null,
                    sellingPrice: sellingPrice ? Number(sellingPrice) : null,
                    dealerPrice: dealerPrice ? Number(dealerPrice) : null,
                    distributorPrice: doctorRetailerPrice ? Number(doctorRetailerPrice) : null,
                  },
                }
              : {}),
            ...(stockChanged
              ? {
                  stock: stock !== "" ? Number(stock) : null,
                }
              : {}),
          });
        }
      });

      if (pricingUpdates.length > 0) {
        await adminApi.put(`/products/${productId}/variants/bulk`, { updates: pricingUpdates });
      }

      showToast("Variant updated.");
      closeEditVariantModal();
      refetch();
    } catch (error) {
      showToast("Failed to update variant.", "error");
    } finally {
      setIsUpdatingVariant(false);
    }
  };

  const handleGenerateVariants = async () => {
    const selectedAttributes = variantGenerationCatalog
      .filter((attribute) => generateAttributeIds.includes(attribute.id))
      .map((attribute) => {
        const selectedIds = generateSelectionMap[attribute.id] ?? [];
        if (!selectedIds.length) return null;
        return {
          attributeId: attribute.id,
          attributeValueIds: selectedIds,
        };
      })
      .filter(Boolean) as { attributeId: string; attributeValueIds: string[] }[];

    if (!selectedAttributes.length) {
      showToast("Select at least one attribute value to generate variants.", "error");
      return;
    }

    setGeneratingVariants(true);
    try {
      const payload: Record<string, unknown> = {
        packageIds: generatePackageIds,
        attributes: selectedAttributes,
      };
      const basePrice = Number(generateVariantBasePrice);
      if (Number.isFinite(basePrice) && basePrice > 0) {
        payload.basePrice = basePrice;
      }
      const result = await adminApi.post(`/products/${productId}/generate-variants`, payload);
      showToast(result.data.message || "Variants generated.");
      setGenerateVariantOpen(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to generate variants."), "error");
    } finally {
      setGeneratingVariants(false);
    }
  };

  const toggleGenerateValue = (attributeId: string, attributeValueId: string, checked: boolean, isShift: boolean = false) => {
    setGenerateSelectionMap((current) => {
      const next = current[attributeId] ?? [];
      let newSelection = [...next];
      const lastValId = lastSelectedValueMap[attributeId];

      if (isShift && lastValId) {
        const attr = (attributes as GlobalAttribute[]).find((a) => a.id === attributeId);
        if (attr) {
          const values = getAttributeValues(attr);
          const lastIndex = values.findIndex((v) => v.id === lastValId);
          const currentIndex = values.findIndex((v) => v.id === attributeValueId);
          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const rangeIds = values.slice(start, end + 1).map((v) => v.id);

            const lastIsChecked = next.includes(lastValId);
            if (lastIsChecked) {
              newSelection = Array.from(new Set([...next, ...rangeIds]));
            } else {
              newSelection = next.filter((id) => !rangeIds.includes(id));
            }
          } else {
            newSelection = checked ? [...next, attributeValueId] : next.filter((id) => id !== attributeValueId);
          }
        } else {
          newSelection = checked ? [...next, attributeValueId] : next.filter((id) => id !== attributeValueId);
        }
      } else {
        newSelection = checked ? [...next, attributeValueId] : next.filter((id) => id !== attributeValueId);
      }

      setLastSelectedValueMap((prev) => ({ ...prev, [attributeId]: attributeValueId }));

      return {
        ...current,
        [attributeId]: newSelection,
      };
    });
  };

  const setGenerateAttributeMode = (attributeId: string, mode: GenerateAttributeMode) => {
    setGenerateModeMap((current) => ({ ...current, [attributeId]: mode }));
    if (mode !== "specific") {
      setGenerateSelectionMap((current) => ({ ...current, [attributeId]: [] }));
    }
  };

  const toggleGeneratePackage = (packageId: string, checked: boolean) => {
    setGeneratePackageIds((current) => (checked ? [...current, packageId] : current.filter((id) => id !== packageId)));
  };

  const toggleManualVariantAttribute = (attributeId: string, checked: boolean) => {
    setManualVariantAttributeIds((current) => (checked ? [...current, attributeId] : current.filter((id) => id !== attributeId)));
    if (!checked) {
      setManualVariantSelectionMap((current) => {
        const next = { ...current };
        delete next[attributeId];
        return next;
      });
      setManualVariantModeMap((current) => {
        const next = { ...current };
        delete next[attributeId];
        return next;
      });
    }
  };

  const toggleEditVariantAttribute = (attributeId: string, checked: boolean) => {
    setEditVariantAttributeIds((current) => (checked ? [...current, attributeId] : current.filter((id) => id !== attributeId)));
    if (!checked) {
      setEditVariantSelections((current) => {
        const next = { ...current };
        delete next[attributeId];
        return next;
      });
    }
  };

  const addManualVariantAttribute = () => {
    if (!manualVariantAttributePicker || manualVariantAttributeIds.includes(manualVariantAttributePicker)) return;
    setManualVariantAttributeIds((current) => [...current, manualVariantAttributePicker]);
    setManualVariantModeMap((current) => ({ ...current, [manualVariantAttributePicker]: "single" }));
    setManualVariantAttributePicker("");
  };

  const removeManualVariantAttribute = (attributeId: string) => {
    setManualVariantAttributeIds((current) => current.filter((id) => id !== attributeId));
    setManualVariantSelectionMap((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
    setManualVariantModeMap((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
  };

  const setManualVariantMode = (attributeId: string, mode: ManualAttributeMode) => {
    setManualVariantModeMap((current) => ({ ...current, [attributeId]: mode }));
    if (mode === "all") {
      const attribute = attributeCatalog.find((item) => item.id === attributeId);
      setManualVariantSelectionMap((current) => ({
        ...current,
        [attributeId]: getAttributeValues(attribute).map((value) => value.id),
      }));
      return;
    }
    if (mode === "single") {
      setManualVariantSelectionMap((current) => ({
        ...current,
        [attributeId]: (current[attributeId] ?? []).slice(0, 1),
      }));
      return;
    }
    setManualVariantSelectionMap((current) => ({ ...current, [attributeId]: current[attributeId] ?? [] }));
  };

  const toggleManualVariantValue = (attributeId: string, valueId: string) => {
    const mode = manualVariantModeMap[attributeId] ?? "single";
    setManualVariantSelectionMap((current) => {
      const existing = current[attributeId] ?? [];
      if (mode === "single") {
        return { ...current, [attributeId]: existing[0] === valueId ? [] : [valueId] };
      }
      if (existing.includes(valueId)) {
        return { ...current, [attributeId]: existing.filter((id) => id !== valueId) };
      }
      return { ...current, [attributeId]: [...existing, valueId] };
    });
  };

  const selectAllManualVariantValues = (attributeId: string) => {
    const attribute = attributeCatalog.find((item) => item.id === attributeId);
    if (!attribute) return;
    setManualVariantSelectionMap((current) => ({
      ...current,
      [attributeId]: getAttributeValues(attribute).map((value) => value.id),
    }));
  };

  const clearManualVariantValues = (attributeId: string) => {
    setManualVariantSelectionMap((current) => ({
      ...current,
      [attributeId]: [],
    }));
  };

  const selectAllGenerateValues = (attributeId: string) => {
    const attribute = variantGenerationCatalog.find((item) => item.id === attributeId);
    if (!attribute) return;
    setGenerateSelectionMap((current) => ({
      ...current,
      [attributeId]: getAttributeValues(attribute).map((value) => value.id),
    }));
  };

  const clearGenerateValues = (attributeId: string) => {
    setGenerateSelectionMap((current) => ({
      ...current,
      [attributeId]: [],
    }));
  };

  const addEditVariantAttribute = () => {
    if (!editVariantAttributePicker || editVariantAttributeIds.includes(editVariantAttributePicker)) return;
    setEditVariantAttributeIds((current) => [...current, editVariantAttributePicker]);
    setEditVariantAttributePicker("");
  };

  const removeEditVariantAttribute = (attributeId: string) => {
    setEditVariantAttributeIds((current) => current.filter((id) => id !== attributeId));
    setEditVariantSelections((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
  };

  const addGenerateAttribute = () => {
    if (!generateAttributePicker) return;
    if (generateAttributeIds.includes(generateAttributePicker)) {
      setGenerateAttributePicker("");
      return;
    }
    setGenerateAttributeIds((current) => [...current, generateAttributePicker]);
    setGenerateModeMap((current) => ({ ...current, [generateAttributePicker]: "all" }));
    setGenerateAttributePicker("");
  };

  const removeGenerateAttribute = (attributeId: string) => {
    setGenerateAttributeIds((current) => current.filter((id) => id !== attributeId));
    setGenerateSelectionMap((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
    setGenerateModeMap((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
    setGenerateValuePickerMap((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
  };

  const addGenerateSpecificValue = (attributeId: string, attributeValueId: string) => {
    if (!attributeValueId) return;
    setGenerateSelectionMap((current) => {
      const next = current[attributeId] ?? [];
      if (next.includes(attributeValueId)) return current;
      return { ...current, [attributeId]: [...next, attributeValueId] };
    });
  };

  const removeGenerateSpecificValue = (attributeId: string, attributeValueId: string) => {
    setGenerateSelectionMap((current) => ({
      ...current,
      [attributeId]: (current[attributeId] ?? []).filter((id) => id !== attributeValueId),
    }));
  };

  const setGenerateValuePicker = (attributeId: string, valueId: string) => {
    setGenerateValuePickerMap((current) => ({ ...current, [attributeId]: valueId }));
  };

  const renderBulkFlatVariantTable = () => (
    <div className="overflow-x-auto rounded-lg border border-[#E6E6E6]">
      <table className="min-w-full border-collapse text-left text-[13px]">
        <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
          <tr>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Variant</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Package</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">SKU</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">MRP</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">Selling</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">Dealer</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">Doctor / Retailer</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">Stock</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">Status</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3 align-top">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredVariantRows.map((variant) => {
            const draft = getBulkVariantDraft(variant);
            return (
              <tr key={variant.id} className="border-b border-[#F0F0F0] last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#1A1A1A]">{variant.title}</div>
                  {bulkRowErrors[variant.id] && <div className="mt-1 text-[11.5px] text-red-600">{bulkRowErrors[variant.id]}</div>}
                </td>
                <td className="px-4 py-3 text-[#555]">{variant.package?.title ?? "Default"}</td>
                <td className="px-4 py-3 text-[#555]">{variant.sku || "No SKU"}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={draft.mrp}
                    onChange={(e) => updateBulkDraft(variant.id, { mrp: e.target.value.replace(/[^0-9.]/g, "") })}
                    className="w-24 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={draft.price}
                    onChange={(e) => updateBulkDraft(variant.id, { price: e.target.value.replace(/[^0-9.]/g, "") })}
                    className="w-24 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={draft.dealerPrice}
                    onChange={(e) => updateBulkDraft(variant.id, { dealerPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                    className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={draft.doctorRetailerPrice}
                    onChange={(e) => updateBulkDraft(variant.id, { doctorRetailerPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                    className="w-32 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={draft.stock}
                    onChange={(e) => updateBulkDraft(variant.id, { stock: e.target.value.replace(/\D/g, "") })}
                    className="w-24 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3"><StatusBadge status={variant.status} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => openEditVariantModal(variant)} className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => openVariantCountriesModal(variant)} className="ml-2 rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]" title="Country availability">
                    <Globe2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (isLoading) {
    const loadingContent = (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#E6E6E6]" />)}
      </div>
    );
    return <AdminLayout title="Edit Product">{loadingContent}</AdminLayout>;
  }

  if (!product) {
    const emptyContent = <p className="text-[#9A9A9A]">Product not found.</p>;
    return <AdminLayout title="Product not found">{emptyContent}</AdminLayout>;
  }

  const content = (
    <>
      {/* ── Tab Navigation ── */}
      <div className="mb-4 flex w-full overflow-x-auto gap-1 rounded-xl border border-[#E6E6E6] bg-white p-1.5 shadow-2xs scrollbar-thin">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-all flex-shrink-0",
              activeTab === tab.id
                ? "bg-[#E31E24] text-white shadow-xs"
                : "text-[#6B6B6B] hover:bg-[#F4F4F4] hover:text-[#1A1A1A]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Sticky Action Bar & Status Header ── */}
      <div className="sticky -top-6 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E6E6] bg-white/95 px-5 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.05)] backdrop-blur relative transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-[#1A1A1A] truncate">
                {visibleTabs.find((t) => t.id === activeTab)?.label}
              </h2>
              {product?.title ? (
                <span className="text-[12.5px] text-[#8B8B8B] font-medium hidden sm:inline truncate max-w-[280px]">
                  — {product.title}
                </span>
              ) : null}
            </div>
            {!isReadOnly ? (
              <p className="mt-0.5 text-[11.5px] text-[#8B8B8B]">
                Changes are not applied until you save.
              </p>
            ) : (
              <p className="mt-0.5 text-[11.5px] font-medium text-amber-600">
                Read-only mode. You do not have permissions to edit product catalog.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {form.dirty && !isReadOnly && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Unsaved Changes
            </span>
          )}

          {!isReadOnly && (activeTab === 0 || activeTab === 1 || activeTab === 4 || activeTab === 10 || activeTab === 11) ? (
            <LoadingButton
              type="button"
              onClick={() => form.handleSubmit()}
              loading={form.isSubmitting || updateProduct.isPending}
              loadingText="Saving…"
              className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(227,30,36,0.28)] hover:bg-[#B5151B] transition-all active:scale-[0.98]"
            >
              <Save size={14} />
              Save Changes
            </LoadingButton>
          ) : null}

          <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />

          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors shadow-2xs"
            title="Back to products list"
          >
            <ChevronLeft size={16} />
            Back
          </button>
        </div>
      </div>

      <fieldset disabled={isReadOnly} className="disabled:opacity-100 flex-1 min-w-0">
        <div className="rounded-xl border border-[#E6E6E6] bg-white">
        {activeTab === 0 && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AdminInput label="Product Title" {...form.getFieldProps("title")} error={form.errors.title as string} />
              </div>
              <div className="sm:col-span-2">
                <AdminInput label="Slug" {...form.getFieldProps("slug")} placeholder="Auto-generated from title" />
              </div>
              <AdminSelect label="Category" options={catOptions} {...form.getFieldProps("categoryId")} error={form.errors.categoryId as string} required />
              <div>
                <AdminMultiSearchableSelect
                  label="Active Country"
                  values={form.values.activeCountryIds ?? []}
                  onValuesChange={(values) => form.setFieldValue("activeCountryIds", values)}
                  options={countryRows.map((c: any) => ({
                    value: c.id,
                    label: `${c.name} (${c.code || c.countryCode || ""})`.trim(),
                  }))}
                  placeholder="Select countries"
                  allowSelectAll
                  selectAllLabel="All countries"
                  error={form.errors.activeCountryIds as string}
                />
              </div>
              <AdminSelect
                label="Status"
                options={[{ value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }]}
                {...form.getFieldProps("status")}
                required
              />
              <AdminInput
                id="product-code-input"
                label="Product Code"
                {...form.getFieldProps("productCode")}
                className={cn(
                  highlightProductCode && "!border-[#E31E24] !ring-2 !ring-[#E31E24]/25 !bg-[#FFF8F8] font-semibold transition-all duration-300"
                )}
              />
              <AdminInput label="SKU" {...form.getFieldProps("sku")} />
              <AdminInput label="Brand" {...form.getFieldProps("brand")} />
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.values.isFeatured} onChange={(e) => form.setFieldValue("isFeatured", e.target.checked)} className="rounded" />
                  <span className="text-[13.5px]">Featured Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.values.hasVariants} onChange={(e) => form.setFieldValue("hasVariants", e.target.checked)} className="rounded" />
                  <span className="text-[13.5px]">Has Variants</span>
                </label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
              <div>
                <label className="mb-1 block text-[13.5px] font-medium text-[#1A1A1A]">Information Image</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setInfoImageSelectorOpen(true)}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                  >
                    <ImageIcon size={14} />
                    <span>Browse Media Library</span>
                  </button>
                  {form.values.informationImage && (
                    <div className="relative h-12 w-12">
                      <img src={form.values.informationImage} alt="Information preview" className="h-full w-full rounded-md object-cover" />
                      <button
                        type="button"
                        onClick={() => form.setFieldValue("informationImage", "")}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white hover:bg-[#B5151B] text-xs"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-[#6B6B6B]">Upload a small icon/image for information section.</p>
              </div>

              <AdminTextarea
                label="Information Description (max 200)"
                rows={3}
                maxLength={200}
                placeholder="Brief description related to the information image..."
                {...form.getFieldProps("informationDescription")}
              />
            </div>
            <AdminTextarea label="Short Description (max 300)" rows={2} maxLength={300} {...form.getFieldProps("shortDescription")} />
            <AdminRichTextEditor
              label="Full Description"
              value={form.values.description}
              placeholder="Enter detailed clinical product description..."
              onChange={(value) => form.setFieldValue("description", value)}
              className="min-h-[220px]"
            />
          </div>
        )}

        {activeTab === 1 && (
          <div className="p-6 space-y-8">
            <AdminSectionTable
              title="Features"
              description="Add title/description pairs to display in the product Features tab on the frontend."
              addButtonLabel="Add feature"
              onAdd={() => openFeatureModal()}
              columns={featureCols}
              data={(form.values.highlights || []).map((item: any, index: number) => ({ ...item, index }))}
              rowKey="index"
              onRowClick={(row) => openFeatureModal(row.index)}
              rowTooltip="Click row or edit icon to edit feature"
              emptyMessage="No features added yet."
            />

            <AdminSectionTable
              title="Key Specifications"
              description='Add spec rows that will appear in the "Key Specifications" tab on the product page.'
              addButtonLabel="Add spec"
              onAdd={() => openSpecModal()}
              columns={specCols}
              data={(form.values.technicalSpecs || []).map((item: any, index: number) => ({ ...item, index }))}
              rowKey="index"
              onRowClick={(row) => openSpecModal(row.index)}
              rowTooltip="Click row or edit icon to edit specification"
              emptyMessage="No key specifications added yet."
            />

            {/* Specification Diagrams (Multiple Upload) */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">Specification Diagrams & Blueprints</h3>
                    <span className="rounded-full bg-red-50 text-[#E31E24] px-2 py-0.5 text-[11px] font-bold">
                      {form.values.specImages?.length || 0} Images
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
                    Upload technical drawings, slot blueprints, or torque/angulation charts. These display in the interactive carousel on the product page.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSpecDiagramSelectorOpen(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                  >
                    <ImageIcon size={14} />
                    <span>Browse Media Library</span>
                  </button>
                </div>
              </div>

              {form.values.specImages && form.values.specImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {form.values.specImages.map((diagram: { url: string; title: string }, index: number) => (
                    <div
                      key={`${diagram.url}-${index}`}
                      className="group relative flex flex-col rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] overflow-hidden hover:border-[#D1D5DB] transition-all"
                    >
                      <div className="relative flex h-36 w-full items-center justify-center bg-white p-2.5 border-b border-[#E6E6E6]">
                        <img
                          src={diagram.url}
                          alt={diagram.title || `Diagram ${index + 1}`}
                          className="h-full w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteSpecDiagram(index)}
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 shadow-xs text-xs font-bold transition-transform hover:scale-110 cursor-pointer"
                          title="Delete diagram"
                        >
                          ✕
                        </button>
                        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-xs">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <input
                          type="text"
                          value={diagram.title || ""}
                          onChange={(e) => handleUpdateSpecDiagramTitle(index, e.target.value)}
                          placeholder="Diagram title / caption..."
                          className="w-full rounded border border-[#E0E0E0] bg-white px-2.5 py-1 text-[12px] text-[#1A1A1A] placeholder:text-[#9A9A9A] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => setSpecDiagramSelectorOpen(true)}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#E5E7EB] bg-[#FAFAFA] py-8 px-4 text-center cursor-pointer hover:bg-red-50/20 hover:border-[#E31E24]/50 transition-colors"
                >
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-[#E31E24]">
                    <ImageIcon size={20} />
                  </div>
                  <p className="text-[13.5px] font-semibold text-[#1A1A1A]">No Specification Diagrams Attached</p>
                  <p className="mt-1 text-[12px] text-[#6B6B6B] max-w-sm">
                    Click <strong>Browse Media Library</strong> to select or upload technical diagrams and charts.
                  </p>
                </div>
              )}
            </div>

            <AdminSectionTable
              title="Direction To Use"
              description='Add clinical guidelines and instructions to display in the "Direction To Use" tab on the product page.'
              addButtonLabel="Add instruction"
              onAdd={() => openDirectionModal()}
              columns={directionCols}
              data={(form.values.primaryFeatures || []).map((item: any, index: number) => ({ ...item, index }))}
              rowKey="index"
              onRowClick={(row) => openDirectionModal(row.index)}
              rowTooltip="Click row or edit icon to edit clinical guideline"
              emptyMessage="No clinical guidelines added yet."
            />

            <AdminSectionTable
              title="Packages"
              description="Packages are separate commercial offerings of the same product."
              addButtonLabel="Add Package"
              onAdd={() => openPackageModal()}
              columns={packageCols}
              data={packageRows}
              rowKey="id"
              onRowClick={(row) => openPackageModal(row)}
              rowTooltip="Click row or edit icon to edit package"
              emptyMessage="No packages added yet."
            />

            {/* Synced Info Notice */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-[13px] text-blue-900">
              <div className="flex items-center gap-3">
                <Info className="text-blue-600 shrink-0" size={18} />
                <div>
                  <span className="font-semibold">Product Code Sync:</span> Product Code (
                  <button
                    type="button"
                    onClick={goToBasicInfoAndFocusProductCode}
                    className="mx-1 rounded bg-blue-100 px-2 py-0.5 font-mono text-[12px] font-bold text-blue-800 hover:bg-blue-200 hover:text-blue-900 transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    title="Click to edit Product Code in Basic Info tab"
                  >
                    {form.values.productCode || "Not set in Basic Info"}
                    <Pencil size={11} className="text-blue-600" />
                  </button>
                  ) is automatically synchronized from{" "}
                  <button
                    type="button"
                    onClick={goToBasicInfoAndFocusProductCode}
                    className="font-bold underline decoration-blue-400 hover:text-blue-950 cursor-pointer"
                  >
                    Basic Info
                  </button>{" "}
                  and rendered at the top of Additional Info on the product page.
                </div>
              </div>
              <button
                type="button"
                onClick={goToBasicInfoAndFocusProductCode}
                className="shrink-0 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-900 shadow-2xs transition-colors"
              >
                Go to Basic Info →
              </button>
            </div>

            <AdminSectionTable
              title="Additional Information"
              description="Manage key-value pairs displayed under the Additional Info tab on the product page."
              addButtonLabel="Add Info Row"
              onAdd={() => openAdditionalInfoModal()}
              columns={additionalInfoCols}
              data={[
                {
                  isProductCode: true,
                  label: "Product Code",
                  value: form.values.productCode || "Not set in Basic Info",
                  index: -1,
                },
                ...(form.values.additionalInfo || []).map((item: any, index: number) => ({
                  isProductCode: false,
                  ...item,
                  index,
                })),
              ]}
              rowKey="index"
              onRowClick={(row) => {
                if (row.isProductCode) {
                  goToBasicInfoAndFocusProductCode();
                } else {
                  openAdditionalInfoModal(row.index);
                }
              }}
              rowTooltip={(row) => (row.isProductCode ? "Click to edit Product Code in Basic Info tab" : "Click row or edit icon to edit additional info")}
              emptyMessage="No additional information rows added yet."
            />

            <AdminSectionTable
              title="Warranty"
              description="Add warranty text lines for the product details accordion."
              addButtonLabel="Add warranty line"
              onAdd={() => openWarrantyModal()}
              columns={warrantyCols}
              data={(form.values.warranty || []).map((line: string, index: number) => ({ line, index }))}
              rowKey="index"
              onRowClick={(row) => openWarrantyModal(row.index)}
              rowTooltip="Click row or edit icon to edit warranty clause"
              emptyMessage="No warranty lines added yet."
            />
          </div>
        )}

        {activeTab === 2 && (() => {
          const imageMedia = (product.media ?? []).filter(
            (m: any) => m.type !== "PDF" && !m.mimeType?.includes("pdf") && !m.url?.toLowerCase().endsWith(".pdf")
          );
          const pdfMedia = (product.media ?? []).filter(
            (m: any) => m.type === "PDF" || m.mimeType?.includes("pdf") || m.url?.toLowerCase().endsWith(".pdf")
          );
          const catalogueDoc = pdfMedia.length > 0 ? pdfMedia[pdfMedia.length - 1] : null;

          return (
            <div className="p-6">
              {/* 1. Product Brochure / Catalogue (PDF) Section */}
              <div className="mb-8 rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-[#E31E24] border border-red-100">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="text-[14.5px] font-semibold text-[#1A1A1A]">Product Brochure / Catalogue (PDF)</h4>
                      <p className="text-[12.5px] text-[#6B7280]">
                        Upload a single PDF brochure or technical datasheet for this product. Customers can download it directly from the storefront.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPdfMediaSelectorOpen(true)}
                      disabled={uploadingPdf}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs disabled:opacity-60"
                    >
                      <FileText size={13} />
                      <span>Browse Media Library</span>
                    </button>
                  </div>
                </div>

                {catalogueDoc ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3.5 transition hover:border-[#D1D5DB]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white border border-[#E5E7EB] text-[#E31E24] shadow-xs">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[#1F2937]" title={catalogueDoc.originalName || catalogueDoc.filename || "Catalogue Document"}>
                            {catalogueDoc.originalName || catalogueDoc.filename || "Catalogue Document.pdf"}
                          </p>
                          <p className="text-[11.5px] text-[#6B7280]">
                            {catalogueDoc.size ? `${(catalogueDoc.size / (1024 * 1024)).toFixed(2)} MB • ` : ""}PDF Document
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPdfMediaSelectorOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F3F4F6] transition shadow-xs cursor-pointer"
                        >
                          <FileText size={13} className="text-[#E31E24]" />
                          <span>Choose Another</span>
                        </button>
                        <a
                          href={catalogueDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition shadow-xs"
                        >
                          <Eye size={13} />
                          <span>View PDF</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleDeletePdfCatalogue}
                          disabled={uploadingPdf}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#FCA5A5] bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 transition shadow-xs disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setPdfMediaSelectorOpen(true)}
                    onDragOver={handlePdfDragOver}
                    onDragLeave={handlePdfDragLeave}
                    onDrop={handlePdfDrop}
                    className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition ${
                      isDragOverPdf
                        ? "border-[#E31E24] bg-red-50/50"
                        : "border-[#E5E7EB] bg-[#FAFAFA] hover:border-[#D1D5DB] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    <FileText size={28} className={isDragOverPdf ? "text-[#E31E24] mb-2" : "text-[#9CA3AF] mb-2"} />
                    <p className="text-[13px] font-medium text-[#374151]">
                      Drag &amp; drop a PDF catalogue here, or <span className="font-semibold text-[#E31E24] underline">browse Media Library</span>
                    </p>
                    <p className="mt-1 text-[11.5px] text-[#9CA3AF]">
                      Select from existing files or upload a new PDF brochure.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Product Images Section */}
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Images</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">
                      Upload and manage product photos for the gallery. First image acts as cover photo.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedMediaIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteMedia}
                        className="flex items-center gap-1.5 rounded-md border border-[#F2C9C9] bg-white px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors shadow-2xs"
                      >
                        <Trash2 size={14} />
                        <span>Delete Selected ({selectedMediaIds.size})</span>
                      </button>
                    )}

                    {imageMedia.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAllMedia(imageMedia.map((m: any) => m.id).filter(Boolean))}
                        className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors shadow-2xs"
                      >
                        {selectedMediaIds.size === imageMedia.length ? (
                          <>
                            <CheckSquare size={14} className="text-[#E31E24]" />
                            <span>Deselect All</span>
                          </>
                        ) : (
                          <>
                            <Square size={14} className="text-[#6B6B6B]" />
                            <span>Select All ({imageMedia.length})</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setImageMediaSelectorOpen(true)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                    >
                      <ImageIcon size={14} />
                      <span>Browse Media Library</span>
                    </button>
                  </div>
                </div>

                {/* Media Library Dropzone */}
                <div
                  onClick={() => setImageMediaSelectorOpen(true)}
                  onDragOver={handleMediaDragOver}
                  onDragLeave={handleMediaDragLeave}
                  onDrop={handleMediaDrop}
                  title="Click to browse Media Library or drag and drop files"
                  className={`group mb-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer select-none ${
                    uploadingMedia
                      ? "border-[#E31E24] bg-red-50/30 cursor-not-allowed opacity-75"
                      : isDragOverMedia
                      ? "border-[#E31E24] bg-red-50/50 scale-[1.005]"
                      : "border-[#E6E6E6] bg-[#FAFAFA] hover:border-[#E31E24] hover:bg-[#FFF8F8] hover:shadow-xs"
                  }`}
                >
                  {uploadingMedia ? (
                    <div className="flex flex-col items-center py-1">
                      <Loader2 size={24} className="animate-spin text-[#E31E24] mb-2" />
                      <p className="text-[13.5px] font-semibold text-[#1A1A1A]">
                        Uploading {uploadingMediaCount > 0 ? `${uploadingMediaCount} image(s)...` : "images..."}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#6B6B6B]">Please wait while files are being uploaded to the server.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs border border-[#E6E6E6] group-hover:border-[#E31E24]/40 group-hover:bg-[#FFF5F5] transition-colors">
                        <FolderUp size={20} className={isDragOverMedia ? "text-[#E31E24]" : "text-[#6B6B6B] group-hover:text-[#E31E24] transition-colors"} />
                      </div>
                      <p className="text-[13.5px] font-medium text-[#1A1A1A]">
                        Drag &amp; drop product images here, or{" "}
                        <span className="font-semibold text-[#E31E24] underline group-hover:text-[#B5151B]">
                          browse Media Library
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] text-[#9A9A9A]">
                        Supports JPG, PNG, WEBP, GIF, SVG. Click anywhere to select or upload via Media Library.
                      </p>
                    </>
                  )}
                </div>

                {/* Product Media Grid */}
                {imageMedia.length > 0 || uploadingMedia ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {imageMedia.map((media: { id?: string; url: string; altText?: string | null }, index: number) => {
                      const isSelected = media.id ? selectedMediaIds.has(media.id) : false;
                      const isCover = index === 0;

                      return (
                        <div
                          key={media.id ?? media.url}
                          className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all ${
                            isSelected
                              ? "border-[#E31E24] ring-2 ring-[#E31E24]/20 shadow-md"
                              : "border-[#E6E6E6] bg-white hover:border-[#D1D5DB] hover:shadow-sm"
                          }`}
                        >
                          {/* Selection Checkbox */}
                          {media.id && (
                            <button
                              type="button"
                              onClick={(e: any) => {
                                e.stopPropagation();
                                const isShift = e.shiftKey;
                                const isChecked = !isSelected;
                                
                                if (isShift && lastSelectedMediaIndexRef.current !== null) {
                                  const start = Math.min(lastSelectedMediaIndexRef.current, index);
                                  const end = Math.max(lastSelectedMediaIndexRef.current, index);
                                  const rangeMedia = imageMedia.slice(start, end + 1).filter((m: any) => m.id);
                                  
                                  setSelectedMediaIds((prev) => {
                                    const newSet = new Set(prev);
                                    if (isChecked) {
                                      rangeMedia.forEach((m: any) => newSet.add(m.id!));
                                    } else {
                                      rangeMedia.forEach((m: any) => newSet.delete(m.id!));
                                    }
                                    return newSet;
                                  });
                                } else {
                                  handleToggleSelectMedia(media.id!);
                                }
                                lastSelectedMediaIndexRef.current = index;
                              }}
                              className={`absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
                                isSelected
                                  ? "border-[#E31E24] bg-[#E31E24] text-white shadow-sm"
                                  : "border-[#D1D5DB] bg-white/90 text-transparent opacity-90 group-hover:opacity-100 hover:border-[#E31E24]"
                              }`}
                              title={isSelected ? "Deselect image" : "Select image"}
                            >
                              <Check size={14} className={isSelected ? "opacity-100" : "opacity-0"} />
                            </button>
                          )}

                          {/* Primary / Cover Badge */}
                          {isCover && (
                            <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-[#1A1A1A]/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm shadow-sm">
                              Cover
                            </span>
                          )}

                          {/* Image Thumbnail Container */}
                          <div
                            onClick={() => setPreviewMediaIndex(index)}
                            className="relative aspect-square w-full cursor-pointer overflow-hidden bg-[#F7F7F7]"
                          >
                            <img
                              src={media.url}
                              alt={media.altText ?? product.title}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {/* Hover Overlay with Preview Icon */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-[#1A1A1A] shadow-md backdrop-blur-sm">
                                <ZoomIn size={14} /> View
                              </span>
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="flex items-center justify-between border-t border-[#E6E6E6] bg-white px-3 py-2">
                            <span className="truncate text-[11.5px] font-medium text-[#6B6B6B]" title={media.altText ?? `Image ${index + 1}`}>
                              {index + 1}. {media.altText || `Image ${index + 1}`}
                            </span>
                            <div className="flex items-center gap-1">
                              {!isCover && media.id && (
                                <button
                                  type="button"
                                  disabled={settingCoverMediaId !== null}
                                  onClick={() => media.id && handleSetCoverMedia(media.id)}
                                  className="rounded p-1 text-[#6B6B6B] hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer"
                                  title="Set as cover photo"
                                  aria-label="Set as cover photo"
                                >
                                  {settingCoverMediaId === media.id ? (
                                    <Loader2 size={13} className="animate-spin text-amber-600" />
                                  ) : (
                                    <Star size={13} />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPreviewMediaIndex(index)}
                                className="rounded p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A] cursor-pointer"
                                title="Inspect image"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={!media.id}
                                onClick={() => media.id && setDeletingMedia(media.id)}
                                className="rounded p-1 text-[#6B6B6B] hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                                title={media.id ? "Delete image" : "Media ID missing"}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render Skeleton Cards for images currently being uploaded */}
                    {uploadingMedia &&
                      Array.from({ length: Math.max(1, uploadingMediaCount) }).map((_, idx) => (
                        <div
                          key={`media-skeleton-${idx}`}
                          className="relative flex flex-col overflow-hidden rounded-xl border border-[#E6E6E6] bg-white shadow-xs"
                        >
                          <div className="relative aspect-square w-full bg-[#F0F0F0] animate-pulse flex flex-col items-center justify-center p-4">
                            <Loader2 size={24} className="animate-spin text-[#E31E24] mb-2" />
                            <span className="text-[12px] font-medium text-[#6B6B6B]">Uploading...</span>
                          </div>

                          <div className="flex items-center justify-between border-t border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2">
                            <div className="h-3.5 w-20 rounded bg-[#E0E0E0] animate-pulse" />
                            <div className="h-3.5 w-4 rounded bg-[#E0E0E0] animate-pulse" />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#E6E6E6] p-8 text-center">
                    <ImageIcon size={32} className="mx-auto mb-2 text-[#D1D5DB]" />
                    <p className="text-[13.5px] font-medium text-[#6B6B6B]">No images uploaded yet.</p>
                    <p className="mt-0.5 text-[12px] text-[#9A9A9A]">Upload images using the button or drag and drop area above.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 4 && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Variants</h3>
              <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Variants are created from package + selected attribute values.</p>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                  <input
                    placeholder="Search variants..."
                    value={variantTabSearchQuery}
                    onChange={(e) => setVariantTabSearchQuery(e.target.value)}
                    className="w-[220px] rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                  />
                </div>
                <select
                  value={variantTabStatusFilter}
                  onChange={(e) => setVariantTabStatusFilter(e.target.value)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="DRAFT">Draft</option>
                </select>
                <select
                  value={variantTabStockFilter}
                  onChange={(e) => setVariantTabStockFilter(e.target.value)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
                >
                  <option value="">All Stock</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
                <select
                  value={variantTabWarehouseFilter}
                  onChange={(e) => setVariantTabWarehouseFilter(e.target.value)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
                >
                  <option value="">All Warehouses</option>
                  {(warehouses.data ?? warehouses).map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.state ? `(${w.state})` : ''} {w.country?.code ? `[${w.country.code}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleBulkDeleteVariants}
                  disabled={!selectedVariantIds.length || bulkSaving}
                  className="flex items-center gap-1.5 rounded-md border border-[#F2C9C9] bg-white px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 size={14} /> Delete Selected ({selectedVariantIds.length})
                </button>

                {bulkEditMode && (
                  <>
                    <button
                      type="button"
                      onClick={exportSelectedCountryVariantPrices}
                      disabled={!bulkCountryIds.length || variantPriceExporting}
                      className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] disabled:opacity-40"
                    >
                      <Download size={14} />
                      {variantPriceExporting ? "Exporting..." : "Export Prices"}
                    </button>
                    <button
                      type="button"
                      onClick={() => variantPriceImportInputRef.current?.click()}
                      disabled={!bulkCountryIds.length || variantPriceImporting}
                      className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] disabled:opacity-40"
                    >
                      <Upload size={14} />
                      {variantPriceImporting ? "Importing..." : "Import Prices"}
                    </button>
                    <input
                      ref={variantPriceImportInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={importSelectedCountryVariantPrices}
                    />
                  </>
                )}
                {bulkEditMode && (
                  <button
                    type="button"
                    onClick={saveBulkVariantEdits}
                    disabled={bulkSaving}
                    className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#B5151B] disabled:opacity-50"
                  >
                    <Save size={14} />
                    {bulkSaving ? "Saving..." : "Save All"}
                  </button>
                )}

                <button
                  onClick={openGenerateVariantModal}
                  disabled={generatingVariants || !product.hasVariants}
                  className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40"
                >
                  <Zap size={14} />
                  Generate Variants
                </button>
                <button
                  onClick={openManualVariantModal}
                  disabled={!product.hasVariants}
                  className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] disabled:opacity-40"
                >
                  <Plus size={14} />
                  Create Manual Variant
                </button>
                <button
                  onClick={() => setBulkImportOpen(true)}
                  disabled={!product.hasVariants}
                  className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#E31E24] to-[#FF6B6B] px-4 py-2 text-[13px] font-semibold text-white hover:from-[#B5151B] hover:to-[#E31E24] disabled:opacity-40 shadow-sm transition-all"
                  id="bulk-import-trigger"
                >
                  <Upload size={14} />
                  Bulk Import
                </button>
              </div>
            </div>
            {!product.hasVariants && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-[13px] text-yellow-700">
                Enable &quot;Has Variants&quot; in Basic Info first.
              </div>
            )}

            {/* Custom Table Controls row directly above the table */}
            <div className="mb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 rounded-lg border border-[#E6E6E6] bg-white p-3.5 shadow-sm min-h-[58px]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-semibold text-[#1A1A1A]">List</span>
                <span className="inline-flex items-center justify-center rounded-full bg-[#FEF2F2] border border-red-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-red-600 min-w-[84px]">
                  {selectedVariantIds.length} selected
                </span>
                <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
                  Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
                </span>
                <div className="flex items-center gap-1">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-md border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] text-[#1A1A1A] outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  {!bulkEditMode && (
                    <select
                      value={variantTableDisplayCountryId}
                      onChange={(e) => setVariantTableDisplayCountryId(e.target.value)}
                      className="ml-2 rounded-md border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] text-[#1A1A1A] outline-none"
                    >
                      <option value="">Default Country Price</option>
                      {(productCountries as CountryAvailability[]).map((c) => (
                        <option key={c.id} value={c.id}>{c.code} Price</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-[12px] text-[#1A1A1A] font-semibold">{currentPage}/{totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>

                <div className="flex items-center gap-2 border-l border-[#E6E6E6] pl-3 ml-2">
                  <select
                    value={bulkActionType === "Bulk Action" ? "" : bulkActionType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBulkActionType(val || "Bulk Action");
                      if (val === "Price update") {
                        if (selectedVariantIds.length === 0) {
                          showToast("Please select at least one variant first.", "error");
                          setTimeout(() => setBulkActionType("Bulk Action"), 0);
                          return;
                        }
                        setModalCountryIds(["ALL_COUNTRIES"]);
                        setBulkPriceUpdateModalContext("variants");
                        setTimeout(() => setBulkActionType("Bulk Action"), 0);
                      }
                    }}
                    className="h-8 rounded-md border border-[#D1D5DB] bg-white px-3 text-[12.5px] text-[#1F2937] outline-none focus:border-[#E31E24] cursor-pointer"
                  >
                    <option value="">Choose Bulk Action</option>
                    <option value="Mark active">Mark active</option>
                    <option value="Mark inactive">Mark inactive</option>
                    <option value="Price update">Price update</option>
                    <option value="Country availability update">Country availability update</option>
                    <option value="Stock update filtered">Stock update filtered</option>
                    <option value="Delete selected">Delete selected</option>
                  </select>

                  {bulkActionType === "Country availability update" && (
                    <div className="w-[180px]">
                      <AdminMultiSelect
                        options={(productCountries as CountryAvailability[]).filter(c => c.status === "ACTIVE").map(c => ({ value: c.id, label: c.name }))}
                        value={bulkCountryAvailabilityCountryIds}
                        onChange={setBulkCountryAvailabilityCountryIds}
                        placeholder="Select active countries..."
                        className="h-[32px] py-0 px-3 text-[12.5px]"
                      />
                    </div>
                  )}

                  {bulkActionType !== "Country availability update" && bulkActionType !== "Bulk Action" && bulkActionType !== "Mark active" && bulkActionType !== "Mark inactive" && bulkActionType !== "Delete selected" && bulkActionType !== "Price update" && (
                    <input
                      type="text"
                      placeholder={
                        bulkActionType === "Stock update filtered"
                          ? "Stock quantity"
                          : "Value"
                      }
                      value={bulkActionValue}
                      onChange={(e) => setBulkActionValue(e.target.value.replace(/\D/g, ""))}
                      className="h-8 w-[120px] rounded-md border border-[#E6E6E6] bg-white px-3 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                    />
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      if (bulkSaving) return;
                      if (bulkActionType === "Bulk Action" || bulkActionType === "") {
                        showToast("Please select a bulk action.", "error");
                        return;
                      }
                      
                      if (bulkActionType === "Country availability update") {
                        if (bulkCountryAvailabilityCountryIds.length === 0) {
                           showToast("Please select at least one country to enable.", "error");
                           return;
                        }
                        setBulkSaving(true);
                        try {
                          let hasError = false;
                          for (const vId of selectedVariantIds) {
                            try {
                              const currentAvailability = await adminApi
                                .get(`/products/${productId}/variants/${vId}/countries`)
                                .then((r) => r.data.data as CountryAvailability[]);

                              const updatedItems = currentAvailability.map((country) => {
                                return { 
                                  countryId: country.id, 
                                  enabled: bulkCountryAvailabilityCountryIds.includes(country.id) 
                                };
                              });

                              await adminApi.put(`/products/${productId}/variants/${vId}/countries`, {
                                items: updatedItems,
                              });
                            } catch (err) {
                              hasError = true;
                              console.error(`Failed to update country availability for variant ${vId}`, err);
                            }
                          }

                          if (hasError) {
                            showToast("Failed to update country availability for some variants.", "error");
                          } else {
                            showToast("Country availability updated for selected variants.");
                          }
                          
                          setBulkActionType("Bulk Action");
                          setBulkCountryAvailabilityCountryIds([]);
                          setSelectedVariantIds([]);
                          await refetch();
                        } catch (e) {
                          showToast("Failed to update country availability.", "error");
                        } finally {
                          setBulkSaving(false);
                        }
                        return;
                      }

                      setBulkSaving(true);
                      try {
                        let updates: any[] = [];
                        if (bulkActionType === "Mark active") {
                          updates = selectedVariantIds.map((id) => ({ variantId: id, action: "active" }));
                        } else if (bulkActionType === "Mark inactive") {
                          updates = selectedVariantIds.map((id) => ({ variantId: id, action: "inactive" }));
                        } else if (bulkActionType === "Stock update filtered") {
                          if (!bulkActionValue.trim() || isNaN(parseInt(bulkActionValue, 10))) {
                            showToast("Please enter a valid stock quantity.", "error");
                            setBulkSaving(false);
                            return;
                          }
                          updates = selectedVariantIds.map((id) => ({
                            variantId: id,
                            stock: parseInt(bulkActionValue, 10),
                          }));
                        } else if (bulkActionType === "Delete selected") {
                          setDeletingBulkVariantsModal(true);
                          setBulkSaving(false);
                          return;
                        }

                        const response = await adminApi.put(`/products/${productId}/variants/bulk`, { updates });
                        const summary = response.data.data.summary;
                        showToast(summary.failed ? `Updated ${summary.succeeded}; ${summary.failed} failed.` : `Successfully updated ${summary.succeeded} variant(s).`, summary.failed ? "error" : "success");
                        setSelectedVariantIds([]);
                        setBulkActionValue("");
                        setBulkActionType("Bulk Action");
                        await refetch();
                      } catch (error) {
                        showToast(getAdminErrorMessage(error, "Bulk update failed."), "error");
                      } finally {
                        setBulkSaving(false);
                      }
                    }}
                    disabled={bulkSaving || selectedVariantIds.length === 0 || !bulkActionType || bulkActionType === "Bulk Action"}
                    className="h-8 rounded-md bg-[#E31E24] hover:bg-[#B5151B] px-4 text-[12.5px] font-semibold text-white disabled:opacity-40 disabled:hover:bg-[#E31E24] disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[80px]"
                  >
                    {bulkSaving ? "Applying..." : "Apply"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setFilterSku("");
                    setFilterVariantName("");
                    setFilterAttributes("");
                    setFilterStock("");
                    setFilterPrice("");
                    setFilterStatus("");
                    setVariantTabSearchQuery("");
                    setVariantTabStatusFilter("");
                    setVariantTabStockFilter("");
                  }}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-1.5 text-[12.5px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]"
                >
                  Clear Filters
                </button>
                <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
              </div>
            </div>

            {variantDisplayMode === "flat" && variantGridState.reasons.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
                <span className="font-semibold">Flat list active:</span> {variantGridState.reasons[0]}.
              </div>
            )}

            {variantDisplayMode === "grid" ? (
              <VariantGridMatrix
                gridState={variantGridState}
                onEditVariant={openEditVariantModal}
                onManageCountries={openVariantCountriesModal}
                bulkEditMode={bulkEditMode}
                bulkCountryId={primarySelectedBulkCountryId}
                rowErrors={bulkRowErrors}
                getDraft={getBulkVariantDraft}
                onDraftChange={updateBulkDraft}
                productBasePrices={productBasePrices}
              />
            ) : bulkEditMode ? (
              renderBulkFlatVariantTable()
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#E6E6E6] bg-white">
                <table className="min-w-full border-collapse text-left text-[13px]">
                  <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
                    <tr>
                      <th className="border-b border-[#E6E6E6] px-4 py-3 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredVariantRows.length > 0 && filteredVariantRows.every((r) => selectedVariantIds.includes(r.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = filteredVariantRows.map((r) => r.id);
                              setSelectedVariantIds((prev) => Array.from(new Set([...prev, ...allIds])));
                            } else {
                              const allIds = new Set(filteredVariantRows.map((r) => r.id));
                              setSelectedVariantIds((prev) => prev.filter((id) => !allIds.has(id)));
                            }
                          }}
                          className="h-4 w-4 accent-[#E31E24]"
                        />
                      </th>
                      <th
                        onClick={() => {
                          setSortField("sku");
                          setSortDirection((d) => d === "asc" ? "desc" : "asc");
                        }}
                        className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                          SKU {sortField === "sku" ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          setSortField("title");
                          setSortDirection((d) => d === "asc" ? "desc" : "asc");
                        }}
                        className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                          Variant {sortField === "title" ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          setSortField("attributes");
                          setSortDirection((d) => d === "asc" ? "desc" : "asc");
                        }}
                        className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                          Attributes {sortField === "attributes" ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          setSortField("stock");
                          setSortDirection((d) => d === "asc" ? "desc" : "asc");
                        }}
                        className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                          Stock {sortField === "stock" ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          setSortField("price");
                          setSortDirection((d) => d === "asc" ? "desc" : "asc");
                        }}
                        className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                          Price {sortField === "price" ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          setSortField("status");
                          setSortDirection((d) => d === "asc" ? "desc" : "asc");
                        }}
                        className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                          Status {sortField === "status" ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </div>
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-3">ACTIONS</th>
                    </tr>

                    <tr className="bg-white">
                      <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2">
                        <input
                          placeholder="Filter SKU"
                          value={filterSku}
                          onChange={(e) => {
                            setFilterSku(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                        />
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2">
                        <input
                          placeholder="Filter variant"
                          value={filterVariantName}
                          onChange={(e) => {
                            setFilterVariantName(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                        />
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2">
                        <input
                          placeholder="Filter attributes"
                          value={filterAttributes}
                          onChange={(e) => {
                            setFilterAttributes(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                        />
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2">
                        <input
                          placeholder="Filter stock"
                          value={filterStock}
                          onChange={(e) => {
                            setFilterStock(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                        />
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2">
                        <input
                          placeholder="Filter price"
                          value={filterPrice}
                          onChange={(e) => {
                            setFilterPrice(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                        />
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2">
                        <select
                          value={filterStatus}
                          onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12.5px] font-normal outline-none focus:border-[#E31E24]"
                        >
                          <option value="">All status</option>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </th>
                      <th className="border-b border-[#E6E6E6] px-4 py-2 text-right text-[11px] font-medium text-[#9A9A9A] select-none pr-8 whitespace-nowrap">
                        Columns filters (client-side)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVariantRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-[#9A9A9A]">
                          No variants match filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedVariantRows.map((variant, index) => {
                        const warehouseInv = variantTabWarehouseFilter
                          ? variant.inventories?.find((inv: any) => inv.warehouseId === variantTabWarehouseFilter)
                          : null;
                        const baseStock = variantTabWarehouseFilter
                          ? (warehouseInv ? warehouseInv.stock ?? 0 : "—")
                          : (getBaseInventory(variant.inventories)?.stock ?? "—");
                        const priceObj = getVariantPriceForCountry(variant, variantTableDisplayCountryId || undefined, productBasePrices);
                        const formattedPrice = priceObj
                          ? `${priceObj.currency?.symbol ?? "₹"}${priceObj.sellingPrice ?? priceObj.mrp ?? "0.00"}`
                          : "—";

                        return (
                          <tr key={variant.id} className="border-b border-[#F0F0F0] last:border-b-0 hover:bg-[#FAF9F9]">
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedVariantIds.includes(variant.id)}
                                onChange={(e: any) => {
                                  const isShift = e.nativeEvent?.shiftKey;
                                  const isChecked = e.target.checked;
                                  
                                  if (isShift && lastSelectedVariantIndexRef.current !== null) {
                                    const start = Math.min(lastSelectedVariantIndexRef.current, index);
                                    const end = Math.max(lastSelectedVariantIndexRef.current, index);
                                    const rangeIds = paginatedVariantRows.slice(start, end + 1).map(r => r.id);
                                    
                                    if (isChecked) {
                                      setSelectedVariantIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
                                    } else {
                                      setSelectedVariantIds((prev) => prev.filter(id => !rangeIds.includes(id)));
                                    }
                                  } else {
                                    if (isChecked) {
                                      setSelectedVariantIds((prev) => [...prev, variant.id]);
                                    } else {
                                      setSelectedVariantIds((prev) => prev.filter(id => id !== variant.id));
                                    }
                                  }
                                  lastSelectedVariantIndexRef.current = index;
                                }}
                                className="h-4 w-4 accent-[#E31E24]"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-[#1A1A1A]">{variant.sku || "No SKU"}</td>
                            <td className="px-4 py-3 text-[#555]">{variant.title}</td>
                            <td className="px-4 py-3 text-[#6B6B6B] text-[12px]">
                              {variant.attributeValues?.map((av) => (
                                <span key={av.attributeValueId} className="mr-1 inline-block bg-[#F2F2F2] px-2 py-0.5 rounded text-[#555]">
                                  {av.attribute?.name}: {av.attributeValue?.value}
                                </span>
                              )) || "—"}
                            </td>
                            <td className="px-4 py-3 font-medium text-[#1A1A1A]">{baseStock}</td>
                            <td className="px-4 py-3 font-medium text-[#1A1A1A]">{formattedPrice}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={variant.status} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditVariantModal(variant)}
                                  className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openVariantCountriesModal(variant)}
                                  className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
                                  title="Country availability"
                                >
                                  <Globe2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCloneVariant(variant.id)}
                                  className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]"
                                >
                                  <Copy size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingVariant(variant)}
                                  className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 5 && (
          <div className="space-y-6 p-6">
            {/* Global Base Currency Informational Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#E0E7FF] bg-[#F8FAFC] p-3.5 shadow-sm">
              <div className="flex items-start sm:items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#EEF2FF] text-[#4F46E5]">
                  <Globe2 size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1E293B]">
                      Base Currency:
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[12px] font-bold text-[#1D4ED8]">
                      {baseCurrency.name} ({baseCurrency.code} {baseCurrency.symbol})
                    </span>
                    <span className="rounded bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">
                      SYSTEM BASE
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">
                    Prices are entered in the system base currency ({baseCurrency.code} {baseCurrency.symbol}). Country-specific prices are generated using active exchange rates.
                  </p>
                </div>
              </div>
              <a
                href="/admin/currencies"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4F46E5] hover:text-[#3730A3] hover:underline whitespace-nowrap self-start sm:self-center"
              >
                Manage Currency Settings <ChevronRight size={14} />
              </a>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg border border-[#E6E6E6] bg-white p-1 max-w-max">
              {[
                { key: "base", label: "Base Prices" },
                { key: "variant_prices", label: "Variant Prices" },
                { key: "tier", label: "Tier Pricing" },
                { key: "moq", label: "MOQ Pricing" },
              ].map((subTab) => (
                <button
                  key={subTab.key}
                  type="button"
                  onClick={() => setPricingSubTab(subTab.key as any)}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    pricingSubTab === subTab.key ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]"
                  )}
                >
                  {subTab.label}
                </button>
              ))}
            </div>

            {pricingSubTab === "base" && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country-wise Pricing</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Set prices per country. Use Generate to auto-convert from base price.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {basePriceBulkEditMode && (
                      <button
                        type="button"
                        onClick={handleSaveAllBasePrices}
                        disabled={bulkSaving}
                        className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#B5151B] disabled:opacity-50"
                      >
                        <Save size={14} />
                        {bulkSaving ? "Saving..." : "Save All"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleBasePriceBulkEdit}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-4 py-2 text-[13px] font-medium",
                        basePriceBulkEditMode
                          ? "border-[#F2C9C9] bg-red-50 text-[#B5151B] hover:bg-red-100"
                          : "border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5]"
                      )}
                    >
                      {basePriceBulkEditMode ? "Exit Bulk Edit" : "Bulk Edit"}
                    </button>
                    {productBasePrices.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllBasePrices}
                        className="flex items-center gap-1.5 rounded-md border border-[#F2C9C9] bg-red-50 px-3.5 py-2 text-[13px] font-medium text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={14} /> Delete All Prices
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openCountryPriceModal}
                      className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
                    >
                      <RefreshCw size={14} /> Generate All Country Prices
                    </button>
                  </div>
                </div>
                {basePriceBulkEditMode ? (
                  renderBulkBasePriceTable()
                ) : (
                  <>
                    {/* Custom Table Controls row directly above the table */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E6E6E6] bg-white p-3.5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px] font-semibold text-[#1A1A1A]">List</span>
                        <span className="rounded-full bg-[#FEF2F2] border border-red-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-red-600">
                          {selectedPriceIds.length} selected
                        </span>
                        <span className="text-[12.5px] text-[#6B6B6B]">
                          Showing {totalPriceItems === 0 ? 0 : (priceCurrentPage - 1) * pricePageSize + 1}-{Math.min(priceCurrentPage * pricePageSize, totalPriceItems)} of {totalPriceItems}
                        </span>
                        <div className="flex items-center gap-1">
                          <select
                            value={pricePageSize}
                            onChange={(e) => {
                              setPricePageSize(Number(e.target.value));
                              setPriceCurrentPage(1);
                            }}
                            className="rounded-md border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] text-[#1A1A1A] outline-none"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            type="button"
                            onClick={() => setPriceCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={priceCurrentPage === 1}
                            className="rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <span className="text-[12px] text-[#1A1A1A] font-semibold">{priceCurrentPage}/{totalPricePages}</span>
                          <button
                            type="button"
                            onClick={() => setPriceCurrentPage((p) => Math.min(totalPricePages, p + 1))}
                            disabled={priceCurrentPage === totalPricePages}
                            className="rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <select
                          value={priceBulkActionType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPriceBulkActionType(val);
                            if (val === "Price update") {
                              if (selectedPriceIds.length === 0) {
                                showToast("Please select at least one price row first.", "error");
                                setTimeout(() => setPriceBulkActionType("Bulk Action"), 0);
                                return;
                              }
                              setBulkPriceUpdateModalContext("base");
                              setTimeout(() => setPriceBulkActionType("Bulk Action"), 0);
                            }
                          }}
                          className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                        >
                          <option value="Bulk Action">Bulk Action</option>
                          <option value="Mark active">Mark active</option>
                          <option value="Mark inactive">Mark inactive</option>
                          <option value="Price update">Price update</option>
                          <option value="Delete selected">Delete selected</option>
                        </select>
                        <button
                          type="button"
                          onClick={handlePriceBulkApplyAction}
                          disabled={bulkSaving || selectedPriceIds.length === 0}
                          className="rounded-md bg-[#1A1A1A] hover:bg-[#333] px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm disabled:opacity-40"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterPriceCountry("");
                            setFilterPriceMRP("");
                            setFilterPriceSelling("");
                            setFilterPriceDealer("");
                            setFilterPriceDoctor("");
                            setFilterPriceStatus("");
                          }}
                          className="rounded-md border border-[#E6E6E6] bg-white px-4 py-1.5 text-[12.5px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]"
                        >
                          Clear Filters
                        </button>
                        <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-[#E6E6E6] bg-white">
                      <table className="min-w-full border-collapse text-left text-[13px]">
                        <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
                          <tr>
                            <th className="border-b border-[#E6E6E6] px-4 py-3 w-12 text-center">
                              <input
                                type="checkbox"
                                checked={paginatedBasePrices.length > 0 && paginatedBasePrices.every((r: any) => selectedPriceIds.includes(r.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const pageIds = paginatedBasePrices.map((r: any) => r.id);
                                    setSelectedPriceIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                                  } else {
                                    const pageIds = new Set(paginatedBasePrices.map((r: any) => r.id));
                                    setSelectedPriceIds((prev) => prev.filter((id) => !pageIds.has(id)));
                                  }
                                }}
                                className="h-4 w-4 accent-[#E31E24]"
                              />
                            </th>
                            <th
                              onClick={() => {
                                setPriceSortField("country");
                                setPriceSortDirection((d) => d === "asc" ? "desc" : "asc");
                              }}
                              className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                                Country {priceSortField === "country" ? (priceSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                              </div>
                            </th>
                            <th
                              onClick={() => {
                                setPriceSortField("mrp");
                                setPriceSortDirection((d) => d === "asc" ? "desc" : "asc");
                              }}
                              className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                                MRP {priceSortField === "mrp" ? (priceSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                              </div>
                            </th>
                            <th
                              onClick={() => {
                                setPriceSortField("sellingPrice");
                                setPriceSortDirection((d) => d === "asc" ? "desc" : "asc");
                              }}
                              className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                                Selling Price {priceSortField === "sellingPrice" ? (priceSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                              </div>
                            </th>
                            <th
                              onClick={() => {
                                setPriceSortField("dealerPrice");
                                setPriceSortDirection((d) => d === "asc" ? "desc" : "asc");
                              }}
                              className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                                Dealer {priceSortField === "dealerPrice" ? (priceSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                              </div>
                            </th>
                            <th
                              onClick={() => {
                                setPriceSortField("distributorPrice");
                                setPriceSortDirection((d) => d === "asc" ? "desc" : "asc");
                              }}
                              className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                                Doctor / Retailer {priceSortField === "distributorPrice" ? (priceSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                              </div>
                            </th>
                            <th
                              onClick={() => {
                                setPriceSortField("status");
                                setPriceSortDirection((d) => d === "asc" ? "desc" : "asc");
                              }}
                              className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1 hover:text-[#1A1A1A]">
                                Status {priceSortField === "status" ? (priceSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                              </div>
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-3">ACTIONS</th>
                          </tr>

                          <tr className="bg-white">
                            <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2">
                              <input
                                placeholder="Filter Country"
                                value={filterPriceCountry}
                                onChange={(e) => {
                                  setFilterPriceCountry(e.target.value);
                                  setPriceCurrentPage(1);
                                }}
                                className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                              />
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2">
                              <input
                                placeholder="Filter MRP"
                                value={filterPriceMRP}
                                onChange={(e) => {
                                  setFilterPriceMRP(e.target.value);
                                  setPriceCurrentPage(1);
                                }}
                                className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                              />
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2">
                              <input
                                placeholder="Filter Selling Price"
                                value={filterPriceSelling}
                                onChange={(e) => {
                                  setFilterPriceSelling(e.target.value);
                                  setPriceCurrentPage(1);
                                }}
                                className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                              />
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2">
                              <input
                                placeholder="Filter Dealer"
                                value={filterPriceDealer}
                                onChange={(e) => {
                                  setFilterPriceDealer(e.target.value);
                                  setPriceCurrentPage(1);
                                }}
                                className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                              />
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2">
                              <input
                                placeholder="Filter Doctor / Retailer"
                                value={filterPriceDoctor}
                                onChange={(e) => {
                                  setFilterPriceDoctor(e.target.value);
                                  setPriceCurrentPage(1);
                                }}
                                className="w-full rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                              />
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2">
                              <select
                                value={filterPriceStatus}
                                onChange={(e) => {
                                  setFilterPriceStatus(e.target.value);
                                  setPriceCurrentPage(1);
                                }}
                                className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12.5px] font-normal outline-none focus:border-[#E31E24]"
                              >
                                <option value="">All status</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                              </select>
                            </th>
                            <th className="border-b border-[#E6E6E6] px-4 py-2 text-right text-[11px] font-medium text-[#9A9A9A] select-none pr-8 whitespace-nowrap">
                              Columns filters (client-side)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBasePrices.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-[#9A9A9A]">
                                No country-wise prices match filters.
                              </td>
                            </tr>
                          ) : (
                            paginatedBasePrices.map((price: any, index: number) => {
                              const formattedMRP = `${price.currency?.symbol ?? "$"}${price.mrp}`;
                              const formattedSelling = `${price.currency?.symbol ?? "$"}${price.sellingPrice}`;
                              const formattedDealer = price.dealerPrice != null ? `${price.currency?.symbol ?? "$"}${price.dealerPrice}` : "—";
                              const formattedDoctor = price.distributorPrice != null ? `${price.currency?.symbol ?? "$"}${price.distributorPrice}` : "—";

                              return (
                                <tr key={price.id} className="border-b border-[#F0F0F0] last:border-b-0 hover:bg-[#FAF9F9]">
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedPriceIds.includes(price.id)}
                                      onChange={(e: any) => {
                                        const isShift = e.nativeEvent?.shiftKey;
                                        const isChecked = e.target.checked;
                                        
                                        if (isShift && lastSelectedPriceIndexRef.current !== null) {
                                          const start = Math.min(lastSelectedPriceIndexRef.current, index);
                                          const end = Math.max(lastSelectedPriceIndexRef.current, index);
                                          const rangeIds = paginatedBasePrices.slice(start, end + 1).map((r: any) => r.id);
                                          
                                          if (isChecked) {
                                            setSelectedPriceIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
                                          } else {
                                            setSelectedPriceIds((prev) => prev.filter(id => !rangeIds.includes(id)));
                                          }
                                        } else {
                                          if (isChecked) {
                                            setSelectedPriceIds((prev) => [...prev, price.id]);
                                          } else {
                                            setSelectedPriceIds((prev) => prev.filter(id => id !== price.id));
                                          }
                                        }
                                        lastSelectedPriceIndexRef.current = index;
                                      }}
                                      className="h-4 w-4 accent-[#E31E24]"
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">
                                    {price.country?.name} ({price.country?.code})
                                  </td>
                                  <td className="px-4 py-3 text-[#1A1A1A] font-medium">{formattedMRP}</td>
                                  <td className="px-4 py-3 text-[#1A1A1A] font-medium">{formattedSelling}</td>
                                  <td className="px-4 py-3 text-[#1A1A1A]">{formattedDealer}</td>
                                  <td className="px-4 py-3 text-[#1A1A1A]">{formattedDoctor}</td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={price.status} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditPrice(price)}
                                        className="rounded border border-[#E6E6E6] p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProductPrice(price.id)}
                                        className="rounded border border-[#F2C9C9] p-1 text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            )}

            {pricingSubTab === "variant_prices" && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Variant-wise Pricing</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Manage country-specific overrides for product variants.</p>
                  </div>

                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#F2F2F2] px-2 py-0.5 text-[11px] font-semibold text-[#6B6B6B]">List</span>
                    <span className="text-[12.5px] font-semibold text-[#1A1A1A]">{selectedVPIds.length} selected</span>
                    <div className="h-4 w-px bg-[#E6E6E6]" />
                    <span className="text-[12.5px] text-[#6B6B6B]">
                      Showing {totalVPItems > 0 ? (vpCurrentPage - 1) * vpPageSize + 1 : 0}-
                      {Math.min(vpCurrentPage * vpPageSize, totalVPItems)} of {totalVPItems}
                    </span>
                    <select
                      value={vpPageSize}
                      onChange={(e) => {
                        setVpPageSize(Number(e.target.value));
                        setVpCurrentPage(1);
                      }}
                      className="rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] outline-none"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setVpCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={vpCurrentPage === 1}
                        className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-medium hover:bg-[#F2F2F2] disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <span className="text-[12.5px] text-[#1A1A1A] font-medium px-1">
                        {vpCurrentPage}/{totalVPPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVpCurrentPage((p) => Math.min(totalVPPages, p + 1))}
                        disabled={vpCurrentPage === totalVPPages}
                        className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-medium hover:bg-[#F2F2F2] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={vpBulkActionType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVpBulkActionType(val);
                        if (val === "Price update") {
                          if (selectedVPIds.length === 0) {
                            showToast("Please select at least one variant price row first.", "error");
                            setTimeout(() => setVpBulkActionType("Bulk Action"), 0);
                            return;
                          }
                          setBulkPriceUpdateModalContext("variant_prices");
                          setTimeout(() => setVpBulkActionType("Bulk Action"), 0);
                        }
                      }}
                      className="h-8.5 rounded-md border border-[#E6E6E6] bg-white px-3 text-[12.5px] outline-none focus:border-[#E31E24]"
                    >
                      <option value="Bulk Action">Bulk Action</option>
                      <option value="Mark active">Mark active</option>
                      <option value="Mark inactive">Mark inactive</option>
                      <option value="Price update">Price update</option>
                      <option value="Delete selected">Delete selected</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleVPBulkApplyAction}
                      disabled={bulkSaving || selectedVPIds.length === 0 || vpBulkActionType === "Bulk Action"}
                      className="h-8.5 rounded-md bg-[#1A1A1A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#333] disabled:opacity-50"
                    >
                      {bulkSaving ? "Applying..." : "Apply"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterVPVariant("");
                        setFilterVPCountry("");
                        setFilterVPMRP("");
                        setFilterVPSelling("");
                        setFilterVPDealer("");
                        setFilterVPDoctor("");
                        setFilterVPStatus("");
                        setSelectedVPIds([]);
                      }}
                      className="h-8.5 rounded-md border border-[#E6E6E6] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
                    >
                      Clear Filters
                    </button>
                    <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#E6E6E6] bg-white">
                  <table className="min-w-full border-collapse text-left text-[13px]">
                    <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
                      <tr>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={paginatedVariantPrices.length > 0 && paginatedVariantPrices.every((r: any) => selectedVPIds.includes(r.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const pageIds = paginatedVariantPrices.map((r: any) => r.id);
                                setSelectedVPIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                              } else {
                                const pageIds = new Set(paginatedVariantPrices.map((r: any) => r.id));
                                setSelectedVPIds((prev) => prev.filter((id) => !pageIds.has(id)));
                              }
                            }}
                            className="h-4 w-4 accent-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-12 text-center"></th>
                        <th
                          onClick={() => {
                            setVpSortField("variant");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Variant {vpSortField === "variant" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setVpSortField("country");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Country {vpSortField === "country" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setVpSortField("mrp");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          MRP {vpSortField === "mrp" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setVpSortField("sellingPrice");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Selling Price {vpSortField === "sellingPrice" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setVpSortField("dealerPrice");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Dealer {vpSortField === "dealerPrice" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setVpSortField("distributorPrice");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Doctor / Retailer {vpSortField === "distributorPrice" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setVpSortField("status");
                            setVpSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Status {vpSortField === "status" ? (vpSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-3">ACTIONS</th>
                      </tr>
                      <tr className="bg-[#FCFCFC]">
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Variant"
                            value={filterVPVariant}
                            onChange={(e) => setFilterVPVariant(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Country"
                            value={filterVPCountry}
                            onChange={(e) => setFilterVPCountry(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter MRP"
                            value={filterVPMRP}
                            onChange={(e) => setFilterVPMRP(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Selling Price"
                            value={filterVPSelling}
                            onChange={(e) => setFilterVPSelling(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Dealer"
                            value={filterVPDealer}
                            onChange={(e) => setFilterVPDealer(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Doctor / Retailer"
                            value={filterVPDoctor}
                            onChange={(e) => setFilterVPDoctor(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <select
                            value={filterVPStatus}
                            onChange={(e) => setFilterVPStatus(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-1.5 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          >
                            <option value="">All status</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2 text-[11px] text-[#9A9A9A] font-normal">Columns filters (client-side)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E6]">
                      {paginatedGroupedVariantIds.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-[#9A9A9A]">
                            No variant price overrides found.
                          </td>
                        </tr>
                      ) : (
                        paginatedGroupedVariantIds.map((variantId, index) => {
                          const group = groupedVariantPrices[variantId];
                          const isExpanded = expandedVPVariantIds.includes(variantId);
                          const toggleExpand = () => {
                            if (isExpanded) {
                              setExpandedVPVariantIds(prev => prev.filter(id => id !== variantId));
                            } else {
                              setExpandedVPVariantIds(prev => [...prev, variantId]);
                            }
                          };

                          return (
                            <Fragment key={variantId}>
                              <tr className="bg-[#F8F9FA] hover:bg-[#F2F2F2] cursor-pointer" onClick={toggleExpand}>
                                <td className="px-4 py-3 text-center border-b border-[#E6E6E6]" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={group.prices.length > 0 && group.prices.every((p: any) => selectedVPIds.includes(p.id))}
                                    onChange={(e: any) => {
                                      const isShift = e.nativeEvent?.shiftKey;
                                      const isChecked = e.target.checked;
                                      const groupIds = group.prices.map((p: any) => p.id);

                                      if (isShift && lastSelectedVPIndexRef.current !== null) {
                                        const start = Math.min(lastSelectedVPIndexRef.current, index);
                                        const end = Math.max(lastSelectedVPIndexRef.current, index);
                                        const rangeVariantIds = paginatedGroupedVariantIds.slice(start, end + 1);
                                        const rangeVPIds = rangeVariantIds.flatMap(vid => groupedVariantPrices[vid]?.prices.map((p: any) => p.id) || []);
                                        
                                        if (isChecked) {
                                          setSelectedVPIds((prev) => Array.from(new Set([...prev, ...rangeVPIds])));
                                        } else {
                                          setSelectedVPIds((prev) => prev.filter((id) => !rangeVPIds.includes(id)));
                                        }
                                      } else {
                                        if (isChecked) {
                                          setSelectedVPIds((prev) => Array.from(new Set([...prev, ...groupIds])));
                                        } else {
                                          setSelectedVPIds((prev) => prev.filter((id) => !groupIds.includes(id)));
                                        }
                                      }
                                      lastSelectedVPIndexRef.current = index;
                                    }}
                                    className="h-4 w-4 accent-[#E31E24]"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center border-b border-[#E6E6E6] text-[#9A9A9A]">
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </td>
                                <td className="px-4 py-3 font-medium text-[#1A1A1A] border-b border-[#E6E6E6]" colSpan={7}>
                                  {group.variantTitle} {group.variantSku ? `(${group.variantSku})` : ""}
                                  <span className="ml-3 text-[12px] text-[#6B6B6B] font-normal px-2 py-0.5 rounded bg-white border border-[#E6E6E6]">
                                    {group.prices.filter((p: any) => p.isOverride).length} Pricing Override{group.prices.filter((p: any) => p.isOverride).length !== 1 ? 's' : ''}
                                  </span>
                                </td>
                                <td className="px-4 py-3 border-b border-[#E6E6E6]" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const variant = variantRows.find((v) => v.id === variantId);
                                      if (variant) openEditVariantModal(variant);
                                    }}
                                    title="Add Override"
                                    className="rounded border border-[#E6E6E6] bg-white p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && group.prices.map((price: any) => {
                                const currencySymbol = price.currency?.symbol ?? price.country?.currency?.symbol ?? "$";
                                return (
                                  <tr key={price.id} className="hover:bg-[#FAFAFA]">
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={selectedVPIds.includes(price.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedVPIds((prev) => [...prev, price.id]);
                                          } else {
                                            setSelectedVPIds((prev) => prev.filter((id) => id !== price.id));
                                          }
                                        }}
                                        className="h-4 w-4 accent-[#E31E24]"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center text-[#9A9A9A] border-r border-[#E6E6E6]">
                                      ↳
                                    </td>
                                    <td className="px-4 py-3 text-[#9A9A9A] text-[12px]">
                                      <span className="sr-only">{group.variantTitle}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[#6B6B6B]">
                                      {price.country?.name} ({price.country?.code})
                                    </td>
                                    <td className="px-4 py-3 font-medium text-[#1A1A1A]">
                                      {currencySymbol}
                                      {price.mrp}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-[#16A34A]">
                                      {currencySymbol}
                                      {price.sellingPrice}
                                    </td>
                                    <td className="px-4 py-3 text-[#1A1A1A]">
                                      {price.dealerPrice != null ? `${currencySymbol}${price.dealerPrice}` : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-[#1A1A1A]">
                                      {price.distributorPrice != null ? `${currencySymbol}${price.distributorPrice}` : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={cn(
                                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                          price.status === "ACTIVE" ? "bg-[#E6F4EA] text-[#137333]" : "bg-[#FCE8E6] text-[#C5221F]"
                                        )}
                                      >
                                        {price.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        {price.isOverride && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const variant = variantRows.find((v) => v.id === price.variantId);
                                                if (variant) openEditVariantModal(variant);
                                              }}
                                              title="Edit Override"
                                              className="rounded border border-[#E6E6E6] p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                                            >
                                              <Pencil size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteProductPrice(price.id)}
                                              className="rounded border border-[#F2C9C9] p-1 text-red-600 hover:bg-red-50"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {pricingSubTab === "tier" && (
              <section className="rounded-lg border border-[#E6E6E6] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Tier Pricing</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Create product or variant-specific tier rules. Checkout pricing resolver is a later step.</p>
                  </div>
                  <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
                </div>
                <div className={`grid gap-3 ${variantRows.length > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
                  <AdminSelect label="Tier" value={tierRuleDraft.tierId} onChange={(e) => setTierRuleDraft((d) => ({ ...d, tierId: e.target.value }))} options={[{ value: "", label: "Select tier" }, ...tierRows.map((tier) => ({ value: tier.id, label: tier.name }))]} />
                  <AdminMultiSearchableSelect
                    label="Countries"
                    values={tierRuleDraft.countryIds ?? (tierRuleDraft.countryId ? [tierRuleDraft.countryId] : [])}
                    onValuesChange={(values) => setTierRuleDraft((d) => ({ ...d, countryIds: values, countryId: values[0] ?? "" }))}
                    options={countryRows.map((country) => ({ value: country.id, label: `${country.name} (${country.code})` }))}
                    placeholder="Select countries"
                    allowSelectAll
                    selectAllLabel="All countries"
                    emptyMeansAll={false}
                  />
                  {variantRows.length > 0 && (
                    <AdminMultiSearchableSelect
                      label="Variants"
                      values={tierRuleDraft.variantIds ?? (tierRuleDraft.variantId ? [tierRuleDraft.variantId] : [])}
                      onValuesChange={(values) => setTierRuleDraft((d) => ({ ...d, variantIds: values, variantId: values[0] ?? "" }))}
                      options={[{ value: "", label: "All Variants" }, ...variantRows.map((variant) => ({ value: variant.id, label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title }))]}
                      placeholder="Select variants"
                      isInfinite={true}
                    />
                  )}
                  <AdminSelect label="Mode" value={tierRuleDraft.mode} onChange={(e) => setTierRuleDraft((d) => ({ ...d, mode: e.target.value as "discount" | "fixed" }))} options={[{ value: "discount", label: "% Discount" }, { value: "fixed", label: "Fixed Price" }]} />
                  <AdminInput label={tierRuleDraft.mode === "discount" ? "Discount %" : "Fixed Price"} type="number" min={0} step="0.01" value={tierRuleDraft.mode === "discount" ? tierRuleDraft.discountPercent : tierRuleDraft.fixedPrice} onChange={(e) => setTierRuleDraft((d) => ({ ...d, [d.mode === "discount" ? "discountPercent" : "fixedPrice"]: e.target.value }))} />
                  <div className="flex items-end gap-2">
                    {editingTierRuleId ? (
                      <>
                        <button type="button" onClick={handleUpdateTierRule} disabled={updateTierPricing.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">Update</button>
                        <button type="button" onClick={resetTierRuleDraft} className="w-full rounded-md border border-[#E6E6E6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]">Cancel</button>
                      </>
                    ) : (
                      <button type="button" onClick={handleCreateTierRule} disabled={createTierPricing.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">Add Rule</button>
                    )}
                  </div>
                </div>
                <div className="mt-4 divide-y divide-[#E6E6E6] rounded-md border border-[#E6E6E6]">
                  {tierPricingRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#9A9A9A]">No tier pricing rules yet.</div>
                  ) : tierPricingRows.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                      <span className="font-medium text-[#1A1A1A]">{rule.tier?.name ?? "Tier"}</span>
                      <span className="text-[#6B6B6B]">{rule.country ? `${rule.country.name} (${rule.country.code})` : "Country"}</span>
                      <span className="text-[#6B6B6B]">{rule.variant ? rule.variant.title : "All Variants"}</span>
                      <span className="ml-auto font-semibold text-[#1A1A1A]">{rule.discountPercent ? `${rule.discountPercent}% off` : `${rule.fixedPrice} fixed`}</span>
                      <button type="button" onClick={() => handleEditTierRuleClick(rule)} className="rounded border border-[#E6E6E6] px-2 py-1 text-gray-600 hover:bg-gray-50"><Pencil size={13} /></button>
                      <button type="button" onClick={() => handleDeleteTierRule(rule.id)} className="rounded border border-[#F2C9C9] px-2 py-1 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {pricingSubTab === "moq" && (
              <section className="rounded-lg border border-[#E6E6E6] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">MOQ Pricing</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Create quantity price-break rules. Existing variant MOQ remains a minimum-quantity gate only.</p>
                  </div>
                  <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
                </div>
                <div className={`grid gap-3 ${variantRows.length > 0 ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}>
                  <AdminMultiSearchableSelect
                    label="Countries"
                    values={moqRuleDraft.countryIds ?? (moqRuleDraft.countryId ? [moqRuleDraft.countryId] : [])}
                    onValuesChange={(values) => setMoqRuleDraft((d) => ({ ...d, countryIds: values, countryId: values[0] ?? "" }))}
                    options={countryRows.map((country) => ({ value: country.id, label: `${country.name} (${country.code})` }))}
                    placeholder="Select countries"
                    allowSelectAll
                    selectAllLabel="All countries"
                    emptyMeansAll={false}
                  />
                  {variantRows.length > 0 && (
                    <AdminMultiSearchableSelect
                      label="Variants"
                      values={moqRuleDraft.variantIds ?? (moqRuleDraft.variantId ? [moqRuleDraft.variantId] : [])}
                      onValuesChange={(values) => setMoqRuleDraft((d) => ({ ...d, variantIds: values, variantId: values[0] ?? "" }))}
                      options={[{ value: "", label: "All Variants" }, ...variantRows.map((variant) => ({ value: variant.id, label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title }))]}
                      placeholder="Select variants"
                      isInfinite={true}
                    />
                  )}
                  <AdminInput label="Min Qty" type="number" min={1} value={moqRuleDraft.minQuantity} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, minQuantity: e.target.value }))} />
                  <AdminInput label="Max Qty" type="number" min={1} placeholder="None" value={moqRuleDraft.maxQuantity} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, maxQuantity: e.target.value }))} />
                  <AdminSelect label="Mode" value={moqRuleDraft.mode} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, mode: e.target.value as "discount" | "fixed" }))} options={[{ value: "discount", label: "% Discount" }, { value: "fixed", label: "Fixed Price" }]} />
                  <AdminInput label={moqRuleDraft.mode === "discount" ? "Discount %" : "Fixed Price"} type="number" min={0} step="0.01" value={moqRuleDraft.mode === "discount" ? moqRuleDraft.discountPercent : moqRuleDraft.fixedPrice} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, [d.mode === "discount" ? "discountPercent" : "fixedPrice"]: e.target.value }))} />
                  <div className="flex items-end gap-2">
                    {editingMoqRuleId ? (
                      <>
                        <button type="button" onClick={handleUpdateMoqRule} disabled={updateMoqPricing.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">Update</button>
                        <button type="button" onClick={resetMoqRuleDraft} className="w-full rounded-md border border-[#E6E6E6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]">Cancel</button>
                      </>
                    ) : (
                      <button type="button" onClick={handleCreateMoqRule} disabled={createMoqPricing.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">Add Rule</button>
                    )}
                  </div>
                </div>
                <div className="mt-4 divide-y divide-[#E6E6E6] rounded-md border border-[#E6E6E6]">
                  {moqPricingRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#9A9A9A]">No MOQ pricing rules yet.</div>
                  ) : moqPricingRows.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                      <span className="font-medium text-[#1A1A1A]">{rule.minQuantity}{rule.maxQuantity ? ` - ${rule.maxQuantity}` : '+'} units</span>
                      <span className="text-[#6B6B6B]">{rule.country ? `${rule.country.name} (${rule.country.code})` : "Country"}</span>
                      <span className="text-[#6B6B6B]">{rule.variant ? rule.variant.title : "All Variants"}</span>
                      <span className="ml-auto font-semibold text-[#1A1A1A]">{rule.discountPercent ? `${rule.discountPercent}% off` : `${rule.fixedPrice} fixed`}</span>
                      <button type="button" onClick={() => handleEditMoqRuleClick(rule)} className="rounded border border-[#E6E6E6] px-2 py-1 text-gray-600 hover:bg-gray-50"><Pencil size={13} /></button>
                      <button type="button" onClick={() => handleDeleteMoqRule(rule.id)} className="rounded border border-[#F2C9C9] px-2 py-1 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 6 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Inventory</h3>
                <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Product and variant warehouse inventory levels.</p>
              </div>
              <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
            </div>
            <div className="mb-5">
              {(() => {
                const productLevelInventories = ((product?.inventories ?? []) as NonNullable<VariantRow["inventories"]>).filter((inventory) => !inventory.variantId);
                const baseInventory = productLevelInventories.find((inventory) => !inventory.warehouseId) ?? null;
                return (
                  <ProductBaseInventoryEditor
                    key={baseInventory?.id ?? "new-product-base-inventory"}
                    productId={productId}
                    inventory={baseInventory}
                    onSaved={refetch}
                    notify={showToast}
                    disabled={isReadOnly || product?.hasVariants}
                    hasVariants={product?.hasVariants}
                  />
                );
              })()}
            </div>

            <section className="mt-8">
              <div className="mb-4">
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Warehouse Availability</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Manage stock level and assignments for specific variants & warehouses.</p>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#F2F2F2] px-2 py-0.5 text-[11px] font-semibold text-[#6B6B6B]">List</span>
                    <span className="text-[12.5px] font-semibold text-[#1A1A1A]">{selectedInvIds.length} selected</span>
                    <div className="h-4 w-px bg-[#E6E6E6]" />
                    <span className="text-[12.5px] text-[#6B6B6B]">
                      Showing {totalInvItems > 0 ? (invCurrentPage - 1) * invPageSize + 1 : 0}-
                      {Math.min(invCurrentPage * invPageSize, totalInvItems)} of {totalInvItems}
                    </span>
                    <select
                      value={invPageSize}
                      onChange={(e) => {
                        setInvPageSize(Number(e.target.value));
                        setInvCurrentPage(1);
                      }}
                      className="rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] outline-none"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setInvCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={invCurrentPage === 1}
                        className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-medium hover:bg-[#F2F2F2] disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <span className="text-[12.5px] text-[#1A1A1A] font-medium px-1">
                        {invCurrentPage}/{totalInvPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setInvCurrentPage((p) => Math.min(totalInvPages, p + 1))}
                        disabled={invCurrentPage === totalInvPages}
                        className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-medium hover:bg-[#F2F2F2] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!["Bulk Action", "Delete selected assignments", "Assign to new warehouse"].includes(invBulkActionType) && (
                      <input
                        type="number"
                        placeholder="Value"
                        value={invBulkActionValue}
                        onChange={(e) => setInvBulkActionValue(e.target.value)}
                        disabled={bulkSaving}
                        className="h-8.5 rounded-md border border-[#E6E6E6] px-3 text-[12.5px] outline-none disabled:bg-[#FAFAFA]"
                      />
                    )}
                     <select
                      value={invBulkActionType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvBulkActionType(val);
                        if (val === "Assign to new warehouse") {
                          if (selectedInvIds.length === 0) {
                            showToast("Please select at least one variant first.", "error");
                            setTimeout(() => setInvBulkActionType("Bulk Action"), 0);
                            return;
                          }
                          setWarehouseAssignSelections({});
                          setWarehouseAssignStocks({});
                          setWarehouseAssignModalOpen(true);
                        }
                      }}
                      className="h-8.5 rounded-md border border-[#E6E6E6] bg-white px-3 text-[12.5px] outline-none focus:border-[#E31E24]"
                    >
                      <option>Bulk Action</option>
                      <option>Update stock</option>
                      <option>Assign to new warehouse</option>
                      <option>Delete selected assignments</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleInvBulkApplyAction}
                      disabled={bulkSaving || selectedInvIds.length === 0 || invBulkActionType === "Bulk Action"}
                      className="h-8.5 rounded-md bg-[#1A1A1A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#333] disabled:opacity-50"
                    >
                      {bulkSaving ? "Applying..." : "Apply"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterInvVariant("");
                        setFilterInvType("");
                        setSelectedInvIds([]);
                      }}
                      className="h-8.5 rounded-md border border-[#E6E6E6] bg-white px-4 text-[12.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
                    >
                      Clear Filters
                    </button>
                    <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#E6E6E6] bg-white">
                  <table className="min-w-full border-collapse text-left text-[13px]">
                    <thead className="bg-[#FAFAFA] text-[12px] font-semibold text-[#6B6B6B]">
                      <tr>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={paginatedVariantInventories.length > 0 && paginatedVariantInventories.every((r: any) => selectedInvIds.includes(r.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const pageIds = paginatedVariantInventories.map((r: any) => r.id);
                                setSelectedInvIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                              } else {
                                const pageIds = new Set(paginatedVariantInventories.map((r: any) => r.id));
                                setSelectedInvIds((prev) => prev.filter((id) => !pageIds.has(id)));
                              }
                            }}
                            className="h-4 w-4 accent-[#E31E24]"
                          />
                        </th>
                        <th
                          onClick={() => {
                            setInvSortField("variant");
                            setInvSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Variant {invSortField === "variant" ? (invSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setInvSortField("type");
                            setInvSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none"
                        >
                          Warehouse / Location {invSortField === "type" ? (invSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th
                          onClick={() => {
                            setInvSortField("stock");
                            setInvSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                          className="border-b border-[#E6E6E6] px-4 py-3 cursor-pointer select-none w-28 text-center"
                        >
                          Stock {invSortField === "stock" ? (invSortDirection === "asc" ? "↑" : "↓") : "⇅"}
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-28 text-center">Reserved</th>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-28 text-center">Available</th>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-28 text-center">Status</th>
                        <th className="border-b border-[#E6E6E6] px-4 py-3 w-24 text-right">ACTIONS</th>
                      </tr>
                      <tr className="bg-[#FCFCFC]">
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Variant"
                            value={filterInvVariant}
                            onChange={(e) => setFilterInvVariant(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2">
                          <input
                            type="text"
                            placeholder="Filter Warehouse"
                            value={filterInvType}
                            onChange={(e) => setFilterInvType(e.target.value)}
                            className="w-full rounded border border-[#E6E6E6] bg-white px-2 py-1 text-[12px] font-normal outline-none focus:border-[#E31E24]"
                          />
                        </th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2"></th>
                        <th className="border-b border-[#E6E6E6] px-4 py-2 text-right text-[11px] text-[#9A9A9A] font-normal">Filters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E6]">
                      {paginatedVariantGroups.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-[#9A9A9A]">
                            No assignments matching filters found.
                          </td>
                        </tr>
                      ) : (
                        paginatedVariantGroups.map((group: any, index: number) => {
                          const isBaseProductRowDisabled = product?.hasVariants && group.variantId === null;
                          return (
                            <tr
                              key={group.variantId}
                              className={cn(
                                "hover:bg-[#FAFAFA] align-middle transition-colors",
                                isBaseProductRowDisabled && "opacity-50 bg-gray-50/75 cursor-not-allowed select-none"
                              )}
                            >
                              <td className="px-4 py-3 text-center border-b border-[#E6E6E6] align-middle">
                                <input
                                  type="checkbox"
                                  checked={group.inventories.every((inv: any) => selectedInvIds.includes(inv.id))}
                                  disabled={isBaseProductRowDisabled}
                                  onChange={(e: any) => {
                                    const isShift = e.nativeEvent?.shiftKey;
                                    const isChecked = e.target.checked;
                                    const invIds = group.inventories.map((inv: any) => inv.id);

                                    if (isShift && lastSelectedGroupIndexRef.current !== null) {
                                      const start = Math.min(lastSelectedGroupIndexRef.current, index);
                                      const end = Math.max(lastSelectedGroupIndexRef.current, index);
                                      const rangeGroups = paginatedVariantGroups.slice(start, end + 1);
                                      const rangeInvIds = rangeGroups.flatMap((g: any) => g.inventories.map((i: any) => i.id));
                                      
                                      if (isChecked) {
                                        setSelectedInvIds((prev) => Array.from(new Set([...prev, ...rangeInvIds])));
                                      } else {
                                        setSelectedInvIds((prev) => prev.filter((id) => !rangeInvIds.includes(id)));
                                      }
                                    } else {
                                      if (isChecked) {
                                        setSelectedInvIds((prev) => Array.from(new Set([...prev, ...invIds])));
                                      } else {
                                        setSelectedInvIds((prev) => prev.filter((id) => !invIds.includes(id)));
                                      }
                                    }
                                    lastSelectedGroupIndexRef.current = index;
                                  }}
                                  className="h-4 w-4 accent-[#E31E24] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-[#1A1A1A] border-b border-[#E6E6E6] border-r border-[#E6E6E6] align-middle">
                                <div className="font-semibold text-[#1A1A1A]">
                                  {group.variantTitle}
                                  {isBaseProductRowDisabled && (
                                    <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                                      Inherited (Variants Active)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11.5px] text-[#9A9A9A] mt-0.5">{group.variantSku ? `(${group.variantSku})` : ""}</div>
                              </td>
                              <td className="p-0 text-[#6B6B6B] border-b border-[#E6E6E6] align-middle">
                                {group.inventories.map((inventory: any) => (
                                  <div key={inventory.id} className="h-12 px-4 flex items-center border-b border-[#F0F0F0] last:border-b-0 text-[12.5px]">
                                    {inventory.isOverride ? (
                                      <span className="inline-flex flex-col">
                                        <span className="font-semibold text-[#1A1A1A] leading-snug">{inventory.warehouseName}</span>
                                        <span className="text-[10.5px] leading-none text-[#9A9A9A] mt-0.5">
                                          {inventory.warehouseState ? `${inventory.warehouseState}, ` : ''}{inventory.warehouseCountryCode}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-[#8A8A8A]">Base Inventory Default</span>
                                    )}
                                  </div>
                                ))}
                              </td>
                              <td className="p-0 text-center border-b border-[#E6E6E6] align-middle">
                                {group.inventories.map((inventory: any) => {
                                  const stockLevel = inventory.stock ?? 0;
                                  return (
                                    <div key={`${inventory.id}-${stockLevel}`} className="h-12 flex items-center justify-center border-b border-[#F0F0F0] last:border-b-0">
                                      <input
                                        type="number"
                                        min="0"
                                        defaultValue={stockLevel}
                                        disabled={isReadOnly || isBaseProductRowDisabled}
                                        className="w-20 rounded border border-[#E6E6E6] px-2 py-0.5 text-center text-[12.5px] outline-none focus:border-[#E31E24] disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        onBlur={async (e) => {
                                          const nextStock = parseInt(e.target.value);
                                          if (isNaN(nextStock) || nextStock < 0) return;
                                          if (inventory.id === "dummy-base-product") {
                                            await adminApi.put(`/inventory/product/${product?.id}`, { stock: nextStock });
                                          } else if (inventory.id.startsWith("dummy-")) {
                                            await adminApi.post(`/inventory/upsert`, { variantId: inventory.variantId, warehouseId: inventory.isOverride ? inventory.warehouseId : null, stock: nextStock });
                                          } else {
                                            await adminApi.put(`/inventory/${inventory.id}`, { stock: nextStock });
                                          }
                                          showToast("Stock updated.");
                                          refetch();
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </td>
                              <td className="p-0 text-center text-[#6B6B6B] border-b border-[#E6E6E6] align-middle">
                                {group.inventories.map((inventory: any) => (
                                  <div key={inventory.id} className="h-12 flex items-center justify-center border-b border-[#F0F0F0] last:border-b-0 text-[12.5px]">
                                    {inventory.reservedStock ?? 0}
                                  </div>
                                ))}
                              </td>
                              <td className="p-0 text-center font-semibold text-[#1A1A1A] border-b border-[#E6E6E6] align-middle">
                                {group.inventories.map((inventory: any) => {
                                  const stockLevel = inventory.stock ?? 0;
                                  const reserved = inventory.reservedStock ?? 0;
                                  const available = Math.max(0, stockLevel - reserved);
                                  return (
                                    <div key={inventory.id} className="h-12 flex items-center justify-center border-b border-[#F0F0F0] last:border-b-0 text-[12.5px]">
                                      {available}
                                    </div>
                                  );
                                })}
                              </td>
                              <td className="p-0 text-center border-b border-[#E6E6E6] align-middle">
                                {group.inventories.map((inventory: any) => {
                                  const stockLevel = inventory.stock ?? 0;
                                  const reserved = inventory.reservedStock ?? 0;
                                  const available = Math.max(0, stockLevel - reserved);
                                  const threshold = inventory.lowStockThreshold ?? 10;
                                  const isLowStock = available <= threshold;
                                  return (
                                    <div key={inventory.id} className="h-12 flex items-center justify-center border-b border-[#F0F0F0] last:border-b-0">
                                      <span
                                        className={cn(
                                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                          available > 0 
                                            ? (isLowStock ? "bg-[#FFF4E5] text-[#B06000]" : "bg-[#E6F4EA] text-[#137333]") 
                                            : "bg-[#FCE8E6] text-[#C5221F]"
                                        )}
                                      >
                                        {available > 0 ? (isLowStock ? "LOW" : "IN STOCK") : "OUT"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </td>
                              <td className="p-0 text-right border-b border-[#E6E6E6] align-middle">
                                {group.inventories.map((inventory: any) => {
                                  const stockLevel = inventory.stock ?? 0;
                                  const reserved = inventory.reservedStock ?? 0;
                                  return (
                                    <div key={inventory.id} className="h-12 flex items-center justify-center border-b border-[#F0F0F0] last:border-b-0 px-4">
                                      {inventory.isOverride ? (
                                        <button
                                          type="button"
                                          disabled={isReadOnly || isBaseProductRowDisabled}
                                          onClick={() => {
                                            setDeletingInventoryAssignment({
                                              id: inventory.id,
                                              warehouseName: inventory.warehouseName || "warehouse",
                                            });
                                          }}
                                          className="rounded border border-[#F2C9C9] p-1 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                          title="Remove Assignment"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      ) : (
                                        <div className="w-6" />
                                      )}
                                    </div>
                                  );
                                })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
          </div>
        )}

        {activeTab === 7 && (
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Translations</h3>
              <div className="flex flex-wrap items-center gap-2">
                {translationLanguages.length > 0 && (
                  <div className="w-[220px]">
                    <AdminSelect
                      label=""
                      value={translationLanguageId || activeTranslationLang?.id || ""}
                      onChange={(e) => setTranslationLanguageId(e.target.value)}
                      options={translationLanguages.map((lang) => ({
                        value: lang.id,
                        label: `${lang.name} (${lang.code.toUpperCase()})`,
                      }))}
                    />
                  </div>
                )}
                <button
                  onClick={async () => {
                    try {
                      const result = await adminApi.post("/translations/generate", { productId });
                      showToast(`Generated ${result.data.data.generated} translation${result.data.data.generated === 1 ? "" : "s"}.`);
                      refetch();
                    } catch (error) {
                      showToast(getAdminErrorMessage(error, "Failed to generate translations."), "error");
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
                >
                  <Zap size={14} /> AI Generate All
                </button>
              </div>
            </div>

            {translationLanguages.length === 0 ? (
              <NoTranslationLanguagesMessage />
            ) : activeTranslationLang && product ? (
              <div className="space-y-4">
                <TranslationEditorBanner language={activeTranslationLang} />
                {(() => {
                  const t = product.translations?.find((tr: { languageId: string }) => tr.languageId === activeTranslationLang.id) as {
                    id?: string;
                    languageId: string;
                    title?: string | null;
                    shortDescription?: string | null;
                    description?: string | null;
                    seoTitle?: string | null;
                    seoDescription?: string | null;
                    seoKeywords?: string | null;
                    highlights?: Array<{ title: string; description: string; image?: string }> | string | null;
                    technicalSpecs?: Array<{ label: string; value: string; image?: string }> | string | null;
                    warranty?: string[] | string | null;
                    primaryFeatures?: Array<{ title: string; description: string }> | string | null;
                    isAiGenerated?: boolean;
                    status?: string;
                  } | undefined;
                  const draft = translationDrafts[activeTranslationLang.id] ?? {
                    highlights: Array.isArray(t?.highlights)
                      ? t.highlights
                      : Array.isArray(product.highlights)
                        ? (product.highlights as Array<{ title: string; description: string; image?: string }>)
                        : [],
                    technicalSpecs: Array.isArray(t?.technicalSpecs)
                      ? t.technicalSpecs
                      : Array.isArray(product.technicalSpecs)
                        ? (product.technicalSpecs as Array<{ label: string; value: string; image?: string }>)
                        : [],
                    warranty: Array.isArray(t?.warranty)
                      ? t.warranty
                      : Array.isArray(product.warranty)
                        ? (product.warranty as string[])
                        : [],
                    primaryFeatures: Array.isArray(t?.primaryFeatures)
                      ? t.primaryFeatures
                      : Array.isArray(product.primaryFeatures)
                        ? (product.primaryFeatures as Array<{ title: string; description: string }>)
                        : [],
                  };

                  const setDraft = <K extends keyof ProductTranslationDraft>(field: K, value: ProductTranslationDraft[K]) => {
                    setTranslationDrafts((current) => ({
                      ...current,
                      [activeTranslationLang.id]: {
                        ...(current[activeTranslationLang.id] ?? draft),
                        [field]: value,
                      },
                    }));
                  };

                  const saveDraft = async (field: keyof ProductTranslationDraft) => {
                    await saveProductTranslation(activeTranslationLang.id, field, JSON.stringify(draft[field]));
                  };

                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {t?.status && <StatusBadge status={t.status} />}
                        {t?.isAiGenerated && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">AI Generated</span>
                        )}
                      </div>

                      {t?.status === "PENDING_REVIEW" && t.id && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <span className="text-[12.5px] text-amber-800">This translation is pending review and is not live on the storefront yet.</span>
                          <button
                            onClick={async () => {
                              try {
                                await adminApi.put(`/translations/products/translations/${t.id}/approve`);
                                showToast("Translation approved.");
                                refetch();
                              } catch {
                                showToast("Failed to approve translation.", "error");
                              }
                            }}
                            className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-[12px] font-medium text-green-700 hover:bg-green-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await adminApi.put(`/translations/products/translations/${t.id}/reject`);
                                showToast("Translation rejected.");
                                refetch();
                              } catch {
                                showToast("Failed to reject translation.", "error");
                              }
                            }}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-[12px] font-medium text-red-700 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      <TranslationBlurInput
                        key={`title-${activeTranslationLang.id}-${t?.title ?? ""}`}
                        label="Title"
                        defaultValue={t?.title || ""}
                        englishReference={product.title}
                        onSave={(value) => saveProductTranslation(activeTranslationLang.id, "title", value)}
                      />
                      <TranslationBlurField
                        key={`shortDescription-${activeTranslationLang.id}-${t?.shortDescription ?? ""}`}
                        label="Short Description"
                        rows={2}
                        defaultValue={t?.shortDescription || ""}
                        englishReference={product.shortDescription || ""}
                        onSave={(value) => saveProductTranslation(activeTranslationLang.id, "shortDescription", value)}
                      />
                      <TranslationRichTextField
                        key={`description-${activeTranslationLang.id}-${t?.description ?? ""}`}
                        label="Full Description"
                        defaultValue={t?.description || ""}
                        englishReference={product.description || ""}
                        onSave={(value) => saveProductTranslation(activeTranslationLang.id, "description", value)}
                      />
                      <TranslationBlurInput
                        key={`seoTitle-${activeTranslationLang.id}-${t?.seoTitle ?? ""}`}
                        label="SEO Title (max 60 chars)"
                        defaultValue={t?.seoTitle || ""}
                        englishReference={product.seoTitle || product.title}
                        onSave={(value) => saveProductTranslation(activeTranslationLang.id, "seoTitle", value)}
                      />
                      <TranslationBlurField
                        key={`seoDescription-${activeTranslationLang.id}-${t?.seoDescription ?? ""}`}
                        label="SEO Description (max 160 chars)"
                        rows={3}
                        defaultValue={t?.seoDescription || ""}
                        englishReference={product.seoDescription || product.shortDescription || ""}
                        onSave={(value) => saveProductTranslation(activeTranslationLang.id, "seoDescription", value)}
                      />
                      <TranslationBlurInput
                        key={`seoKeywords-${activeTranslationLang.id}-${t?.seoKeywords ?? ""}`}
                        label="SEO Keywords"
                        defaultValue={t?.seoKeywords || ""}
                        englishReference={product.seoKeywords || ""}
                        onSave={(value) => saveProductTranslation(activeTranslationLang.id, "seoKeywords", value)}
                      />
                      <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Features</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add title and description for each feature.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setDraft("highlights", [...draft.highlights, { title: "", description: "" }])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                              Add highlight
                            </button>
                            <button type="button" onClick={() => void saveDraft("highlights")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {draft.highlights.map((item, index) => (
                            <div key={index} className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto] items-stretch">
                              <AdminInput label="Title" value={item.title} onChange={(event) => {
                                const next = [...draft.highlights];
                                next[index] = { ...next[index], title: event.target.value };
                                setDraft("highlights", next);
                              }} />
                              <AdminRichTextEditor label="Description" value={item.description} placeholder="Enter translated highlight description" onChange={(value) => {
                                const next = [...draft.highlights];
                                next[index] = { ...next[index], description: value };
                                setDraft("highlights", next);
                              }} className="min-h-[120px]" />
                              <div className="flex items-end">
                                <button type="button" onClick={() => setDraft("highlights", draft.highlights.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          {!draft.highlights.length && <p className="text-[13px] text-[#6B6B6B]">No highlights added yet.</p>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Key Specifications</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add label and value rows for the translated Key Specifications table.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setDraft("technicalSpecs", [...draft.technicalSpecs, { label: "", value: "" }])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                              Add spec
                            </button>
                            <button type="button" onClick={() => void saveDraft("technicalSpecs")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {draft.technicalSpecs.map((item, index) => (
                            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                              <AdminInput label="Label" value={item.label} onChange={(event) => {
                                const next = [...draft.technicalSpecs];
                                next[index] = { ...next[index], label: event.target.value };
                                setDraft("technicalSpecs", next);
                              }} />
                              <AdminInput label="Value" value={item.value} onChange={(event) => {
                                const next = [...draft.technicalSpecs];
                                next[index] = { ...next[index], value: event.target.value };
                                setDraft("technicalSpecs", next);
                              }} />
                              <button type="button" onClick={() => setDraft("technicalSpecs", draft.technicalSpecs.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                                Remove
                              </button>
                            </div>
                          ))}
                          {!draft.technicalSpecs.length && <p className="text-[13px] text-[#6B6B6B]">No technical specifications added yet.</p>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Warranty</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add translated warranty lines.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setDraft("warranty", [...draft.warranty, ""])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                              Add line
                            </button>
                            <button type="button" onClick={() => void saveDraft("warranty")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {draft.warranty.map((line, index) => (
                            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto] items-stretch">
                              <AdminRichTextEditor label={`Warranty line ${index + 1}`} value={line} placeholder="Enter translated warranty text" onChange={(value) => {
                                const next = [...draft.warranty];
                                next[index] = value;
                                setDraft("warranty", next);
                              }} className="min-h-[80px]" />
                              <div className="flex items-end">
                                <button type="button" onClick={() => setDraft("warranty", draft.warranty.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          {!draft.warranty.length && <p className="text-[13px] text-[#6B6B6B]">No warranty lines added yet.</p>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Direction To Use</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add translated Direction To Use instructions and guidelines.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setDraft("primaryFeatures", [...draft.primaryFeatures, { title: "", description: "" }])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                              Add feature
                            </button>
                            <button type="button" onClick={() => void saveDraft("primaryFeatures")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {draft.primaryFeatures.map((item, index) => (
                            <div key={index} className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto] items-stretch">
                              <AdminInput label="Title" value={item.title} onChange={(event) => {
                                const next = [...draft.primaryFeatures];
                                next[index] = { ...next[index], title: event.target.value };
                                setDraft("primaryFeatures", next);
                              }} />
                              <AdminRichTextEditor label="Description" value={item.description} placeholder="Enter translated feature description" onChange={(value) => {
                                const next = [...draft.primaryFeatures];
                                next[index] = { ...next[index], description: value };
                                setDraft("primaryFeatures", next);
                              }} className="min-h-[120px]" />
                              <div className="flex items-end">
                                <button type="button" onClick={() => setDraft("primaryFeatures", draft.primaryFeatures.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          {!draft.primaryFeatures.length && <p className="text-[13px] text-[#6B6B6B]">No primary features added yet.</p>}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 8 && (
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Attributes</h3>
                <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#6B6B6B]">
                  Mapping attributes here defines which values are valid for this product. Future variant generation uses these mapped attributes by default; products with no mappings can still use the global catalog.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportProductAttributes}
                  disabled={attrExporting || mappedAttributeRows.length === 0}
                  className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors disabled:opacity-40 cursor-pointer"
                  title="Export mapped attributes to Excel"
                >
                  <Download size={14} />
                  {attrExporting ? "Exporting..." : "Export Excel"}
                </button>
                {canManageAttributes && (
                  <button
                    type="button"
                    onClick={openProductAttributesImportDialog}
                    className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                    title="Import attributes from Excel"
                  >
                    <Upload size={14} />
                    Import Excel
                  </button>
                )}
                <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
              </div>
            </div>

            <div className={cn("grid gap-4", canManageAttributes ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1")}>
              <div className="space-y-3">
                {productAttributesLoading ? (
                  <div className="h-28 animate-pulse rounded-lg bg-[#F2F2F2]" />
                ) : mappedAttributeRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
                    No attributes mapped to this product yet.
                  </div>
                ) : (
                  <>
                    <style>{`
                      body.card-drag-in-progress .mapped-attr-card * {
                        pointer-events: none !important;
                      }
                    `}</style>
                    {mappedAttributeRows.map((mapping, attrIndex) => (
                    <div
                      key={mapping.id}
                      draggable={canManageAttributes}
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("button, select, input, a, [role='button'], .no-card-drag")) {
                          e.preventDefault();
                          return;
                        }
                        clearCardDragStyles();
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", mapping.id);
                        draggingCardAttrRef.current = mapping.id;
                        draggedCardElementRef.current = e.currentTarget;
                        if (typeof document !== "undefined") {
                          document.body.classList.add("card-drag-in-progress");
                        }
                        const el = e.currentTarget;
                        setTimeout(() => {
                          if (draggingCardAttrRef.current) {
                            el.classList.add("opacity-40", "border-dashed", "border-[#E31E24]");
                          }
                        }, 0);
                      }}
                      onDragEnd={() => {
                        clearCardDragStyles();
                        draggingCardAttrRef.current = null;
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (draggingCardAttrRef.current && draggingCardAttrRef.current !== mapping.id) {
                          e.currentTarget.classList.add("border-[#E31E24]", "shadow-md", "ring-2", "ring-[#E31E24]/20");
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("border-[#E31E24]", "shadow-md", "ring-2", "ring-[#E31E24]/20");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromId = draggingCardAttrRef.current || e.dataTransfer.getData("text/plain");
                        clearCardDragStyles();
                        draggingCardAttrRef.current = null;
                        if (fromId && fromId !== mapping.id) {
                          handleReorderMappedAttributes(fromId, mapping.id);
                        }
                      }}
                      className={cn(
                        "mapped-attr-card rounded-lg border bg-white p-4 transition-all",
                        selectedMappingAttributeId === mapping.attributeId
                          ? "border-[#E31E24] ring-2 ring-[#E31E24]/20 shadow-sm"
                          : "border-[#E6E6E6]"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          {canManageAttributes && (
                            <div className="mt-0.5 flex items-center gap-1">
                              <div
                                title="Drag to reorder attribute"
                                className="cursor-grab active:cursor-grabbing text-[#9A9A9A] hover:text-[#1A1A1A] p-0.5 select-none"
                              >
                                <GripVertical size={16} className="pointer-events-none" />
                              </div>
                              {mappedAttributeRows.length > 1 && (
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    title="Move attribute up"
                                    disabled={attrIndex === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveMappedAttributeIdx(attrIndex, attrIndex - 1);
                                    }}
                                    className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-gray-500 hover:bg-gray-200 hover:text-[#E31E24] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 cursor-pointer transition-colors leading-none"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    title="Move attribute down"
                                    disabled={attrIndex === mappedAttributeRows.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveMappedAttributeIdx(attrIndex, attrIndex + 1);
                                    }}
                                    className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-gray-500 hover:bg-gray-200 hover:text-[#E31E24] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 cursor-pointer transition-colors leading-none"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">{mapping.attribute.name}</h4>
                              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", roleBadgeClass(getDisplayTypeRole(mapping.gridAxis)))}>
                                {getDisplayTypeLabel(mapping.gridAxis)}
                              </span>
                              {selectedMappingAttributeId === mapping.attributeId && (
                                <span className="rounded-full bg-[#E31E24] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                                  Editing Now
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {mapping.allowedValues.length ? (
                                mapping.allowedValues.map((allowedValue, valIndex) => (
                                  <span
                                    key={allowedValue.attributeValueId}
                                    className="group inline-flex items-center gap-1 rounded-full border border-[#E2E2E2] bg-[#F7F7F7] pl-2.5 pr-2 py-0.5 text-[11.5px] font-medium text-[#444] hover:bg-white hover:border-gray-300 transition-colors"
                                  >
                                    <span
                                      className="cursor-pointer no-card-drag"
                                      title="Click to edit attribute values"
                                      onClick={() => handleEditMappedAttribute(mapping)}
                                    >
                                      {allowedValue.attributeValue.value}
                                    </span>
                                    {mapping.allowedValues.length > 1 && canManageAttributes && (
                                      <span className="flex items-center gap-0.5 ml-0.5">
                                        {valIndex > 0 && (
                                          <button
                                            type="button"
                                            title="Move value left"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveCardAllowedValue(mapping, valIndex, valIndex - 1);
                                            }}
                                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 text-[10px] font-bold leading-none cursor-pointer"
                                          >
                                            ‹
                                          </button>
                                        )}
                                        {valIndex < mapping.allowedValues.length - 1 && (
                                          <button
                                            type="button"
                                            title="Move value right"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveCardAllowedValue(mapping, valIndex, valIndex + 1);
                                            }}
                                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 text-[10px] font-bold leading-none cursor-pointer"
                                          >
                                            ›
                                          </button>
                                        )}
                                      </span>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded-full bg-[#EBF5FF] text-[#1E40AF] px-2 py-0.5 text-[11.5px] font-medium">All attribute values allowed</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <div className="min-w-[180px]">
                            <AdminSelect
                              value={getDisplayTypeValue(mapping.gridAxis)}
                              disabled={!canManageAttributes}
                              onChange={(e) => {
                                const next = e.target.value as GridAxis | "";
                                handleSetMappedGridAxis(mapping.attributeId, next === "ROW" ? "ROW" : next === "COLUMN" ? "COLUMN" : null);
                              }}
                              options={[
                                { value: "", label: "Dropdown filter" },
                                { value: "COLUMN", label: "Matrix columns" },
                                { value: "ROW", label: "Matrix rows" },
                              ]}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-[12.5px] text-[#555]">
                            <input
                              type="checkbox"
                              checked={mapping.required}
                              onChange={(e) => handleToggleMappedRequired(mapping.attributeId, e.target.checked)}
                              className="h-4 w-4 accent-[#E31E24]"
                              disabled={!canManageAttributes || assignProductAttributes.isPending}
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-2 text-[12.5px] text-[#555]">
                            <input
                              type="checkbox"
                              checked={mapping.visibleOnStorefront !== false}
                              onChange={(e) => handleToggleMappedVisibility(mapping.attributeId, e.target.checked)}
                              className="h-4 w-4 accent-[#E31E24]"
                              disabled={!canManageAttributes || updateProductFilterVisibility.isPending}
                            />
                            Visible on Storefront Filter
                          </label>
                          {canManageAttributes && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditMappedAttribute(mapping)}
                                disabled={removeProductAttribute.isPending || assignProductAttributes.isPending}
                                className={cn(
                                  "rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 cursor-pointer",
                                  selectedMappingAttributeId === mapping.attributeId
                                    ? "border-[#E31E24] bg-red-50 text-[#E31E24] font-semibold"
                                    : "border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5]"
                                )}
                              >
                                {selectedMappingAttributeId === mapping.attributeId ? "Editing" : "Edit"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveProductAttribute(mapping.attributeId)}
                                disabled={removeProductAttribute.isPending}
                                className="rounded-md border border-[#F2C9C9] px-2.5 py-1.5 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>

              {canManageAttributes && (
                <div
                  ref={attributeEditPanelRef}
                  className="rounded-lg border border-[#E6E6E6] bg-white shadow-sm xl:sticky xl:top-20 xl:self-start flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden"
                >
                  <div className="p-4 pb-3 border-b border-[#F0F0F0] shrink-0 bg-white z-10">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[14px] font-bold text-[#1A1A1A]">
                            {mappedAttributeIds.has(selectedMappingAttributeId) ? "Edit Attribute" : "Add Attribute"}
                          </h4>
                          {selectedAttributeDetail && (
                            <span className="rounded-md bg-red-50 border border-red-200 px-2.5 py-0.5 text-[12px] font-bold text-[#E31E24]">
                              {selectedAttributeDetail.name}
                            </span>
                          )}
                        </div>
                        {selectedAttributeDetail ? (
                          <p className="mt-1 text-[11.5px] text-[#6B6B6B]">
                            Attribute: <span className="font-semibold text-[#1A1A1A]">{selectedAttributeDetail.name}</span> &bull; {newMappingValueIds.length} of {selectedAttributeValues.length} selected
                          </p>
                        ) : (
                          <p className="mt-1 text-[11.5px] text-[#6B6B6B]">Select an attribute to map values</p>
                        )}
                      </div>
                      {selectedMappingAttributeId && (
                        <button
                          type="button"
                          onClick={resetAttributeMappingForm}
                          className="rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[11px] font-medium text-[#6B6B6B] hover:bg-gray-50 hover:text-[#1A1A1A] cursor-pointer shrink-0"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    <AdminSelect
                      label="Attribute"
                      value={selectedMappingAttributeId}
                      onChange={(e) => {
                        setSelectedMappingAttributeId(e.target.value);
                        setNewMappingGridAxis(null);
                        setNewMappingValueIds([]);
                        setMappingValueFilter("ALL");
                        setMappingValueSearch("");
                      }}
                      options={[
                        { value: "", label: "Select attribute..." },
                        ...availableMappingAttributes.map((attribute) => ({ value: attribute.id, label: attribute.name })),
                      ]}
                    />
                    <label className="flex items-center gap-2 text-[13px] text-[#555]">
                      <input
                        type="checkbox"
                        checked={newMappingRequired}
                        onChange={(e) => setNewMappingRequired(e.target.checked)}
                        className="h-4 w-4 accent-[#E31E24]"
                      />
                      Required for this product
                    </label>
                    <AdminSelect
                      value={getDisplayTypeValue(newMappingGridAxis)}
                      onChange={(e) => {
                        const next = e.target.value as GridAxis | "";
                        setNewMappingGridAxis(next === "ROW" ? "ROW" : next === "COLUMN" ? "COLUMN" : null);
                      }}
                      options={[
                        { value: "", label: "Dropdown filter" },
                        { value: "COLUMN", label: "Matrix columns" },
                        { value: "ROW", label: "Matrix rows" },
                      ]}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium", roleBadgeClass(getDisplayTypeRole(newMappingGridAxis)))}>
                        {getDisplayTypeLabel(newMappingGridAxis)}
                      </span>
                      <span className="text-[12px] text-[#9A9A9A]">Current display type</span>
                    </div>
                    <p className="text-[12px] leading-5 text-[#9A9A9A]">
                      Product-level display types control the storefront exactly: Dropdown for filtering, Matrix columns for the X axis, and Matrix rows for the Y axis. Multiple row or column attributes are combined automatically. Product Packages are displayed separately as tabs.
                    </p>

                    {selectedMappingAttributeId && selectedAttributeDetail ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", roleBadgeClass(getDisplayTypeRole(newMappingGridAxis)))}>
                            {getDisplayTypeLabel(newMappingGridAxis)}
                          </span>
                          <span className="text-[12px] font-semibold text-[#1A1A1A]">{newMappingValueIds.length} of {selectedAttributeValues.length} selected</span>
                        </div>



                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={selectAllNewMappingValues}
                              className="rounded-full border border-[#E6E6E6] bg-white px-3 py-1 text-[11.5px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={clearAllNewMappingValues}
                              className="rounded-full border border-[#E6E6E6] bg-white px-3 py-1 text-[11.5px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]"
                            >
                              Clear all
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setMappingValueFilter("ALL")}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition",
                                mappingValueFilter === "ALL"
                                  ? "bg-[#1A1A1A] text-white"
                                  : "border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]"
                              )}
                            >
                              All ({selectedAttributeValues.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setMappingValueFilter("SELECTED")}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition",
                                mappingValueFilter === "SELECTED"
                                  ? "bg-[#E31E24] text-white shadow-2xs"
                                  : "border border-red-200 bg-red-50 text-[#E31E24] hover:bg-red-100"
                              )}
                            >
                              Selected ({newMappingValueIds.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setMappingValueFilter("UNSELECTED")}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition",
                                mappingValueFilter === "UNSELECTED"
                                  ? "bg-[#1A1A1A] text-white"
                                  : "border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]"
                              )}
                            >
                              Unselected ({selectedAttributeValues.length - newMappingValueIds.length})
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={mappingValueSearch}
                            onChange={(e) => setMappingValueSearch(e.target.value)}
                            placeholder="Search values..."
                            className="w-full rounded-md border border-[#E6E6E6] bg-white pl-8 pr-7 py-1.5 text-[12px] text-[#1A1A1A] placeholder-gray-400 focus:border-[#E31E24] focus:outline-none"
                          />
                          {mappingValueSearch && (
                            <button
                              type="button"
                              onClick={() => setMappingValueSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                          {filteredAttributeValues.length === 0 ? (
                            <div className="p-4 text-center text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-md">
                              {mappingValueFilter === "SELECTED"
                                ? "No values selected yet. Click 'All' to choose values."
                                : mappingValueFilter === "UNSELECTED"
                                ? "All values are currently selected."
                                : `No values matching "${mappingValueSearch}"`}
                            </div>
                          ) : (
                            <SortableList
                              disabled={mappingValueFilter !== "SELECTED" || newMappingValueIds.length <= 1}
                              className="w-full min-w-0"
                              rowWidthClassName="w-full min-w-0"
                              contentClassName="flex-1 min-w-0"
                              items={filteredAttributeValues}
                              onReorder={handleReorderFilteredValues}
                              renderItem={(value, index) => {
                                const isSelected = newMappingValueIds.includes(value.id);
                                return (
                                  <div
                                    className={cn(
                                      "flex flex-1 items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12.5px] transition-all",
                                      isSelected
                                        ? "border-[#E31E24] bg-red-50/70 font-semibold text-[#1A1A1A] shadow-2xs ring-1 ring-[#E31E24]/20"
                                        : "border-[#E6E6E6] bg-white text-[#4A4A4A] hover:bg-gray-50/60 hover:border-gray-300"
                                    )}
                                  >
                                    <label className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleNewMappingValue(value.id)}
                                        className="h-4 w-4 accent-[#E31E24] cursor-pointer rounded"
                                      />
                                      <span className={cn("truncate", isSelected ? "font-bold text-[#1A1A1A]" : "font-normal text-[#4A4A4A]")}>
                                        {value.value}
                                      </span>
                                    </label>
                                    <div className="flex items-center gap-2 shrink-0 select-none">
                                      {isSelected && (
                                        <span className="rounded-full bg-[#E31E24] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-2xs">
                                          Selected
                                        </span>
                                      )}
                                      {mappingValueFilter === "SELECTED" && newMappingValueIds.length > 1 && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            title="Move up"
                                            disabled={index === 0}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleMoveSelectedItem(index, index - 1);
                                            }}
                                            className="flex h-5 w-5 items-center justify-center rounded border border-[#D5D5D5] bg-white text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            title="Move down"
                                            disabled={index === filteredAttributeValues.length - 1}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleMoveSelectedItem(index, index + 1);
                                            }}
                                            className="flex h-5 w-5 items-center justify-center rounded border border-[#D5D5D5] bg-white text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                          >
                                            ↓
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                          )}
                        </div>

                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-[#E6E6E6] px-3 py-6 text-center text-[12.5px] text-[#9A9A9A]">
                        Select an attribute to choose allowed values.
                      </p>
                    )}
                  </div>
                  {selectedMappingAttributeId && selectedAttributeDetail && (
                    <div className="p-3 border-t border-[#F0F0F0] shrink-0 bg-white">
                      <button
                        type="button"
                        onClick={handleAddProductAttribute}
                        disabled={assignProductAttributes.isPending}
                        className="w-full rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {assignProductAttributes.isPending ? "Saving..." : (mappedAttributeIds.has(selectedMappingAttributeId) ? "Update Attribute" : "Map Attribute")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 9 && (
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country Availability</h3>
                <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#6B6B6B]">
                  Availability controls where this product is visible. New products start invisible everywhere until countries are enabled here.
                  Enabling a country also enables that country on this product's category and active variants so it can appear on the storefront.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-[#9A9A9A]">
                  {(productCountries as CountryAvailability[]).filter((c) => c.status === "ACTIVE").filter((country) => countryOverrides[country.id] ?? country.enabled).length} enabled
                </span>
                <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
                <button
                  type="button"
                  onClick={saveCountryAvailability}
                  disabled={updateProductCountries.isPending || countriesLoading}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                >
                  {updateProductCountries.isPending ? "Saving..." : "Save Availability"}
                </button>
              </div>
            </div>

            {countriesLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-[#F2F2F2]" />
            ) : (productCountries as CountryAvailability[]).length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
                No countries found.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(productCountries as CountryAvailability[]).filter((c) => c.status === "ACTIVE").map((country) => (
                  <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                      <span className="text-[11.5px] text-[#9A9A9A]">{country.code}{country.status !== "ACTIVE" ? ` · ${country.status}` : ""}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#E31E24]"
                      checked={countryOverrides[country.id] ?? country.enabled}
                      onChange={(e) => setCountryOverrides((current) => ({ ...current, [country.id]: e.target.checked }))}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 10 && (
          <div className="p-6 space-y-4">
            <AdminInput label="SEO Title (max 60 chars)" maxLength={60} {...form.getFieldProps("seoTitle")} error={form.errors.seoTitle as string} />
            <div className="text-[12px] text-[#9A9A9A]">{form.values.seoTitle.length}/60 characters</div>
            <AdminTextarea label="SEO Description (max 160 chars)" rows={3} maxLength={160} {...form.getFieldProps("seoDescription")} />
            <div className="text-[12px] text-[#9A9A9A]">{form.values.seoDescription.length}/160 characters</div>
            <AdminInput label="SEO Keywords" placeholder="Comma-separated" {...form.getFieldProps("seoKeywords")} />
            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#F8F8F8] p-4">
              <p className="mb-2 text-[11.5px] font-medium uppercase text-[#9A9A9A]">Google Preview</p>
              <p className="cursor-pointer text-[16px] font-medium text-[#1A0DAB] hover:underline">{form.values.seoTitle || product.title}</p>
              <p className="text-[13px] text-[#006621]">modortho.com › products › {product.slug}</p>
              <p className="mt-1 line-clamp-2 text-[13.5px] text-[#545454]">{form.values.seoDescription || product.shortDescription || "No meta description."}</p>
            </div>
          </div>
        )}

        {activeTab === 11 && (
          <div className="p-6 space-y-5">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Shipping Information</h3>
              <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Package weight and dimensions used by the shipping calculator.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminInput
                label="Package Weight (kg)"
                type="text"
                placeholder="e.g. 0.5"
                value={shippingPackageWeight}
                onChange={(e) => setShippingPackageWeight(e.target.value)}
              />
              <AdminInput
                label="Package Length (cm)"
                type="text"
                placeholder="e.g. 30"
                value={shippingPackageLength}
                onChange={(e) => setShippingPackageLength(e.target.value)}
              />
              <AdminInput
                label="Package Width (cm)"
                type="text"
                placeholder="e.g. 20"
                value={shippingPackageWidth}
                onChange={(e) => setShippingPackageWidth(e.target.value)}
              />
              <AdminInput
                label="Package Height (cm)"
                type="text"
                placeholder="e.g. 10"
                value={shippingPackageHeight}
                onChange={(e) => setShippingPackageHeight(e.target.value)}
              />

              <div className="flex items-end gap-6 pb-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={shippingFragile} onChange={(e) => setShippingFragile(e.target.checked)} className="rounded" />
                  <span className="text-[13.5px] text-[#1A1A1A]">Fragile</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={shippingHazardous} onChange={(e) => setShippingHazardous(e.target.checked)} className="rounded" />
                  <span className="text-[13.5px] text-[#1A1A1A]">Hazardous</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={async () => {
                  setSavingShipping(true);
                  try {
                    await adminApi.put(`/products/${productId}/shipping-info`, {
                      packageWeight: shippingPackageWeight ? Number(shippingPackageWeight) : null,
                      packageLength: shippingPackageLength ? Number(shippingPackageLength) : null,
                      packageWidth: shippingPackageWidth ? Number(shippingPackageWidth) : null,
                      packageHeight: shippingPackageHeight ? Number(shippingPackageHeight) : null,
                      shippingClass: shippingClass || null,
                      fragile: shippingFragile,
                      hazardous: shippingHazardous,
                    });
                    showToast("Shipping info saved.");
                  } catch (error) {
                    showToast(getAdminErrorMessage(error, "Failed to save shipping info."), "error");
                  } finally {
                    setSavingShipping(false);
                  }
                }}
                disabled={savingShipping}
                className="rounded-md bg-[#E31E24] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
              >
                {savingShipping ? "Saving…" : "Save Shipping Info"}
              </button>
            </div>
          </div>
        )}

        {activeTab === 12 && (
          <ProductPaymentOverridesTab
            productId={productId}
            variants={product?.variants || []}
          />
        )}
      </div>
      </fieldset>

      {packageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-full max-w-[720px] max-h-[86vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="shrink-0 border-b border-[#E6E6E6] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[18px] font-semibold text-[#1A1A1A]">{editingPackage ? "Edit Package" : "Create Package"}</h3>
                  <p className="mt-1 text-[13px] text-[#6B6B6B]">Packages are commercial offerings and are not attribute values.</p>
                </div>
                <button onClick={() => setPackageModalOpen(false)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AdminInput label="Title" value={packageTitle} onChange={(e) => setPackageTitle(e.target.value)} />
                <AdminSelect
                  label="Status"
                  value={packageStatus}
                  onChange={(e) => setPackageStatus(e.target.value)}
                  options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
                />
                <div className="sm:col-span-2 space-y-3">
                  <div className="overflow-hidden rounded-lg border border-[#E6E6E6] bg-[#FAFAFA]">
                    {packageImage ? (
                      <div className="border-b border-[#E6E6E6] bg-white p-3">
                        <img src={packageImage} alt="Package preview" className="h-28 w-full rounded-md object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-28 items-center justify-center px-4 text-[12.5px] text-[#9A9A9A]">
                        Upload an image or paste a URL to preview it here.
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#E6E6E6] px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setPackageMediaSelectorOpen(true)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                      >
                        <ImageIcon size={14} />
                        <span>Browse Media Library</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackageImage("")}
                        disabled={!packageImage}
                        className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5] disabled:opacity-40"
                      >
                        Clear image
                      </button>
                    </div>
                  </div>
                  <AdminInput
                    label="Image URL"
                    value={packageImage}
                    onChange={(e) => setPackageImage(e.target.value)}
                    placeholder="Optional image URL"
                  />
                </div>
                <AdminInput label="Sort Order" type="number" value={packageSortOrder} onChange={(e) => setPackageSortOrder(Number(e.target.value) || 0)} />
                <div className="sm:col-span-2">
                  <AdminTextarea label="Description" rows={3} value={packageDescription} onChange={(e) => setPackageDescription(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E6E6E6] bg-white px-6 py-4">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setPackageModalOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
                <button onClick={handleSavePackage} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">{editingPackage ? "Save Package" : "Create Package"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={generateVariantOpen}
        onClose={() => setGenerateVariantOpen(false)}
        title="Generate Variants"
        subtitle={
          hasMappedProductAttributes
            ? "Showing attributes mapped to this product. Add values in Product Attributes before using them here."
            : "No product attribute mappings found, so this uses the full global catalog exactly as before."
        }
        size="3xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <p className="text-[12.5px] text-[#6B6B6B]">Review the selected packages and attribute values before generating variants.</p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setGenerateVariantOpen(false)}
                className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateVariants}
                disabled={generatingVariants}
                className="rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {generatingVariants ? "Generating…" : "Generate Variants"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[12.5px] leading-5 text-blue-800">
            New variants inherit the product-level base inventory and every country inventory override configured in the Inventory tab.
          </div>

          <div className="rounded-lg border border-[#E6E6E6] p-4">
            <div className="mb-1 text-[13px] font-semibold text-[#1A1A1A]">Base Price (optional)</div>
            <p className="mb-3 text-[12.5px] leading-5 text-[#6B6B6B]">
              Enter the base manufacturer price to automatically generate per-country landed prices (including each country&apos;s customs duty and shipping) for these variants as they are created. Leave blank to set prices later.
            </p>
            <AdminInput
              label="Base Price"
              type="text"
              value={generateVariantBasePrice}
              onChange={(event) => setGenerateVariantBasePrice(event.target.value)}
              placeholder="Enter base price (e.g. 100.00)"
            />
          </div>

          <div className="space-y-4">
            {generateAttributeIds.map((attributeId) => {
              const attribute = variantGenerationCatalog.find((item) => item.id === attributeId);
              if (!attribute) return null;
              const selectedValueIds = generateSelectionMap[attribute.id] ?? [];
              const values = getAttributeValues(attribute);

              return (
                <div key={attribute.id} className="rounded-xl border border-[#E6E6E6] bg-white p-5 transition-all duration-200 hover:shadow-xs">
                  {/* Header */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#F5F5F5] pb-3">
                    <div className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#E31E24]"></span>
                      {attribute.name}
                    </div>
                    <div className="flex items-center gap-3">
                      {!hasMappedProductAttributes && (
                        <>
                          <button
                            type="button"
                            onClick={() => removeGenerateAttribute(attribute.id)}
                            className="text-[11px] font-semibold text-[#6B6B6B] hover:text-[#E31E24] transition-colors underline underline-offset-2 cursor-pointer"
                          >
                            Remove
                          </button>
                          <span className="text-[#D1D5DB] text-[10px]">|</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => selectAllGenerateValues(attribute.id)}
                        className="text-[11px] font-semibold text-[#E31E24] hover:text-[#B5151B] transition-colors underline underline-offset-2 cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-[#D1D5DB] text-[10px]">|</span>
                      <button
                        type="button"
                        onClick={() => clearGenerateValues(attribute.id)}
                        className="text-[11px] font-semibold text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors underline underline-offset-2 cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {/* Chips grid */}
                  {values.length === 0 ? (
                    <p className="text-[12px] text-[#9A9A9A] italic">No values found for this attribute. Add values in Admin → Attributes first.</p>
                  ) : (
                    <div>
                      <div className="flex flex-wrap gap-2.5">
                        {values.map((val) => {
                          const isSelected = selectedValueIds.includes(val.id);
                          return (
                            <button
                              key={val.id}
                              type="button"
                              onClick={(e) => toggleGenerateValue(attribute.id, val.id, !isSelected, e.shiftKey)}
                              className={cn(
                                "group relative flex items-center justify-center rounded-lg border px-4 py-2 text-[12.5px] font-medium transition-all duration-200 select-none cursor-pointer",
                                isSelected
                                  ? "border-[#E31E24] bg-[#E31E24] text-white shadow-xs"
                                  : "border-[#E0E0E0] bg-white text-[#4A4A4A] hover:border-[#1A1A1A] hover:bg-[#F9FAFB]"
                              )}
                            >
                              {val.value}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[11.5px] text-[#6B6B6B] font-medium">
                        {selectedValueIds.length} of {values.length} options selected for variant combinations.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={manualVariantOpen}
        onClose={() => setManualVariantOpen(false)}
        title="Create Manual Variant"
        subtitle="Pick a package, add only the relevant attributes, then click values directly."
        size="3xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setManualVariantOpen(false)}
              className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateManualVariant}
              className="rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer"
            >
              {manualVariantAttributeIds.some((attributeId) => (manualVariantModeMap[attributeId] ?? "single") !== "single") ? "Create Variants" : "Create Variant"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#F0E2E2] bg-[#FFF8F8] p-4 text-[12px] text-[#6B6B6B] sm:grid-cols-3">
            <div>
              <div className="font-semibold text-[#1A1A1A]">1. Base Setup</div>
              <div className="mt-1">Choose package, SKU and MOQ.</div>
            </div>
            <div>
              <div className="font-semibold text-[#1A1A1A]">2. Relevant Attributes</div>
              <div className="mt-1">Add only the attributes this variant should use.</div>
            </div>
            <div>
              <div className="font-semibold text-[#1A1A1A]">3. Value Strategy</div>
              <div className="mt-1">
                {manualVariantAttributeIds.some((attributeId) => (manualVariantModeMap[attributeId] ?? "single") !== "single")
                  ? "This will create multiple variants."
                  : "This will create one exact variant."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdminInput label="SKU" value={manualVariantSku} onChange={(e) => setManualVariantSku(e.target.value)} placeholder="Optional custom SKU" />
            <AdminInput label="MOQ" type="number" min={1} value={manualVariantMoq} onChange={(e) => setManualVariantMoq(Math.max(1, Number(e.target.value) || 1))} />
          </div>

          <div className="rounded-lg border border-[#E6E6E6] p-4">
            <div className="mb-1 text-[13px] font-semibold text-[#1A1A1A]">Choose Attributes For This Variant</div>
            <p className="mb-3 text-[12px] text-[#6B6B6B]">Keep this limited to the attributes that actually define the SKU.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <AdminSelect
                  value={manualVariantAttributePicker}
                  onChange={(e) => setManualVariantAttributePicker(e.target.value)}
                  options={[
                    { value: "", label: "Select attribute…" },
                    ...attributeCatalog
                      .filter((attribute) => !manualVariantAttributeIds.includes(attribute.id))
                      .map((attribute) => ({ value: attribute.id, label: attribute.name })),
                  ]}
                />
              </div>
              <button type="button" onClick={addManualVariantAttribute} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] cursor-pointer">
                Add Attribute
              </button>
            </div>

            {manualVariantAttributeIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {manualVariantAttributeIds.map((attributeId) => {
                  const attribute = attributeCatalog.find((item) => item.id === attributeId);
                  if (!attribute) return null;
                  return (
                    <span key={attributeId} className="inline-flex items-center gap-2 rounded-full border border-[#F0D2D2] bg-[#FFF5F5] px-3 py-1.5 text-[12px] font-medium text-[#B5151B]">
                      {attribute.name}
                      <button type="button" onClick={() => removeManualVariantAttribute(attributeId)} className="text-[#D06F6F] hover:text-[#B5151B] cursor-pointer">
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3 text-[12px] text-[#6B6B6B]">
            <span className="font-semibold text-[#1A1A1A]">{manualVariantAttributeIds.length}</span> attributes selected,{" "}
            <span className="font-semibold text-[#1A1A1A]">{manualVariantAttributeIds.reduce((count, attributeId) => count + (manualVariantSelectionMap[attributeId] ?? []).length, 0)}</span> values chosen.
          </div>

          <div className="space-y-4">
            {manualVariantAttributeIds.map((attributeId) => {
              const attribute = attributeCatalog.find((item) => item.id === attributeId);
              if (!attribute) return null;
              const mode = manualVariantModeMap[attribute.id] ?? "single";
              const selectedValueIds = manualVariantSelectionMap[attribute.id] ?? [];
              const values = getAttributeValues(attribute);
              const selectedValues = values.filter((value) => selectedValueIds.includes(value.id));

              return (
                <div key={attribute.id} className="rounded-lg border border-[#E6E6E6] p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#1A1A1A]">{attribute.name} <span className="ml-1 font-normal text-[#9A9A9A]">{attribute.id}</span></div>
                      <p className="mt-1 text-[12px] text-[#6B6B6B]">Choose how this attribute should behave for this variant flow.</p>
                    </div>
                    <button type="button" onClick={() => removeManualVariantAttribute(attribute.id)} className="text-[13px] font-medium text-[#E31E24] hover:text-[#B5151B] cursor-pointer">
                      Remove
                    </button>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      { value: "single", label: "Single Value" },
                      { value: "specific", label: "Specific Values" },
                      { value: "all", label: "All Values" },
                    ].map((option) => {
                      const active = mode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setManualVariantMode(attribute.id, option.value as ManualAttributeMode)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-[12px] font-medium transition cursor-pointer",
                            active ? "border-[#E31E24] bg-red-50 text-[#B5151B]" : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F8F8F8]"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {mode === "all" && (
                    <div className="rounded-md bg-[#FAFAFA] px-3 py-2 text-[12px] text-[#6B6B6B]">
                      All {values.length} values of {attribute.name} will be used.
                    </div>
                  )}

                  {mode !== "all" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-medium text-[#1A1A1A]">Click values to select:</span>
                        {mode === "specific" && (
                          <>
                            <button
                              type="button"
                              onClick={() => selectAllManualVariantValues(attribute.id)}
                              className="rounded-full border border-[#E6E6E6] px-3 py-1 text-[11px] text-[#6B6B6B] hover:bg-[#F5F5F5] cursor-pointer"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() => clearManualVariantValues(attribute.id)}
                              className="rounded-full border border-[#E6E6E6] px-3 py-1 text-[11px] text-[#6B6B6B] hover:bg-[#F5F5F5] cursor-pointer"
                            >
                              Clear
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {values.map((value) => {
                          const selected = selectedValueIds.includes(value.id);
                          return (
                            <button
                              key={value.id}
                              type="button"
                              onClick={() => toggleManualVariantValue(attribute.id, value.id)}
                              className={cn(
                                "rounded-full border px-4 py-2 text-[12px] transition cursor-pointer",
                                selected ? "border-[#E31E24] bg-red-50 text-[#B5151B]" : "border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#FAFAFA]"
                              )}
                            >
                              {value.value}
                            </button>
                          );
                        })}
                      </div>

                      {selectedValues.length > 0 && (
                        <div className="rounded-md bg-[#FAFAFA] px-3 py-2 text-[12px] text-[#6B6B6B]">
                          Selected: {selectedValues.map((value) => value.value).join(", ")}
                        </div>
                      )}

                      {selectedValues.length === 0 && (
                        <p className="text-[12px] text-[#9A9A9A]">
                          {mode === "single" ? "Add exactly one value for this attribute." : "Add one or more values for this attribute."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(variantCountryModalVariant)}
        onClose={closeVariantCountriesModal}
        title="Variant Country Availability"
        subtitle={variantCountryModalVariant ? `Visibility for ${variantCountryModalVariant.title}. New variants start hidden in every country until enabled here.` : undefined}
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={closeVariantCountriesModal}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={saveVariantCountryAvailability}
              loading={updateVariantCountries.isPending || variantCountriesLoading}
              loadingText="Saving..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              Save Availability
            </LoadingButton>
          </div>
        }
      >
        {variantCountryModalVariant && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2">
              <span className="text-[13px] font-medium text-[#1A1A1A]">{variantCountryModalVariant.sku || "No SKU"}</span>
              <span className="text-[12px] text-[#9A9A9A]">
                {(variantCountries as CountryAvailability[]).filter((c) => c.status === "ACTIVE").filter((country) => variantCountryOverrides[country.id] ?? country.enabled).length} enabled
              </span>
            </div>

            {variantCountriesLoading ? (
              <div className="h-28 animate-pulse rounded-md bg-[#F2F2F2]" />
            ) : (variantCountries as CountryAvailability[]).length === 0 ? (
              <p className="rounded-md border border-[#E6E6E6] px-3 py-4 text-[13px] text-[#9A9A9A]">No countries found.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {(variantCountries as CountryAvailability[]).filter((c) => c.status === "ACTIVE").map((country) => (
                  <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2 cursor-pointer hover:bg-[#FAFAFA]">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                      <span className="text-[11.5px] text-[#9A9A9A]">
                        {country.code}{country.currency?.code ? ` - ${country.currency.code}` : ""}{country.status !== "ACTIVE" ? ` - ${country.status}` : ""}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#E31E24]"
                      checked={variantCountryOverrides[country.id] ?? country.enabled}
                      onChange={(e) => setVariantCountryOverrides((current) => ({ ...current, [country.id]: e.target.checked }))}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editingVariant)}
        onClose={closeEditVariantModal}
        title="Edit Variant"
        subtitle="Update variant details, country prices, tier overrides, and MOQ rules."
        size="4xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={closeEditVariantModal}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={handleUpdateVariant}
              loading={isUpdatingVariant}
              loadingText="Saving..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              Save Variant
            </LoadingButton>
          </div>
        }
      >
        {editingVariant && (
          <div className="p-6">
            <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-[#E6E6E6] bg-white p-1 max-w-max">
              {[
                { key: "general", label: "General Info" },
                { key: "prices", label: "Country Prices" },
                { key: "tiers", label: "Tier Overrides" },
                { key: "moqs", label: "MOQ Overrides" },
              ].map((subTab) => (
                <button
                  key={subTab.key}
                  type="button"
                  onClick={() => setEditVariantSubTab(subTab.key as any)}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer",
                    editVariantSubTab === subTab.key ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]"
                  )}
                >
                  {subTab.label}
                </button>
              ))}
            </div>

            {editVariantSubTab === "general" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AdminSelect label="Status" value={editVariantStatus} onChange={(e) => setEditVariantStatus(e.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
                  <AdminInput label="Variant Title" value={editVariantTitle} onChange={(e) => setEditVariantTitle(e.target.value)} placeholder="Optional custom title" />
                  <AdminInput label="SKU" value={editVariantSku} onChange={(e) => setEditVariantSku(e.target.value)} placeholder="Variant SKU" />
                  <AdminInput label="MOQ" type="number" min={1} value={editVariantMoq} onChange={(e) => setEditVariantMoq(Math.max(1, Number(e.target.value) || 1))} />
                </div>

                <div className="rounded-lg border border-[#E6E6E6] p-4 bg-white">
                  <div className="mb-3 text-[13px] font-medium text-[#1A1A1A]">Shipping Information</div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <AdminInput label="Weight (kg)" type="text" placeholder="e.g. 0.5" value={editVariantWeight} onChange={(e) => setEditVariantWeight(e.target.value)} />
                    <AdminInput label="Length (cm)" type="text" placeholder="e.g. 30" value={editVariantLength} onChange={(e) => setEditVariantLength(e.target.value)} />
                    <AdminInput label="Width (cm)" type="text" placeholder="e.g. 20" value={editVariantWidth} onChange={(e) => setEditVariantWidth(e.target.value)} />
                    <AdminInput label="Height (cm)" type="text" placeholder="e.g. 10" value={editVariantHeight} onChange={(e) => setEditVariantHeight(e.target.value)} />

                    <div className="flex items-end gap-6 pb-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={editVariantFragile} onChange={(e) => setEditVariantFragile(e.target.checked)} className="rounded" />
                        <span className="text-[13.5px] text-[#1A1A1A]">Fragile</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={editVariantHazardous} onChange={(e) => setEditVariantHazardous(e.target.checked)} className="rounded" />
                        <span className="text-[13.5px] text-[#1A1A1A]">Hazardous</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-[#E6E6E6] p-4 bg-white">
                  <div className="mb-3 text-[13px] font-medium text-[#1A1A1A]">Used Attributes</div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <AdminSelect
                        value={editVariantAttributePicker}
                        onChange={(e) => setEditVariantAttributePicker(e.target.value)}
                        options={[
                          { value: "", label: "Select attribute…" },
                          ...attributeCatalog
                            .filter((attribute) => !editVariantAttributeIds.includes(attribute.id))
                            .map((attribute) => ({ value: attribute.id, label: attribute.name })),
                        ]}
                      />
                    </div>
                    <button onClick={addEditVariantAttribute} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                      Add Attribute
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {editVariantAttributeIds.map((attributeId) => {
                    const attribute = editVariantAttributeCatalog.get(attributeId);
                    if (!attribute) return null;
                    const values = getAttributeValues(attribute);
                    const selectedValue = resolveEditSelectedValue(attribute.id, values, editVariantSelections, editingVariant);
                    const availableValues = values.filter((value) => value.id !== selectedValue?.id);

                    return (
                      <div key={attribute.id} className="rounded-lg border border-[#E6E6E6] p-4 bg-white">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-semibold text-[#1A1A1A]">{attribute.name}</div>
                            <p className="mt-1 text-[12px] text-[#6B6B6B]">Choose one exact value for this attribute.</p>
                          </div>
                          <button onClick={() => removeEditVariantAttribute(attribute.id)} className="text-[13px] font-medium text-[#E31E24] hover:text-[#B5151B]">
                            Remove
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedValue ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-4 py-2 text-[12px] font-medium text-[#1A1A1A]">
                              {selectedValue.value}
                              <button
                                type="button"
                                onClick={() => setEditVariantSelections((current) => ({ ...current, [attribute.id]: "" }))}
                                className="text-[#9A9A9A] hover:text-[#1A1A1A]"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ) : null}
                          {!selectedValue && availableValues.length > 0 ? (
                            <div className="min-w-[180px]">
                              <AdminSelect
                                value=""
                                onChange={(event) => {
                                  const valueId = event.target.value;
                                  if (!valueId) return;
                                  setEditVariantSelections((current) => ({ ...current, [attribute.id]: valueId }));
                                }}
                                options={[
                                  { value: "", label: "Select value…" },
                                  ...availableValues.map((value) => ({ value: value.id, label: value.value })),
                                ]}
                              />
                            </div>
                          ) : null}
                          {!selectedValue && availableValues.length === 0 ? (
                            <p className="text-[12px] text-[#E31E24]">No values available for this attribute.</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {editVariantSubTab === "prices" && (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {(() => {
                  const countries = (variantCountries as CountryAvailability[]).filter(
                    (c) => c.enabled && (productCountries as CountryAvailability[]).find((pc) => pc.id === c.id)?.enabled
                  );
                  if (countries.length === 0) {
                    return <p className="text-[13px] text-[#9A9A9A] py-4 text-center">No countries enabled for this product/variant. Enable them in Country Availability first.</p>;
                  }
                  return countries.map((country) => {
                    const draft = editVariantCountryPrices[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" };
                    const currencySymbol = country.currency?.symbol ?? "$";
                    const basePrice = productBasePrices.find((p: any) => p.countryId === country.id);
                    const defaultMRP = basePrice?.mrp != null ? String(basePrice.mrp) : "";
                    const defaultSelling = basePrice?.sellingPrice != null ? String(basePrice.sellingPrice) : "";
                    const defaultDealer = basePrice?.dealerPrice != null ? String(basePrice.dealerPrice) : "";
                    const defaultDoctor = basePrice?.distributorPrice != null ? String(basePrice.distributorPrice) : "";
                    const baseInv = getBaseInventory(editingVariant?.inventories);
                    const defaultStock = baseInv?.stock != null ? String(baseInv.stock) : "0";

                    return (
                      <div key={country.id} className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                        <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">{country.name || "Country"} ({country.code || ""})</div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <AdminInput
                            label={`MRP (${currencySymbol})`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.mrp}
                            placeholder={defaultMRP}
                            onChange={(e) => setEditVariantCountryPrices((current) => ({
                              ...current,
                              [country.id]: { ...(current[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" }), mrp: e.target.value }
                            }))}
                          />
                          <AdminInput
                            label={`Selling Price (${currencySymbol})`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.sellingPrice}
                            placeholder={defaultSelling || defaultMRP}
                            onChange={(e) => setEditVariantCountryPrices((current) => ({
                              ...current,
                              [country.id]: { ...(current[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" }), sellingPrice: e.target.value }
                            }))}
                          />
                          <AdminInput
                            label={`Dealer Price (${currencySymbol})`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.dealerPrice}
                            placeholder={defaultDealer}
                            onChange={(e) => setEditVariantCountryPrices((current) => ({
                              ...current,
                              [country.id]: { ...(current[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" }), dealerPrice: e.target.value }
                            }))}
                          />
                          <AdminInput
                            label={`Doc / Ret Price (${currencySymbol})`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.doctorRetailerPrice}
                            placeholder={defaultDoctor}
                            onChange={(e) => setEditVariantCountryPrices((current) => ({
                              ...current,
                              [country.id]: { ...(current[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" }), doctorRetailerPrice: e.target.value }
                            }))}
                          />
                          <AdminInput
                            label="Stock"
                            type="number"
                            min="0"
                            value={draft.stock}
                            placeholder={defaultStock}
                            onChange={(e) => setEditVariantCountryPrices((current) => ({
                              ...current,
                              [country.id]: { ...(current[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" }), stock: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {editVariantSubTab === "tiers" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-4">
                  <div className="mb-3 text-[13.5px] font-semibold text-[#1A1A1A]">Add Tier Override Rule</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <AdminSelect
                      label="Tier"
                      value={modalTierRuleDraft.tierId}
                      onChange={(e) => setModalTierRuleDraft((d) => ({ ...d, tierId: e.target.value }))}
                      options={[{ value: "", label: "Select tier" }, ...tierRows.map((t) => ({ value: t.id, label: t.name }))]}
                    />
                    <AdminSelect
                      label="Country"
                      value={modalTierRuleDraft.countryId}
                      onChange={(e) => setModalTierRuleDraft((d) => ({ ...d, countryId: e.target.value }))}
                      options={[{ value: "", label: "Select country" }, ...(productCountries as CountryAvailability[]).filter((c) => c.enabled).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]}
                    />
                    <AdminSelect
                      label="Mode"
                      value={modalTierRuleDraft.mode}
                      onChange={(e) => setModalTierRuleDraft((d) => ({ ...d, mode: e.target.value as any }))}
                      options={[{ value: "discount", label: "% Discount" }, { value: "fixed", label: "Fixed Price" }]}
                    />
                    <AdminInput
                      label={modalTierRuleDraft.mode === "discount" ? "Discount %" : "Fixed Price"}
                      type="number"
                      min={0}
                      step="0.01"
                      value={modalTierRuleDraft.mode === "discount" ? modalTierRuleDraft.discountPercent : modalTierRuleDraft.fixedPrice}
                      onChange={(e) => setModalTierRuleDraft((d) => ({ ...d, [d.mode === "discount" ? "discountPercent" : "fixedPrice"]: e.target.value }))}
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!modalTierRuleDraft.tierId || !modalTierRuleDraft.countryId) {
                            showToast("Select Tier and Country.", "error");
                            return;
                          }
                          try {
                            const payload = {
                              productId,
                              variantId: editingVariant.id,
                              tierId: modalTierRuleDraft.tierId,
                              countryId: modalTierRuleDraft.countryId,
                              discountPercent: modalTierRuleDraft.mode === "discount" ? Number(modalTierRuleDraft.discountPercent) || 0 : null,
                              fixedPrice: modalTierRuleDraft.mode === "fixed" ? Number(modalTierRuleDraft.fixedPrice) || 0 : null,
                            };
                            await createTierPricing.mutateAsync(payload);
                            showToast("Tier pricing rule added.");
                            setModalTierRuleDraft({ tierId: "", countryId: "", mode: "discount", discountPercent: "", fixedPrice: "" });
                          } catch {
                            showToast("Failed to add rule.", "error");
                          }
                        }}
                        disabled={createTierPricing.isPending}
                        className="w-full rounded-md bg-[#E31E24] py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                      >
                        Add Rule
                      </button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[#E6E6E6] rounded-md border border-[#E6E6E6] bg-white">
                  {(() => {
                    const rules = tierPricingRows.filter((rule) => rule.variant?.id === editingVariant.id);
                    if (rules.length === 0) {
                      return <div className="px-4 py-6 text-center text-[13px] text-[#9A9A9A]">No tier pricing rules configured for this variant.</div>;
                    }
                    return rules.map((rule) => (
                      <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                        <span className="font-medium text-[#1A1A1A]">{rule.tier?.name ?? "Tier"}</span>
                        <span className="text-[#6B6B6B]">{rule.country ? `${rule.country.name} (${rule.country.code})` : "Country"}</span>
                        <span className="ml-auto font-semibold text-[#1A1A1A]">{rule.discountPercent ? `${rule.discountPercent}% off` : `${rule.fixedPrice} fixed`}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteTierPricing.mutateAsync(rule.id);
                              showToast("Rule deleted.");
                            } catch {
                              showToast("Failed to delete rule.", "error");
                            }
                          }}
                          disabled={deleteTierPricing.isPending}
                          className="rounded border border-[#F2C9C9] px-2 py-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {editVariantSubTab === "moqs" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-4">
                  <div className="mb-3 text-[13.5px] font-semibold text-[#1A1A1A]">Add MOQ Override Rule</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <AdminSelect
                      label="Country"
                      value={modalMoqRuleDraft.countryId}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, countryId: e.target.value }))}
                      options={[{ value: "", label: "Select country" }, ...(productCountries as CountryAvailability[]).filter((c) => c.enabled).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]}
                    />
                    <AdminInput
                      label="Min Qty"
                      type="number"
                      min={1}
                      value={modalMoqRuleDraft.minQuantity}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, minQuantity: e.target.value }))}
                    />
                    <AdminInput
                      label="Max Qty"
                      type="number"
                      min={1}
                      placeholder="None"
                      value={modalMoqRuleDraft.maxQuantity}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, maxQuantity: e.target.value }))}
                    />
                    <AdminSelect
                      label="Mode"
                      value={modalMoqRuleDraft.mode}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, mode: e.target.value as any }))}
                      options={[{ value: "discount", label: "% Discount" }, { value: "fixed", label: "Fixed Price" }]}
                    />
                    <AdminInput
                      label={modalMoqRuleDraft.mode === "discount" ? "Discount %" : "Fixed Price"}
                      type="number"
                      min={0}
                      step="0.01"
                      value={modalMoqRuleDraft.mode === "discount" ? modalMoqRuleDraft.discountPercent : modalMoqRuleDraft.fixedPrice}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, [d.mode === "discount" ? "discountPercent" : "fixedPrice"]: e.target.value }))}
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!modalMoqRuleDraft.countryId || !modalMoqRuleDraft.minQuantity) {
                            showToast("Select Country and Min Qty.", "error");
                            return;
                          }
                          try {
                            const payload = {
                              productId,
                              variantId: editingVariant.id,
                              countryId: modalMoqRuleDraft.countryId,
                              minQuantity: Number(modalMoqRuleDraft.minQuantity) || 1,
                              maxQuantity: modalMoqRuleDraft.maxQuantity ? Number(modalMoqRuleDraft.maxQuantity) : null,
                              discountPercent: modalMoqRuleDraft.mode === "discount" ? Number(modalMoqRuleDraft.discountPercent) || 0 : null,
                              fixedPrice: modalMoqRuleDraft.mode === "fixed" ? Number(modalMoqRuleDraft.fixedPrice) || 0 : null,
                            };
                            await createMoqPricing.mutateAsync(payload);
                            showToast("MOQ pricing rule added.");
                            setModalMoqRuleDraft({ countryId: "", minQuantity: "", maxQuantity: "", mode: "discount", discountPercent: "", fixedPrice: "" });
                          } catch {
                            showToast("Failed to add rule.", "error");
                          }
                        }}
                        disabled={createMoqPricing.isPending}
                        className="w-full rounded-md bg-[#E31E24] py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                      >
                        Add Rule
                      </button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[#E6E6E6] rounded-md border border-[#E6E6E6] bg-white">
                  {(() => {
                    const rules = moqPricingRows.filter((rule) => rule.variant?.id === editingVariant.id);
                    if (rules.length === 0) {
                      return <div className="px-4 py-6 text-center text-[13px] text-[#9A9A9A]">No MOQ pricing rules configured for this variant.</div>;
                    }
                    return rules.map((rule) => (
                      <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                        <span className="font-medium text-[#1A1A1A]">{rule.minQuantity}{rule.maxQuantity ? ` - ${rule.maxQuantity}` : '+'} units</span>
                        <span className="text-[#6B6B6B]">{rule.country ? `${rule.country.name} (${rule.country.code})` : "Country"}</span>
                        <span className="ml-auto font-semibold text-[#1A1A1A]">{rule.discountPercent ? `${rule.discountPercent}% off` : `${rule.fixedPrice} fixed`}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteMoqPricing.mutateAsync(rule.id);
                              showToast("Rule deleted.");
                            } catch {
                              showToast("Failed to delete rule.", "error");
                            }
                          }}
                          disabled={deleteMoqPricing.isPending}
                          className="rounded border border-[#F2C9C9] px-2 py-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deletingMedia}
        title="Delete this image?"
        message="This will permanently remove the file from storage."
        onConfirm={() => deletingMedia && handleDeleteMedia(deletingMedia)}
        onCancel={() => setDeletingMedia(null)}
      />

      <ConfirmModal
        open={deletingBulkMedia}
        title={`Delete ${selectedMediaIds.size} selected image(s)?`}
        message="This will permanently remove all selected product images from storage. This action cannot be undone."
        onConfirm={handleBulkDeleteMedia}
        onCancel={() => setDeletingBulkMedia(false)}
      />

      <ConfirmModal
        open={deletingAllMedia}
        title="Delete all product images?"
        message={`This will permanently remove all ${(product?.media ?? []).length} images for this product from storage. This action cannot be undone.`}
        onConfirm={() => handleDeleteAllMedia((product?.media ?? []).map((m: any) => m.id).filter(Boolean))}
        onCancel={() => setDeletingAllMedia(false)}
      />

      {previewMediaIndex !== null && (product?.media ?? [])[previewMediaIndex] && (
        <Modal
          open={previewMediaIndex !== null}
          onClose={() => setPreviewMediaIndex(null)}
          title={`Product Image ${previewMediaIndex + 1} of ${(product?.media ?? []).length}`}
          panelClassName="max-w-4xl"
        >
          <div className="flex flex-col items-center p-6">
            {/* Image viewer container with Nav Arrows */}
            <div className="relative flex min-h-[350px] max-h-[60vh] w-full items-center justify-center rounded-xl bg-[#F7F7F7] p-4">
              <img
                src={(product?.media ?? [])[previewMediaIndex].url}
                alt={(product?.media ?? [])[previewMediaIndex].altText ?? product.title}
                className="max-h-[55vh] max-w-full rounded-lg object-contain shadow-sm"
              />

              {/* Prev Button */}
              {(product?.media ?? []).length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewMediaIndex((prev) =>
                      prev === null ? null : (prev - 1 + (product?.media ?? []).length) % (product?.media ?? []).length
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1A1A1A] shadow-md hover:bg-white transition-transform active:scale-95"
                  title="Previous image (Left Arrow)"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* Next Button */}
              {(product?.media ?? []).length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewMediaIndex((prev) =>
                      prev === null ? null : (prev + 1) % (product?.media ?? []).length
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1A1A1A] shadow-md hover:bg-white transition-transform active:scale-95"
                  title="Next image (Right Arrow)"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Image Info & Actions Footer */}
            <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-4 border-t border-[#E6E6E6] pt-4">
              <div className="truncate">
                <p className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">
                  {(product?.media ?? [])[previewMediaIndex].altText || `Image ${previewMediaIndex + 1}`}
                </p>
                <p className="text-[12px] text-[#9A9A9A]">
                  {previewMediaIndex === 0 ? "Cover / Primary Image" : `Gallery Position #${previewMediaIndex + 1}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {previewMediaIndex !== 0 && (product?.media ?? [])[previewMediaIndex!]?.id && (
                  <button
                    type="button"
                    disabled={settingCoverMediaId !== null}
                    onClick={async () => {
                      const currentId = (product?.media ?? [])[previewMediaIndex!]?.id;
                      if (currentId) {
                        await handleSetCoverMedia(currentId);
                        setPreviewMediaIndex(0);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2 text-[13px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                    title="Set as cover photo"
                  >
                    {settingCoverMediaId ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                    Set as Cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const currentId = (product?.media ?? [])[previewMediaIndex!]?.id;
                    setPreviewMediaIndex(null);
                    if (currentId) setDeletingMedia(currentId);
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-[#F2C9C9] bg-white px-3.5 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete Image
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMediaIndex(null)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal
        open={!!deletingPackage}
        title="Delete this package?"
        message={deletingPackage ? `This will hide "${deletingPackage.title}" from active package lists.` : ""}
        onConfirm={() => deletingPackage && handleDeletePackage(deletingPackage.id)}
        onCancel={() => setDeletingPackage(null)}
      />

      <ConfirmModal
        open={!!deletingVariant}
        title="Delete this variant?"
        message={deletingVariant ? `This will soft delete "${deletingVariant.title}" and remove it from the active variant list.` : ""}
        onConfirm={() => deletingVariant && handleDeleteVariant(deletingVariant.id)}
        onCancel={() => setDeletingVariant(null)}
      />

      <ConfirmModal
        open={!!deletingInventoryAssignment}
        title="Remove warehouse assignment?"
        message={deletingInventoryAssignment ? `This will unassign and remove the stock allocation for ${deletingInventoryAssignment.warehouseName}.` : ""}
        onConfirm={confirmDeleteInventoryAssignment}
        onCancel={() => setDeletingInventoryAssignment(null)}
      />

      <ConfirmModal
        open={showBulkDeleteInventoryModal}
        title="Delete selected warehouse assignments?"
        message={`This will remove ${selectedInvIds.length} selected warehouse stock allocation(s).`}
        onConfirm={confirmBulkDeleteInventory}
        onCancel={() => setShowBulkDeleteInventoryModal(false)}
      />

      <ConfirmModal
        open={!!deletingPriceId}
        title="Delete this country price?"
        message="This will remove the base pricing for this country."
        onConfirm={confirmDeleteProductPrice}
        onCancel={() => setDeletingPriceId(null)}
      />

      <ConfirmModal
        open={deletingBulkPrices}
        title="Delete selected base prices?"
        message={`This will remove ${selectedPriceIds.length} selected country base price(s).`}
        onConfirm={confirmBulkDeletePrices}
        onCancel={() => setDeletingBulkPrices(false)}
      />

      <ConfirmModal
        open={deletingBulkVariantPrices}
        title="Delete selected variant price overrides?"
        message={`This will remove ${selectedVPIds.length} selected variant price override(s). Base prices will remain intact.`}
        onConfirm={confirmBulkDeleteVariantPrices}
        onCancel={() => setDeletingBulkVariantPrices(false)}
      />

      <ConfirmModal
        open={deletingAllBasePrices}
        title="Delete all country base prices?"
        message={`Are you sure you want to delete ALL ${productBasePrices.length} country base price(s) for this product?`}
        onConfirm={confirmDeleteAllBasePrices}
        onCancel={() => setDeletingAllBasePrices(false)}
      />

      <ConfirmModal
        open={deletingBulkVariantsModal}
        title="Delete selected variants?"
        message={`This will soft-delete ${selectedVariantIds.length} selected variant(s) and remove them from the active list.`}
        onConfirm={confirmBulkDeleteVariants}
        onCancel={() => setDeletingBulkVariantsModal(false)}
      />

      <Modal
        open={warehouseAssignModalOpen}
        onClose={() => { setWarehouseAssignModalOpen(false); setInvBulkActionType("Bulk Action"); }}
        title="Assign Selected Variants to Warehouses"
        panelClassName="max-w-md"
      >
        <div className="space-y-4 p-6">
          <p className="text-[13px] text-[#6B6B6B]">
            Select which warehouses you want to assign the selected variants to, and optionally specify their initial stock levels.
          </p>
          <div className="max-h-[300px] overflow-y-auto border border-[#E6E6E6] rounded-md divide-y divide-[#E6E6E6] px-4 bg-white">
            {(warehouses.data ?? warehouses).map((w: any) => (
              <div key={w.id} className="flex items-center justify-between py-3 gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-[13px] text-[#1A1A1A] font-medium min-w-0">
                  <input
                    type="checkbox"
                    checked={warehouseAssignSelections[w.id] || false}
                    onChange={(e) => setWarehouseAssignSelections(prev => ({ ...prev, [w.id]: e.target.checked }))}
                    className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                  />
                  <span className="truncate">
                    {w.name} {w.state ? `(${w.state})` : ''} {w.country?.code ? `[${w.country.code}]` : ''}
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Stock"
                  disabled={!warehouseAssignSelections[w.id]}
                  value={warehouseAssignStocks[w.id] ?? ""}
                  onChange={(event) => setWarehouseAssignStocks(prev => ({ ...prev, [w.id]: event.target.value }))}
                  className="w-24 h-8 px-2 rounded-md border border-[#E6E6E6] text-[12.5px] outline-none disabled:bg-[#FAFAFA] text-center focus:border-[#E31E24]"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { setWarehouseAssignModalOpen(false); setInvBulkActionType("Bulk Action"); }}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleWarehouseAssignSubmit}
              disabled={bulkSaving}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
            >
              {bulkSaving ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={countryPriceModalOpen}
        onClose={closeCountryPriceModal}
        title="Generate Country Prices"
        panelClassName="max-w-3xl"
      >
        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-[#E0E7FF] bg-[#F8FAFC] p-3.5 flex items-start gap-3">
            <Info size={18} className="text-[#4F46E5] shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-[#334155] leading-relaxed">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#1E293B]">
                  Base Currency: {baseCurrency.name} ({baseCurrency.code} {baseCurrency.symbol})
                </span>
                <a
                  href="/admin/currencies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11.5px] font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-0.5"
                >
                  Manage Currencies ↗
                </a>
              </div>
              <p className="mt-0.5 text-[#64748B]">
                Enter base prices below in <strong>{baseCurrency.code} ({baseCurrency.symbol})</strong>. Country prices will be generated automatically using configured exchange rates. Set variant overrides below if needed.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminInput
              label={`Base MRP (${baseCurrency.code} ${baseCurrency.symbol})`}
              type="number"
              min="0"
              step="0.01"
              value={countryPriceMRP}
              onChange={(event) => setCountryPriceMRP(event.target.value)}
              placeholder={`Enter base MRP in ${baseCurrency.code}`}
            />
            <AdminInput
              label={`Base Selling Price (optional) (${baseCurrency.code} ${baseCurrency.symbol})`}
              type="number"
              min="0"
              step="0.01"
              value={countryPriceSellingPrice}
              onChange={(event) => setCountryPriceSellingPrice(event.target.value)}
              placeholder={`Same as MRP (${baseCurrency.code})`}
            />
            <AdminInput
              label={`Base Dealer Price (optional) (${baseCurrency.code} ${baseCurrency.symbol})`}
              type="number"
              min="0"
              step="0.01"
              value={countryPriceDealerPrice}
              onChange={(event) => setCountryPriceDealerPrice(event.target.value)}
              placeholder={`Not set (${baseCurrency.code})`}
            />
            <AdminInput
              label={`Base Doctor / Retailer Price (optional) (${baseCurrency.code} ${baseCurrency.symbol})`}
              type="number"
              min="0"
              step="0.01"
              value={countryPriceDistributorPrice}
              onChange={(event) => setCountryPriceDistributorPrice(event.target.value)}
              placeholder={`Not set (${baseCurrency.code})`}
            />
          </div>

          {variantRows.length > 0 ? (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#1A1A1A]">
                  Per-variant overrides ({baseCurrency.code})
                </span>
                <button
                  type="button"
                  onClick={applyMRPToAllVariants}
                  disabled={!countryPriceMRP}
                  className="text-[12.5px] font-medium text-[#E31E24] hover:underline disabled:opacity-40"
                >
                  Apply base prices to all variants
                </button>
              </div>

              {variantRows.length > 3 ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                    <input
                      type="text"
                      value={variantSearchQuery}
                      onChange={(event) => setVariantSearchQuery(event.target.value)}
                      placeholder="Search variants by title or SKU..."
                      className="h-8.5 w-full rounded-md border border-[#E6E6E6] bg-white pl-8 pr-3 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                  <span className="text-[12px] font-medium text-[#6B6B6B] shrink-0">
                    {variantSearchQuery.trim()
                      ? `Showing ${variantRows.filter((v) => v.title.toLowerCase().includes(variantSearchQuery.toLowerCase().trim()) || (v.sku && v.sku.toLowerCase().includes(variantSearchQuery.toLowerCase().trim()))).length} of ${variantRows.length} variants`
                      : `${variantRows.length} variants`}
                  </span>
                </div>
              ) : null}

              <div className="max-h-56 overflow-y-auto rounded-lg border border-[#E6E6E6]">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-[#F7F7F7] text-[12px] text-[#6B6B6B] shadow-sm">
                    <tr>
                      <th className="px-3.5 py-2.5 text-left font-medium">Variant</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">MRP ({baseCurrency.code})</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Selling Price ({baseCurrency.code})</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Dealer Price ({baseCurrency.code})</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Doctor Price ({baseCurrency.code})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {variantRows
                      .filter((variant) => {
                        if (!variantSearchQuery.trim()) return true;
                        const q = variantSearchQuery.toLowerCase().trim();
                        return variant.title.toLowerCase().includes(q) || (variant.sku && variant.sku.toLowerCase().includes(q));
                      })
                      .map((variant) => (
                        <tr key={variant.id} className="hover:bg-[#FAFAFA]">
                          <td className="px-3.5 py-2.5 text-[#1A1A1A] font-medium">{variant.title}{variant.sku ? ` (${variant.sku})` : ""}</td>
                          <td className="px-3.5 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variantPriceOverrides[variant.id]?.mrp ?? ""}
                              onChange={(event) =>
                                setVariantPriceOverrides((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...current[variant.id],
                                    mrp: event.target.value,
                                  },
                                }))
                              }
                              placeholder={countryPriceMRP || "0"}
                              className="h-9 w-20 rounded-md border border-[#E6E6E6] px-2.5 text-right text-[13px] outline-none focus:border-[#E31E24]"
                            />
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variantPriceOverrides[variant.id]?.sellingPrice ?? ""}
                              onChange={(event) =>
                                setVariantPriceOverrides((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...current[variant.id],
                                    sellingPrice: event.target.value,
                                  },
                                }))
                              }
                              placeholder={countryPriceSellingPrice || "Same as MRP"}
                              className="h-9 w-24 rounded-md border border-[#E6E6E6] px-2.5 text-right text-[13px] outline-none focus:border-[#E31E24]"
                            />
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variantPriceOverrides[variant.id]?.dealerPrice ?? ""}
                              onChange={(event) =>
                                setVariantPriceOverrides((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...current[variant.id],
                                    dealerPrice: event.target.value,
                                  },
                                }))
                              }
                              placeholder={countryPriceDealerPrice || "Not set"}
                              className="h-9 w-20 rounded-md border border-[#E6E6E6] px-2.5 text-right text-[13px] outline-none focus:border-[#E31E24]"
                            />
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variantPriceOverrides[variant.id]?.distributorPrice ?? ""}
                              onChange={(event) =>
                                setVariantPriceOverrides((current) => ({
                                  ...current,
                                  [variant.id]: {
                                    ...current[variant.id],
                                    distributorPrice: event.target.value,
                                  },
                                }))
                              }
                              placeholder={countryPriceDistributorPrice || "Not set"}
                              className="h-9 w-20 rounded-md border border-[#E6E6E6] px-2.5 text-right text-[13px] outline-none focus:border-[#E31E24]"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-[#E6E6E6] pt-4">
            <button
              type="button"
              onClick={closeCountryPriceModal}
              disabled={generatingCountryPrices}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerateCountryPrices}
              disabled={generatingCountryPrices}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
            >
              {generatingCountryPrices ? "Generating..." : "Generate Prices"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editingProductPrice !== null}
        onClose={() => setEditingProductPrice(null)}
        title={`Edit Base Price - ${editingProductPrice?.country.name}`}
        panelClassName="max-w-md"
      >
        <form onSubmit={handleSaveProductPrice} className="space-y-5 p-6">
          <AdminInput
            label="MRP"
            type="number"
            min="0"
            step="0.01"
            value={editPriceForm.mrp}
            onChange={(e) => setEditPriceForm((f) => ({ ...f, mrp: e.target.value }))}
            required
          />
          <AdminInput
            label="Selling Price"
            type="number"
            min="0"
            step="0.01"
            value={editPriceForm.sellingPrice}
            onChange={(e) => setEditPriceForm((f) => ({ ...f, sellingPrice: e.target.value }))}
            required
          />
          <AdminInput
            label="Dealer Price"
            type="number"
            min="0"
            step="0.01"
            value={editPriceForm.dealerPrice}
            onChange={(e) => setEditPriceForm((f) => ({ ...f, dealerPrice: e.target.value }))}
          />
          <AdminInput
            label="Doctor / Retailer Price"
            type="number"
            min="0"
            step="0.01"
            value={editPriceForm.distributorPrice}
            onChange={(e) => setEditPriceForm((f) => ({ ...f, distributorPrice: e.target.value }))}
          />
          <AdminSelect
            label="Status"
            value={editPriceForm.status}
            onChange={(e) => setEditPriceForm((f) => ({ ...f, status: e.target.value }))}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
          <div className="flex items-center justify-end gap-3 border-t border-[#E6E6E6] pt-4 mt-2">
            <button
              type="button"
              onClick={() => setEditingProductPrice(null)}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={bulkEditPricesModalOpen}
        onClose={() => setBulkEditPricesModalOpen(false)}
        title={`Bulk Edit ${selectedPriceIds.length} Base Price(s)`}
        panelClassName="max-w-md"
      >
        <form onSubmit={handleSaveBulkEditPrices} className="space-y-5 p-6">
          <p className="text-[13px] leading-5 text-[#6B6B6B]">
            Select the fields you want to update in bulk for the selected countries.
          </p>

          <div className="space-y-3 rounded-lg border border-[#E6E6E6] bg-white p-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={bulkEditPricesForm.updateMrp}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, updateMrp: e.target.checked }))}
                  className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                />
                Update MRP
              </label>
              {bulkEditPricesForm.updateMrp && (
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkEditPricesForm.mrp}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, mrp: e.target.value }))}
                  required
                  placeholder="Enter new MRP"
                />
              )}
            </div>

            <div className="space-y-2 border-t border-[#F2F2F2] pt-2">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={bulkEditPricesForm.updateSellingPrice}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, updateSellingPrice: e.target.checked }))}
                  className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                />
                Update Selling Price
              </label>
              {bulkEditPricesForm.updateSellingPrice && (
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkEditPricesForm.sellingPrice}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                  required
                  placeholder="Enter new Selling Price"
                />
              )}
            </div>

            <div className="space-y-2 border-t border-[#F2F2F2] pt-2">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={bulkEditPricesForm.updateDealerPrice}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, updateDealerPrice: e.target.checked }))}
                  className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                />
                Update Dealer Price
              </label>
              {bulkEditPricesForm.updateDealerPrice && (
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkEditPricesForm.dealerPrice}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, dealerPrice: e.target.value }))}
                  placeholder="Enter new Dealer Price (or leave blank for null)"
                />
              )}
            </div>

            <div className="space-y-2 border-t border-[#F2F2F2] pt-2">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={bulkEditPricesForm.updateDistributorPrice}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, updateDistributorPrice: e.target.checked }))}
                  className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                />
                Update Doctor / Retailer Price
              </label>
              {bulkEditPricesForm.updateDistributorPrice && (
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkEditPricesForm.distributorPrice}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, distributorPrice: e.target.value }))}
                  placeholder="Enter new Doctor / Retailer Price (or leave blank for null)"
                />
              )}
            </div>

            <div className="space-y-2 border-t border-[#F2F2F2] pt-2">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={bulkEditPricesForm.updateStatus}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, updateStatus: e.target.checked }))}
                  className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                />
                Update Status
              </label>
              {bulkEditPricesForm.updateStatus && (
                <AdminSelect
                  value={bulkEditPricesForm.status}
                  onChange={(e) => setBulkEditPricesForm((f) => ({ ...f, status: e.target.value }))}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E6E6E6] pt-4 mt-2">
            <button
              type="button"
              onClick={() => setBulkEditPricesModalOpen(false)}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              Save Bulk Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Variant Import Wizard */}
      <BulkVariantImportWizard
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        productId={productId}
        productName={product?.title || ""}
        attributeNames={productAttributeMappings.map((m: any) => m.attribute?.name).filter(Boolean)}
        attributeMappings={productAttributeMappings}
        onSuccess={() => {
          refetch();
          showToast("Variants imported successfully!", "success");
        }}
      />

      {bulkPriceUpdateModalContext !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[480px] rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-[#1A1A1A]">Bulk Update Prices</h2>
            <p className="mb-6 text-[13px] text-[#6B6B6B]">
              {bulkPriceUpdateModalContext === "variants" ? (
                <>
                  Enter the base prices in <strong>{baseCurrency.name} ({baseCurrency.code} {baseCurrency.symbol})</strong> for the selected {selectedVariantIds.length} variant(s).<br/>
                  They will be automatically converted for your selected countries using active exchange rates. Leave fields blank to keep current values.
                </>
              ) : (
                <>
                  Enter the prices for the selected {bulkPriceUpdateModalContext === "base" ? selectedPriceIds.length : selectedVPIds.length} price row(s).<br/>
                  Leave fields blank to keep current values.
                </>
              )}
            </p>

            {bulkPriceUpdateModalContext === "variants" && (
              <div className="z-[99999] relative mb-6">
                <AdminMultiSelect
                  label="Target Countries"
                  options={[
                    { value: "ALL_COUNTRIES", label: "All Enabled Countries" },
                    ...bulkCountryOptions.map((c) => ({ value: c.id, label: c.label }))
                  ]}
                  value={modalCountryIds}
                  onChange={(next) => setModalCountryIds(next)}
                  placeholder="Select Countries"
                />
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (bulkPriceUpdateModalContext === "variants" && !selectedVariantIds.length) {
                showToast("Please select at least one variant.", "error");
                return;
              }
              if (bulkPriceUpdateModalContext === "base" && !selectedPriceIds.length) {
                showToast("Please select at least one price row.", "error");
                return;
              }
              if (bulkPriceUpdateModalContext === "variant_prices" && !selectedVPIds.length) {
                showToast("Please select at least one variant price row.", "error");
                return;
              }
              const hasValues = 
                bulkPriceUpdateDraft.mrp.trim() || 
                bulkPriceUpdateDraft.sellingPrice.trim() || 
                bulkPriceUpdateDraft.dealerPrice.trim() || 
                bulkPriceUpdateDraft.doctorRetailerPrice.trim();
          
              if (!hasValues) {
                showToast("Please enter at least one price to update.", "error");
                return;
              }
          
              setBulkSaving(true);
              try {
                if (bulkPriceUpdateModalContext === "base" || bulkPriceUpdateModalContext === "variant_prices") {
                  const targetIds = bulkPriceUpdateModalContext === "base" ? selectedPriceIds : selectedVPIds;
                  const payload: any = {};
                  let mrpRate: number | null = parseFloat(bulkPriceUpdateDraft.mrp);
                  if (!isNaN(mrpRate)) payload.mrp = mrpRate;
                  let sellingRate: number | null = parseFloat(bulkPriceUpdateDraft.sellingPrice);
                  if (!isNaN(sellingRate)) payload.sellingPrice = sellingRate;
                  let dealerRate: number | null = parseFloat(bulkPriceUpdateDraft.dealerPrice);
                  if (!isNaN(dealerRate)) payload.dealerPrice = dealerRate;
                  let docRate: number | null = parseFloat(bulkPriceUpdateDraft.doctorRetailerPrice);
                  if (!isNaN(docRate)) payload.distributorPrice = docRate;
  
                  await Promise.all(
                    targetIds.map(async (id) => {
                      if (id.startsWith("base-")) {
                        const row = productVariantPrices.find((p: any) => p.id === id);
                        if (row) {
                          return adminApi.post('/pricing', {
                            productId: productId,
                            variantId: row.variantId,
                            countryId: row.countryId,
                            status: "ACTIVE",
                            ...payload
                          });
                        }
                      } else {
                        return adminApi.put(`/pricing/${id}`, payload);
                      }
                    })
                  );
                  showToast(`Successfully updated ${targetIds.length} price(s).`, "success");
                  
                  if (bulkPriceUpdateModalContext === "base") {
                    setSelectedPriceIds([]);
                    setPriceBulkActionType("Bulk Action");
                  } else {
                    setSelectedVPIds([]);
                    setVpBulkActionType("Bulk Action");
                  }
                  
                  setBulkPriceUpdateModalContext(null);
                  setBulkPriceUpdateDraft({ mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "" });
                  refetch();
                  return;
                }

                let countriesToUpdate = modalCountryIds.length > 0 ? modalCountryIds : ["ALL_COUNTRIES"];
                
                // If "ALL_COUNTRIES" is selected, expand it to all enabled country IDs for this product
                if (countriesToUpdate.includes("ALL_COUNTRIES")) {
                  const allIds = (productCountries as CountryAvailability[]).filter(c => c.enabled).map(c => c.id);
                  countriesToUpdate = Array.from(new Set([...countriesToUpdate.filter(id => id !== "ALL_COUNTRIES"), ...allIds]));
                }
                
                const updates = selectedVariantIds.flatMap((id) => {
                  const basePrice = productVariantPrices.find((p: any) => p.variantId === id && p.countryId === product?.defaultCountryId);
                  
                  return countriesToUpdate.map(cid => {
                    let mrpRate: number | null = parseFloat(bulkPriceUpdateDraft.mrp);
                    if (isNaN(mrpRate)) mrpRate = basePrice?.mrp ? parseFloat(basePrice.mrp) : null;
                    
                    let sellingRate: number | null = parseFloat(bulkPriceUpdateDraft.sellingPrice);
                    if (isNaN(sellingRate)) sellingRate = basePrice?.sellingPrice ? parseFloat(basePrice.sellingPrice) : null;
                    
                    let dealerRate: number | null = parseFloat(bulkPriceUpdateDraft.dealerPrice);
                    if (isNaN(dealerRate)) dealerRate = basePrice?.dealerPrice ? parseFloat(basePrice.dealerPrice) : null;
                    
                    let docRate: number | null = parseFloat(bulkPriceUpdateDraft.doctorRetailerPrice);
                    if (isNaN(docRate)) docRate = basePrice?.distributorPrice ? parseFloat(basePrice.distributorPrice) : null;
          
                    const countryObj = (productCountries as CountryAvailability[]).find(c => c.id === cid);
                    if (countryObj?.currency?.exchangeRate) {
                      const exRate = parseFloat(String(countryObj.currency.exchangeRate));
                      if (!isNaN(exRate)) {
                        if (mrpRate !== null) mrpRate = parseFloat((mrpRate * exRate).toFixed(2));
                        if (sellingRate !== null) sellingRate = parseFloat((sellingRate * exRate).toFixed(2));
                        if (dealerRate !== null) dealerRate = parseFloat((dealerRate * exRate).toFixed(2));
                        if (docRate !== null) docRate = parseFloat((docRate * exRate).toFixed(2));
                      }
                    }
          
                    const priceObj: any = {};
                    if (mrpRate !== null) priceObj.mrp = mrpRate;
                    if (sellingRate !== null) priceObj.sellingPrice = sellingRate;
                    if (dealerRate !== null) priceObj.dealerPrice = dealerRate;
                    if (docRate !== null) priceObj.distributorPrice = docRate;
                    
                    return {
                      variantId: id,
                      price: priceObj,
                      countryId: cid,
                    };
                  });
                });
          
                const response = await adminApi.put(`/products/${productId}/variants/bulk`, { updates });
                
                const results = response.data?.data?.results || [];
                const failedRows = results.filter((r: any) => !r.success);
                
                if (failedRows.length > 0) {
                  const errorMsg = failedRows[0].error || "Some prices could not be updated.";
                  showToast(`Completed with errors: ${errorMsg} (${failedRows.length} failed)`, "error");
                } else {
                  showToast("Prices updated successfully.", "success");
                }

                setBulkPriceUpdateModalContext(null);
                setBulkPriceUpdateDraft({ mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "" });
                setModalCountryIds(["ALL_COUNTRIES"]);
                setSelectedVariantIds([]);
                setBulkActionValue("");
                refetch();
              } catch (error) {
                showToast(getAdminErrorMessage(error, "Failed to perform bulk price action."), "error");
              } finally {
                setBulkSaving(false);
              }
            }}>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#1A1A1A]">
                    MRP {bulkPriceUpdateModalContext === "variants" ? `(${baseCurrency.code} ${baseCurrency.symbol})` : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 150.00"
                    value={bulkPriceUpdateDraft.mrp}
                    onChange={(e) => setBulkPriceUpdateDraft({ ...bulkPriceUpdateDraft, mrp: e.target.value })}
                    className="w-full rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13.5px] outline-none focus:border-[#E31E24]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#1A1A1A]">
                    Selling Price {bulkPriceUpdateModalContext === "variants" ? `(${baseCurrency.code} ${baseCurrency.symbol})` : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 130.00"
                    value={bulkPriceUpdateDraft.sellingPrice}
                    onChange={(e) => setBulkPriceUpdateDraft({ ...bulkPriceUpdateDraft, sellingPrice: e.target.value })}
                    className="w-full rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13.5px] outline-none focus:border-[#E31E24]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#1A1A1A]">
                    Dealer Price {bulkPriceUpdateModalContext === "variants" ? `(${baseCurrency.code} ${baseCurrency.symbol})` : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 110.00"
                    value={bulkPriceUpdateDraft.dealerPrice}
                    onChange={(e) => setBulkPriceUpdateDraft({ ...bulkPriceUpdateDraft, dealerPrice: e.target.value })}
                    className="w-full rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13.5px] outline-none focus:border-[#E31E24]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#1A1A1A]">
                    Doctor / Retailer Price {bulkPriceUpdateModalContext === "variants" ? `(${baseCurrency.code} ${baseCurrency.symbol})` : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 100.00"
                    value={bulkPriceUpdateDraft.doctorRetailerPrice}
                    onChange={(e) => setBulkPriceUpdateDraft({ ...bulkPriceUpdateDraft, doctorRetailerPrice: e.target.value })}
                    className="w-full rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13.5px] outline-none focus:border-[#E31E24]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBulkPriceUpdateModalContext(null)}
                  className="rounded-md px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  className="rounded-md bg-[#E31E24] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#C81A1F] disabled:opacity-50"
                >
                  {bulkSaving ? "Updating..." : "Update Prices"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        open={addVariantOverrideModalOpen}
        onClose={() => setAddVariantOverrideModalOpen(false)}
        title="Add Variant Override"
        panelClassName="max-w-md"
      >
        <form onSubmit={handleAddVariantOverrideSubmit} className="space-y-5 p-6">
          <p className="text-[13px] leading-5 text-[#6B6B6B]">
            Create a country-specific price override for a variant.
          </p>

          <AdminSelect
            label="Variant"
            value={addVariantOverrideForm.variantId}
            onChange={(e) => setAddVariantOverrideForm((f) => ({ ...f, variantId: e.target.value }))}
            required
            options={[
              { value: "", label: "Select Variant" },
              ...(product?.variants?.map((v: any) => ({
                value: v.id,
                label: v.title,
              })) || []),
            ]}
          />

          <AdminSelect
            label="Country"
            value={addVariantOverrideForm.countryId}
            onChange={(e) => setAddVariantOverrideForm((f) => ({ ...f, countryId: e.target.value }))}
            required
            options={[
              { value: "", label: "Select Country" },
              ...(countries?.map((c: any) => ({
                value: c.id,
                label: c.name,
              })) || []),
            ]}
          />

          <AdminInput
            label="MRP"
            type="number"
            min="0"
            step="0.01"
            value={addVariantOverrideForm.mrp}
            onChange={(e) => setAddVariantOverrideForm((f) => ({ ...f, mrp: e.target.value }))}
            required
          />
          <AdminInput
            label="Selling Price"
            type="number"
            min="0"
            step="0.01"
            value={addVariantOverrideForm.sellingPrice}
            onChange={(e) => setAddVariantOverrideForm((f) => ({ ...f, sellingPrice: e.target.value }))}
            required
          />
          <AdminInput
            label="Dealer Price"
            type="number"
            min="0"
            step="0.01"
            value={addVariantOverrideForm.dealerPrice}
            onChange={(e) => setAddVariantOverrideForm((f) => ({ ...f, dealerPrice: e.target.value }))}
          />
          <AdminInput
            label="Doctor / Retailer Price"
            type="number"
            min="0"
            step="0.01"
            value={addVariantOverrideForm.distributorPrice}
            onChange={(e) => setAddVariantOverrideForm((f) => ({ ...f, distributorPrice: e.target.value }))}
          />
          
          <div className="flex items-center justify-end gap-3 border-t border-[#E6E6E6] pt-4 mt-2">
            <button
              type="button"
              onClick={() => setAddVariantOverrideModalOpen(false)}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              Add Override
            </button>
          </div>
        </form>
      </Modal>

      {/* 1. Feature Modal */}
      <Modal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
        title={editingFeatureIndex !== null ? "Edit Feature" : "Add Feature"}
        size="lg"
        onSave={handleSaveFeatureModal}
        saveText={editingFeatureIndex !== null ? "Save Feature" : "Add Feature"}
      >
        <div className="space-y-4 p-6">
          <AdminInput
            label="Feature Title"
            value={featureTitleState}
            onChange={(e) => setFeatureTitleState(e.target.value)}
            placeholder="Enter feature title (e.g. High-Precision Orthodontic Design)"
          />
          <AdminRichTextEditor
            label="Feature Description"
            value={featureDescriptionState}
            placeholder="Enter feature description..."
            onChange={(val) => setFeatureDescriptionState(val)}
            className="min-h-[160px]"
          />
        </div>
      </Modal>

      {/* 2. Key Specification Modal */}
      <Modal
        open={specModalOpen}
        onClose={() => setSpecModalOpen(false)}
        title={editingSpecIndex !== null ? "Edit Key Specification" : "Add Key Specification"}
        size="md"
        onSave={handleSaveSpecModal}
        saveText={editingSpecIndex !== null ? "Save Spec" : "Add Spec"}
      >
        <div className="space-y-4 p-6">
          <AdminInput
            label="Specification Label"
            value={specLabelState}
            onChange={(e) => setSpecLabelState(e.target.value)}
            placeholder="e.g. Slot Size, Base Type, or Material"
          />
          <AdminInput
            label="Specification Value"
            value={specValueState}
            onChange={(e) => setSpecValueState(e.target.value)}
            placeholder="e.g. .018 / .022 or 80-Mesh Contoured Base"
          />
        </div>
      </Modal>

      {/* 3. Direction To Use Modal */}
      <Modal
        open={directionModalOpen}
        onClose={() => setDirectionModalOpen(false)}
        title={editingDirectionIndex !== null ? "Edit Guideline" : "Add Guideline"}
        size="lg"
        onSave={handleSaveDirectionModal}
        saveText={editingDirectionIndex !== null ? "Save Guideline" : "Add Guideline"}
      >
        <div className="space-y-4 p-6">
          <AdminInput
            label="Instruction Title"
            value={directionTitleState}
            onChange={(e) => setDirectionTitleState(e.target.value)}
            placeholder="e.g. Clinical Inspection & Verification"
          />
          <AdminRichTextEditor
            label="Instruction Details"
            value={directionDescriptionState}
            placeholder="Enter clinical guideline details..."
            onChange={(val) => setDirectionDescriptionState(val)}
            className="min-h-[160px]"
          />
        </div>
      </Modal>

      {/* 4. Warranty Modal */}
      <Modal
        open={warrantyModalOpen}
        onClose={() => setWarrantyModalOpen(false)}
        title={editingWarrantyIndex !== null ? "Edit Warranty Clause" : "Add Warranty Clause"}
        size="md"
        onSave={handleSaveWarrantyModal}
        saveText={editingWarrantyIndex !== null ? "Save Clause" : "Add Clause"}
      >
        <div className="space-y-4 p-6">
          <AdminRichTextEditor
            label="Warranty Clause / Term"
            value={warrantyTextState}
            placeholder="Enter warranty term..."
            onChange={(val) => setWarrantyTextState(val)}
            className="min-h-[140px]"
          />
        </div>
      </Modal>

      {/* 5. Additional Info Modal */}
      <Modal
        open={additionalInfoModalOpen}
        onClose={() => setAdditionalInfoModalOpen(false)}
        title={editingAdditionalInfoIndex !== null ? "Edit Additional Info Row" : "Add Info Row"}
        size="md"
        onSave={handleSaveAdditionalInfoModal}
        saveText={editingAdditionalInfoIndex !== null ? "Save Info Row" : "Add Info Row"}
      >
        <div className="space-y-4 p-6">
          <AdminInput
            label="Field Label"
            value={additionalInfoLabelState}
            onChange={(e) => setAdditionalInfoLabelState(e.target.value)}
            placeholder="e.g. Manufacturer"
          />
          <AdminInput
            label="Field Value"
            value={additionalInfoValueState}
            onChange={(e) => setAdditionalInfoValueState(e.target.value)}
            placeholder="e.g. Modern Orthodontics"
          />
        </div>
      </Modal>

      <MediaSelectorModal
        open={pdfMediaSelectorOpen}
        title="Media Library"
        initialType="document"
        onClose={() => setPdfMediaSelectorOpen(false)}
        onSelect={handleAttachCatalogueFromMedia}
      />

      <MediaSelectorModal
        open={imageMediaSelectorOpen}
        title="Media Library"
        initialType="image"
        onClose={() => setImageMediaSelectorOpen(false)}
        onSelect={handleAttachProductImageFromMedia}
      />

      <MediaSelectorModal
        open={infoImageSelectorOpen}
        title="Media Library"
        initialType="image"
        onClose={() => setInfoImageSelectorOpen(false)}
        onSelect={(media) => {
          form.setFieldValue("informationImage", media.url);
          setInfoImageSelectorOpen(false);
          showToast("Information image updated.");
        }}
      />

      <MediaSelectorModal
        open={specDiagramSelectorOpen}
        title="Media Library"
        initialType="image"
        onClose={() => setSpecDiagramSelectorOpen(false)}
        onSelect={(media) => {
          const existing = form.values.specImages || [];
          form.setFieldValue("specImages", [...existing, { url: media.url, title: media.originalName }]);
          setSpecDiagramSelectorOpen(false);
          showToast("Specification diagram added.");
        }}
      />

      <MediaSelectorModal
        open={packageMediaSelectorOpen}
        title="Media Library"
        initialType="image"
        onClose={() => setPackageMediaSelectorOpen(false)}
        onSelect={(media) => {
          setPackageImage(media.url);
          setPackageMediaSelectorOpen(false);
          showToast("Package image selected.");
        }}
      />

      {/* PRODUCT ATTRIBUTES EXCEL IMPORT WIZARD */}
      <AdminImportWizard
        open={attrImportOpen}
        onClose={() => setAttrImportOpen(false)}
        title="Import Product Attributes Excel"
        subtitle="Upload an .xlsx or .csv file to map attributes and allowed values with live preview & direct inline editing."
        entityName="product attributes"
        columns={productAttributeWizardColumns}
        expectedColumns={productAttributeExpectedColumns}
        sampleTemplateUrl={`/products/${productId}/attributes/sample-template`}
        sampleTemplateFilename="product-attributes-template.xlsx"
        previewEndpoint={`/products/${productId}/attributes/import/preview`}
        executeEndpoint={`/products/${productId}/attributes/import`}
        onSuccess={(result) => {
          showToast(
            `Import complete: ${result?.created ?? 0} created, ${result?.updated ?? 0} updated.`,
            "success"
          );
          refetchProductAttributes();
        }}
      />

      {ToastComponent}
    </>
  );

  if (isEmbed) {
    return (
      <div className="is-embed-variant-editor">
        <style dangerouslySetInnerHTML={{ __html: `
          .is-embed-variant-editor > *:not(.fixed) {
            display: none !important;
          }
        `}} />
        {content}
        {ToastComponent}
      </div>
    );
  }

  return (
    <AdminLayout title={product.title} breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "Edit" }]}>
      {content}
    </AdminLayout>
  );
}
