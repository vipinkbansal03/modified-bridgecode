"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Upload, Trash2, RefreshCw, Plus, Zap, Copy, X, Pencil, Save, Globe2, Search } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminRichTextEditor, AdminTextarea, AdminSelect, StatusBadge, useToast, ConfirmModal, DataTable, Column, toastMessages } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
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
  useDeleteProductTierPricing,
  useAdminProductMoqPricing,
  useCreateProductMoqPricing,
  useDeleteProductMoqPricing,
  useAssignProductAttributes,
  useRemoveProductAttribute,
  useAdminCountries,
  useAdminTiers,
  useUpdateProductFilterVisibility,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  filterTranslationLanguages,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationEditorBanner,
  NoTranslationLanguagesMessage,
} from "@/components/admin/TranslationEditorUi";

interface TabConfig {
  id: number;
  label: string;
  permission?: string;
}

const ALL_TABS: TabConfig[] = [
  { id: 0, label: "Basic Info" },
  { id: 1, label: "Product Info" },
  { id: 2, label: "Media" },
  { id: 3, label: "Packages" },
  { id: 4, label: "Variants", permission: "variants.view" },
  { id: 5, label: "Pricing", permission: "pricing.view" },
  { id: 6, label: "Inventory", permission: "inventory.view" },
  { id: 7, label: "Translations", permission: "translations.view" },
  { id: 8, label: "Product Attributes", permission: "attributes.view" },
  { id: 9, label: "Country Availability", permission: "countries.view" },
  { id: 10, label: "SEO" },
];

const basicSchema = Yup.object({
  title: Yup.string().required("Required"),
  categoryId: Yup.string().required("Required"),
  status: Yup.string().required(),
  productCode: Yup.string(),
  sku: Yup.string(),
  brand: Yup.string(),
  shortDescription: Yup.string().max(300),
  description: Yup.string(),
  informationImage: Yup.string(),
  informationDescription: Yup.string().max(200),
  isFeatured: Yup.boolean(),
  hasVariants: Yup.boolean(),
  seoTitle: Yup.string().max(60),
  seoDescription: Yup.string().max(160),
  seoKeywords: Yup.string(),
  highlights: Yup.array().of(Yup.object({ title: Yup.string(), description: Yup.string(), image: Yup.string() })),
  technicalSpecs: Yup.array().of(Yup.object({ label: Yup.string(), value: Yup.string() })),
  warranty: Yup.array().of(Yup.string()),
  primaryFeatures: Yup.array().of(Yup.object({ title: Yup.string(), description: Yup.string() })),
});

type ProductEditorFormValues = {
  title: string;
  categoryId: string;
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
  warranty: string[];
  primaryFeatures: Array<{ title: string; description: string }>;
};

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
  package?: { id: string; title: string } | null;
  inventories?: {
    id?: string;
    variantId?: string | null;
    countryId?: string | null;
    country?: { id: string; name: string; code: string } | null;
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

function ProductBaseInventoryEditor({
  productId,
  inventory,
  onSaved,
  notify,
  disabled = false,
}: {
  productId: string;
  inventory?: NonNullable<VariantRow["inventories"]>[number] | null;
  onSaved: () => Promise<unknown>;
  notify: (message: string, type?: "success" | "error") => void;
  disabled?: boolean;
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
      <div className="mb-4">
        <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Product Base Inventory</h4>
        <p className="mt-1 text-[12px] text-[#6B6B6B]">This inventory is inherited by newly generated variants when no country-specific override applies.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminInput label="Stock" type="number" min={0} step={1} value={stock} onChange={(event) => setStock(Math.max(0, Math.trunc(Number(event.target.value))))} disabled={disabled} />
        <AdminInput label="Reserved stock" type="number" min={0} step={1} value={reservedStock} onChange={(event) => setReservedStock(Math.max(0, Math.trunc(Number(event.target.value))))} disabled={disabled} />
        <AdminInput label="Low-stock threshold" type="number" min={0} step={1} value={lowStockThreshold} onChange={(event) => setLowStockThreshold(Math.max(0, Math.trunc(Number(event.target.value))))} disabled={disabled} />
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

const getBaseInventory = <T extends { countryId?: string | null }>(inventories?: T[] | null) =>
  Array.isArray(inventories) ? inventories.find((inventory) => !inventory.countryId) ?? null : null;

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
  technicalSpecs: Array<{ label: string; value: string }>;
  warranty: string[];
  primaryFeatures: Array<{ title: string; description: string }>;
};

type CountryAvailability = {
  id: string;
  name: string;
  code: string;
  status: string;
  enabled: boolean;
  currency?: { symbol?: string | null; code?: string | null } | null;
};

type BulkVariantDraft = {
  price?: string;
  dealerPrice?: string;
  doctorRetailerPrice?: string;
  stock?: string;
};

type BulkCountryOption = {
  id: string;
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
  discountPercent?: string | number | null;
  fixedPrice?: string | number | null;
};

type RuleDraft = {
  tierId: string;
  countryId: string;
  variantId: string;
  minQuantity: string;
  mode: "discount" | "fixed";
  discountPercent: string;
  fixedPrice: string;
};

const emptyRuleDraft: RuleDraft = {
  tierId: "",
  countryId: "",
  variantId: "",
  minQuantity: "10",
  mode: "discount",
  discountPercent: "",
  fixedPrice: "",
};

const formatVariantPrice = (variant: VariantRow) => {
  const price = variant.prices?.[0];
  const amount = price?.sellingPrice ?? price?.mrp;
  if (amount === null || amount === undefined || amount === "") return "No price";
  return `${price?.currency?.symbol ?? ""}${amount}`;
};

const getVariantPriceForCountry = (variant: VariantRow, countryId?: string) =>
  countryId ? variant.prices?.find((price) => price.countryId === countryId || price.country?.id === countryId) ?? null : variant.prices?.[0] ?? null;

function VariantGridMatrix({
  gridState,
  onEditVariant,
  onManageCountries,
  bulkEditMode,
  bulkCountryId,
  rowErrors,
  getDraft,
  onDraftChange,
}: {
  gridState: Extract<VariantGridState, { mode: "grid" }>;
  onEditVariant: (variant: VariantRow) => void;
  onManageCountries: (variant: VariantRow) => void;
  bulkEditMode?: boolean;
  bulkCountryId?: string;
  rowErrors?: Record<string, string>;
  getDraft?: (variant: VariantRow) => Required<BulkVariantDraft>;
  onDraftChange?: (variantId: string, patch: BulkVariantDraft) => void;
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
                              type="number"
                              min="0"
                              step="0.01"
                              value={getDraft(cell.variant).price}
                              onChange={(e) => onDraftChange(cell.variant!.id, { price: e.target.value })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Dealer
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getDraft(cell.variant).dealerPrice}
                              onChange={(e) => onDraftChange(cell.variant!.id, { dealerPrice: e.target.value })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Doctor / Retailer
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getDraft(cell.variant).doctorRetailerPrice}
                              onChange={(e) => onDraftChange(cell.variant!.id, { doctorRetailerPrice: e.target.value })}
                              className="mt-1 w-full rounded border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-[#6B6B6B]">
                            Stock
                            <input
                              type="number"
                              min="0"
                              value={getDraft(cell.variant).stock}
                              onChange={(e) => onDraftChange(cell.variant!.id, { stock: e.target.value })}
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
                          <span>Price: {bulkCountryId ? `${getVariantPriceForCountry(cell.variant, bulkCountryId)?.currency?.symbol ?? ""}${getVariantPriceForCountry(cell.variant, bulkCountryId)?.sellingPrice ?? "No price"}` : formatVariantPrice(cell.variant)}</span>
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
  const [pricingSubTab, setPricingSubTab] = useState<"base" | "tier" | "moq">("base");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<string | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<PackageRow | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<VariantRow | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageRow | null>(null);
  const [packageTitle, setPackageTitle] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageImage, setPackageImage] = useState("");
  const [uploadingPackageImage, setUploadingPackageImage] = useState(false);
  const [packageSortOrder, setPackageSortOrder] = useState(0);
  const [packageStatus, setPackageStatus] = useState("ACTIVE");
  const [manualVariantOpen, setManualVariantOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantRow | null>(null);
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
    mode: "discount" as "discount" | "fixed",
    discountPercent: "",
    fixedPrice: "",
  });
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [generateVariantOpen, setGenerateVariantOpen] = useState(false);
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
  const [editVariantStatus, setEditVariantStatus] = useState("ACTIVE");
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, ProductTranslationDraft>>({});
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [variantSearchQuery, setVariantSearchQuery] = useState("");
  const [variantTabSearchQuery, setVariantTabSearchQuery] = useState("");
  const [variantTabStatusFilter, setVariantTabStatusFilter] = useState("");
  const [variantTabStockFilter, setVariantTabStockFilter] = useState("");
  const [variantCountryModalVariant, setVariantCountryModalVariant] = useState<VariantRow | null>(null);
  const [variantCountryOverrides, setVariantCountryOverrides] = useState<Record<string, boolean>>({});
  const [inventoryOverrideDrafts, setInventoryOverrideDrafts] = useState<Record<string, { countryId: string; stock: string }>>({});
  const [selectedMappingAttributeId, setSelectedMappingAttributeId] = useState("");
  const [newMappingRequired, setNewMappingRequired] = useState(true);
  const [newMappingGridAxis, setNewMappingGridAxis] = useState<GridAxis | null>(null);
  const [newMappingValueIds, setNewMappingValueIds] = useState<string[]>([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkCountryId, setBulkCountryId] = useState("");
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, BulkVariantDraft>>({});
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [tierRuleDraft, setTierRuleDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [moqRuleDraft, setMoqRuleDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [countryPriceModalOpen, setCountryPriceModalOpen] = useState(false);
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
  const { showToast, ToastComponent } = useToast();

  const { data: product, isLoading, refetch } = useAdminProduct(productId);

  const productBasePrices = useMemo(() => {
    return (product?.prices || []).filter((p: any) => !p.variantId);
  }, [product?.prices]);

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
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.mrp}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], mrp: e.target.value }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.sellingPrice}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], sellingPrice: e.target.value }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.dealerPrice}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], dealerPrice: e.target.value }
                      }))}
                      className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{price.currency.symbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.distributorPrice}
                      onChange={(e) => setBasePriceBulkDrafts((prev) => ({
                        ...prev,
                        [price.id]: { ...prev[price.id], distributorPrice: e.target.value }
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

  const handleDeleteProductPrice = async (priceId: string) => {
    if (!window.confirm("Are you sure you want to delete this country price?")) return;
    try {
      await adminApi.delete(`/pricing/${priceId}`);
      showToast("Price deleted successfully.");
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

  const handleBulkDeletePrices = async () => {
    if (!selectedPriceIds.length) return;
    if (!window.confirm(`Are you sure you want to delete the selected ${selectedPriceIds.length} base price(s)?`)) return;
    try {
      await Promise.all(
        selectedPriceIds.map((id) => adminApi.delete(`/pricing/${id}`))
      );
      showToast(`${selectedPriceIds.length} price(s) deleted successfully.`);
      setSelectedPriceIds([]);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete selected prices."), "error");
    }
  };

  const handleDeleteAllBasePrices = async () => {
    if (!productBasePrices.length) return;
    if (!window.confirm(`Are you sure you want to delete ALL ${productBasePrices.length} country base price(s) for this product?`)) return;
    try {
      await Promise.all(
        productBasePrices.map((p: any) => adminApi.delete(`/pricing/${p.id}`))
      );
      showToast(`All ${productBasePrices.length} base price(s) deleted successfully.`);
      setSelectedPriceIds([]);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete base prices."), "error");
    }
  };

  const { data: productCountries = [], isLoading: countriesLoading } = useAdminProductCountries(productId);
  const { data: variantCountries = [], isLoading: variantCountriesLoading } = useAdminVariantCountries(productId, editingVariant?.id || variantCountryModalVariant?.id);
  const { data: productAttributeMappings = [], isLoading: productAttributesLoading } = useAdminProductAttributes(productId);
  const { data: tierPricingRules = [] } = useAdminProductTierPricing(productId);
  const { data: moqPricingRules = [] } = useAdminProductMoqPricing(productId);
  const { data: categories = [] } = useAdminCategories();
  const { data: attributes = [] } = useAdminAttributes();
  const { data: countries = [] } = useAdminCountries();
  const { data: tiers = [] } = useAdminTiers();
  const { data: selectedAttributeDetail } = useAdminAttribute(selectedMappingAttributeId);
  const { data: languages = [] } = useAdminLanguages();
  const updateProduct = useUpdateProduct(productId);
  const updateProductCountries = useUpdateProductCountries(productId);
  const updateVariantCountries = useUpdateVariantCountries(productId, variantCountryModalVariant?.id);
  const createTierPricing = useCreateProductTierPricing(productId);
  const deleteTierPricing = useDeleteProductTierPricing(productId);
  const createMoqPricing = useCreateProductMoqPricing(productId);
  const deleteMoqPricing = useDeleteProductMoqPricing(productId);
  const assignProductAttributes = useAssignProductAttributes(productId);
  const removeProductAttribute = useRemoveProductAttribute(productId);
  const updateProductFilterVisibility = useUpdateProductFilterVisibility(productId);

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
  const availableMappingAttributes = useMemo(
    () => attributeCatalog.filter((attribute) => !mappedAttributeIds.has(attribute.id)),
    [attributeCatalog, mappedAttributeIds]
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
  const packageRows = useMemo(() => (product?.packages ?? []) as PackageRow[], [product?.packages]);
  const variantRows = useMemo(() => (product?.variants ?? []) as VariantRow[], [product?.variants]);
  const filteredVariantRows = useMemo(() => {
    return variantRows.filter((variant) => {
      if (variantTabStatusFilter && variant.status !== variantTabStatusFilter) return false;
      if (variantTabStockFilter) {
        const stock = getBaseInventory(variant.inventories)?.stock ?? 0;
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
      return true;
    });
  }, [variantRows, variantTabStatusFilter, variantTabStockFilter, variantTabSearchQuery]);
  const bulkCountryOptions = useMemo(() => {
    const countries = new Map<string, BulkCountryOption>();
    (productCountries as CountryAvailability[]).forEach((country) => {
      countries.set(country.id, {
        id: country.id,
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
          label: price.country ? `${price.country.name} (${price.country.code})` : countryId,
          currencySymbol: price.currency?.symbol,
        });
      });
    });
    return Array.from(countries.values());
  }, [product?.prices, productCountries, variantRows]);
  const selectedBulkCountryId = bulkCountryId || product?.defaultCountryId || bulkCountryOptions[0]?.id || "";
  const tierRows = useMemo(() => tiers as TierRow[], [tiers]);
  const countryRows = useMemo(() => countries as { id: string; name: string; code: string }[], [countries]);
  const tierPricingRows = useMemo(() => tierPricingRules as PricingRuleRow[], [tierPricingRules]);
  const moqPricingRows = useMemo(() => moqPricingRules as PricingRuleRow[], [moqPricingRules]);

  const formik = useFormik<ProductEditorFormValues>({
    enableReinitialize: true,
    initialValues: {
      title: product?.title || "",
      categoryId: product?.categoryId || "",
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
      highlights: Array.isArray(product?.highlights) ? product.highlights : [],
      technicalSpecs: Array.isArray(product?.technicalSpecs) ? product.technicalSpecs : [],
      warranty: Array.isArray(product?.warranty) ? product.warranty : [],
      primaryFeatures: Array.isArray(product?.primaryFeatures) ? product.primaryFeatures : [],
    },
    validationSchema: basicSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        // Build a sanitized payload to avoid sending unexpected types to the API
        const payload = {
          ...values,
          highlights: Array.isArray(values.highlights)
            ? values.highlights.map((h) => ({ title: String(h?.title ?? ""), description: String(h?.description ?? "") }))
            : [],
          technicalSpecs: Array.isArray(values.technicalSpecs)
            ? values.technicalSpecs.map((s) => ({ label: String(s?.label ?? ""), value: String(s?.value ?? "") }))
            : [],
          warranty: Array.isArray(values.warranty) ? values.warranty.map((w) => String(w ?? "")) : [],
          primaryFeatures: Array.isArray(values.primaryFeatures)
            ? values.primaryFeatures.map((p) => ({ title: String(p?.title ?? ""), description: String(p?.description ?? "") }))
            : [],
        } as typeof values;

        // Debug: log sanitized payload
        // eslint-disable-next-line no-console
        console.log("[ProductEditor] saving sanitized product payload:", payload);

        await updateProduct.mutateAsync(payload);
        showToast("Product saved.");
      } catch (error) {
        // Log full error for debugging (server returned 500)
        // eslint-disable-next-line no-console
        console.error("[ProductEditor] save error:", error, (error as any)?.response?.data);
        // Prefer server message if available
        const serverMessage = (error as any)?.response?.data?.message;
        showToast(serverMessage || getAdminErrorMessage(error, "Save failed."), "error");
      } finally {
        setSubmitting(false);
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

  const packageCols: Column<PackageRow>[] = [
    { key: "title", label: "Package" },
    { key: "slug", label: "Slug" },
    { key: "sortOrder", label: "Sort", render: (row) => row.sortOrder ?? 0 },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status || "ACTIVE"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openPackageModal(row)} className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5]">
            <Pencil size={12} />
          </button>
          <button onClick={() => setDeletingPackage(row)} className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50">
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
    const price = getVariantPriceForCountry(variant, selectedBulkCountryId);
    return {
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

  const saveBulkVariantEdits = async () => {
    const updates = variantRows
      .map((variant) => {
        const draft = bulkDrafts[variant.id];
        if (!draft) return null;
        const currentPrice = getVariantPriceForCountry(variant, selectedBulkCountryId);
        const currentPriceValue = currentPrice?.sellingPrice !== undefined && currentPrice?.sellingPrice !== null ? `${currentPrice.sellingPrice}` : "";
        const currentDealerPriceValue = currentPrice?.dealerPrice !== undefined && currentPrice?.dealerPrice !== null ? `${currentPrice.dealerPrice}` : "";
        const currentDoctorRetailerPriceValue =
          currentPrice?.distributorPrice !== undefined && currentPrice?.distributorPrice !== null ? `${currentPrice.distributorPrice}` : "";
        const currentStockValue =
          getBaseInventory(variant.inventories)?.stock !== undefined && getBaseInventory(variant.inventories)?.stock !== null
            ? `${getBaseInventory(variant.inventories)?.stock}`
            : "";
        const priceChanged = draft.price !== undefined && draft.price !== currentPriceValue;
        const dealerPriceChanged = draft.dealerPrice !== undefined && draft.dealerPrice !== currentDealerPriceValue;
        const doctorRetailerPriceChanged =
          draft.doctorRetailerPrice !== undefined && draft.doctorRetailerPrice !== currentDoctorRetailerPriceValue;
        const stockChanged = draft.stock !== undefined && draft.stock !== currentStockValue;
        if (!priceChanged && !dealerPriceChanged && !doctorRetailerPriceChanged && !stockChanged) return null;
        return {
          variantId: variant.id,
          ...(priceChanged || dealerPriceChanged || doctorRetailerPriceChanged
            ? {
                countryId: selectedBulkCountryId || undefined,
                price: {
                  ...(priceChanged ? { sellingPrice: draft.price } : {}),
                  ...(dealerPriceChanged ? { dealerPrice: draft.dealerPrice } : {}),
                  ...(doctorRetailerPriceChanged ? { distributorPrice: draft.doctorRetailerPrice } : {}),
                },
              }
            : {}),
          ...(stockChanged ? { stock: draft.stock } : {}),
        };
      })
      .filter(Boolean);

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

  const handleBulkDeleteVariants = async () => {
    if (!selectedVariantIds.length) {
      showToast("Select at least one variant.", "error");
      return;
    }
    if (!window.confirm(`Delete ${selectedVariantIds.length} selected variant${selectedVariantIds.length === 1 ? "" : "s"}?`)) return;
    setBulkSaving(true);
    try {
      const response = await adminApi.put(`/products/${productId}/variants/bulk`, {
        updates: selectedVariantIds.map((variantId) => ({ variantId, action: "delete" })),
      });
      const summary = response.data.data.summary as { succeeded: number; failed: number };
      showToast(summary.failed ? `Deleted ${summary.succeeded}; ${summary.failed} failed.` : `${summary.succeeded} variant${summary.succeeded === 1 ? "" : "s"} deleted.`, summary.failed ? "error" : "success");
      setSelectedVariantIds([]);
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
    ...(includeMoq ? { minQuantity: Number(draft.minQuantity) } : {}),
    discountPercent: draft.mode === "discount" ? draft.discountPercent : null,
    fixedPrice: draft.mode === "fixed" ? draft.fixedPrice : null,
  });

  const handleCreateTierRule = async () => {
    if (!tierRuleDraft.tierId || !tierRuleDraft.countryId) {
      showToast("Choose tier and country.", "error");
      return;
    }
    try {
      await createTierPricing.mutateAsync(buildRulePayload(tierRuleDraft, false));
      setTierRuleDraft(emptyRuleDraft);
      showToast("Tier pricing rule created.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create tier pricing rule."), "error");
    }
  };

  const handleCreateMoqRule = async () => {
    if (!moqRuleDraft.countryId) {
      showToast("Choose country.", "error");
      return;
    }
    try {
      await createMoqPricing.mutateAsync(buildRulePayload(moqRuleDraft, true));
      setMoqRuleDraft(emptyRuleDraft);
      showToast("MOQ pricing rule created.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create MOQ pricing rule."), "error");
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

  const handleAddProductAttribute = async () => {
    if (!selectedMappingAttributeId) {
      showToast("Choose an attribute to map.", "error");
      return;
    }
    if (!newMappingValueIds.length) {
      showToast("Choose at least one allowed value for this product.", "error");
      return;
    }

    try {
      const existingMappings = toProductAttributePayload(mappedAttributeRows);
      await assignProductAttributes.mutateAsync([
        ...existingMappings,
        {
          attributeId: selectedMappingAttributeId,
          required: newMappingRequired,
          gridAxis: newMappingGridAxis,
          allowedValueIds: newMappingValueIds,
        },
      ]);
      resetAttributeMappingForm();
      showToast("Product attribute mapped.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to map product attribute."), "error");
    }
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
    }
    setPackageModalOpen(true);
  };

  const handleSavePackage = async () => {
    if (!packageTitle.trim()) {
      showToast("Package title is required.", "error");
      return;
    }

    try {
      const payload = {
        title: packageTitle.trim(),
        description: packageDescription.trim() || null,
        image: packageImage.trim() || null,
        sortOrder: packageSortOrder,
        status: packageStatus,
      };
      if (editingPackage) {
        await adminApi.put(`/products/${productId}/packages/${editingPackage.id}`, payload);
        showToast("Package updated.");
      } else {
        await adminApi.post(`/products/${productId}/packages`, payload);
        showToast("Package created.");
      }
      setPackageModalOpen(false);
      resetPackageForm();
      refetch();
    } catch {
      showToast("Failed to save package.", "error");
    }
  };

  const uploadPackageImage = async (file?: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("files", file);
    setUploadingPackageImage(true);
    try {
      const response = await adminApi.post("/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const uploaded = response.data?.data?.[0];
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

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingMedia(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      await adminApi.post(`/products/${productId}/media`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      showToast("Media uploaded.");
      refetch();
    } catch {
      showToast("Upload failed.", "error");
    } finally {
      setUploadingMedia(false);
      e.target.value = "";
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await adminApi.delete(`/products/${productId}/media/${mediaId}`);
      showToast("Media deleted.");
      refetch();
    } catch {
      showToast("Delete failed.", "error");
    } finally {
      setDeletingMedia(null);
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
    setGeneratePackageIds(packageRows.map((pkg) => pkg.id));
    setGenerateAttributeIds(seedAttributeIds);
    setGenerateSelectionMap({});
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
      const variantMRP = override?.mrp != null && override.mrp.trim() !== "" ? Number(override.mrp) : mrp;
      const variantSellingPrice = override?.sellingPrice != null && override.sellingPrice.trim() !== "" ? Number(override.sellingPrice) : undefined;
      const variantDealer = override?.dealerPrice != null && override.dealerPrice.trim() !== "" ? Number(override.dealerPrice) : undefined;
      const variantDistributor = override?.distributorPrice != null && override.distributorPrice.trim() !== "" ? Number(override.distributorPrice) : undefined;

      if (Number.isFinite(variantMRP) && variantMRP > 0) {
        variantOverrides[variant.id] = {
          mrp: variantMRP,
          ...(variantSellingPrice != null && { sellingPrice: variantSellingPrice }),
          ...(variantDealer != null && { dealerPrice: variantDealer }),
          ...(variantDistributor != null && { distributorPrice: variantDistributor }),
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

    try {
      await adminApi.put(`/products/${productId}/variants/${editingVariant.id}`, {
        attributeValueIds: selectedValueIds,
        packageId: editVariantPackageId || null,
        sku: editVariantSku.trim() || null,
        title: editVariantTitle.trim() || null,
        moq: Math.max(1, editVariantMoq),
        status: editVariantStatus,
      });

      const pricingUpdates: any[] = [];
      const countries = (variantCountries as CountryAvailability[]).filter((c) => c.enabled);

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
    }
  };

  const handleGenerateVariants = async () => {
    const selectedAttributes = variantGenerationCatalog
      .filter((attribute) => generateAttributeIds.includes(attribute.id))
      .map((attribute) => {
        const mode = generateModeMap[attribute.id] ?? "all";
        if (mode === "skip") return null;
        if (mode === "all") {
          return {
            attributeId: attribute.id,
            attributeValueIds: getAttributeValues(attribute).map((value) => value.id),
          };
        }
        const selectedIds = generateSelectionMap[attribute.id] ?? [];
        if (!selectedIds.length) return null;
        return {
          attributeId: attribute.id,
          attributeValueIds: selectedIds,
        };
      })
      .filter(Boolean) as { attributeId: string; attributeValueIds: string[] }[];

    if (!selectedAttributes.length) {
      const skippedAttributes = variantGenerationCatalog.filter(
        (attribute) => generateAttributeIds.includes(attribute.id) && (generateModeMap[attribute.id] ?? "all") === "skip",
      );
      if (skippedAttributes.length > 0) {
        showToast(
          `${skippedAttributes.map((attribute) => attribute.name).join(", ")} is set to Skip Attribute. Switch to Use All Values or remove it.`,
          "error",
        );
        return;
      }

      const hasAddedAttributes = generateAttributeIds.length > 0;
      showToast(
        hasAddedAttributes
          ? "Choose values for each attribute, or switch an attribute to Use All Values."
          : "Add at least one attribute before generating variants.",
        "error",
      );
      return;
    }

    const specificMissing = variantGenerationCatalog
      .filter((attribute) => generateAttributeIds.includes(attribute.id))
      .some((attribute) => {
      const mode = generateModeMap[attribute.id] ?? "all";
      return mode === "specific" && !(generateSelectionMap[attribute.id] ?? []).length;
    });
    if (specificMissing) {
      showToast("Choose specific values for every attribute set to Specific Values.", "error");
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

  const toggleGenerateValue = (attributeId: string, attributeValueId: string, checked: boolean) => {
    setGenerateSelectionMap((current) => {
      const next = current[attributeId] ?? [];
      return {
        ...current,
        [attributeId]: checked ? [...next, attributeValueId] : next.filter((id) => id !== attributeValueId),
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
            <th className="border-b border-[#E6E6E6] px-4 py-3">Selling</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Dealer</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Doctor / Retailer</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Stock</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Status</th>
            <th className="border-b border-[#E6E6E6] px-4 py-3">Actions</th>
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
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(e) => updateBulkDraft(variant.id, { price: e.target.value })}
                    className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.dealerPrice}
                    onChange={(e) => updateBulkDraft(variant.id, { dealerPrice: e.target.value })}
                    className="w-28 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.doctorRetailerPrice}
                    onChange={(e) => updateBulkDraft(variant.id, { doctorRetailerPrice: e.target.value })}
                    className="w-32 rounded border border-[#E6E6E6] px-2 py-1.5 text-[13px] outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={draft.stock}
                    onChange={(e) => updateBulkDraft(variant.id, { stock: e.target.value })}
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[#E6E6E6] bg-white p-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                activeTab === tab.id ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && (activeTab === 0 || activeTab === 1 || activeTab === 10) ? (
            <button
              type="button"
              onClick={() => formik.handleSubmit()}
              disabled={formik.isSubmitting}
              className="rounded-md bg-[#E31E24] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
            >
              {formik.isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
            aria-label="Close"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <fieldset disabled={isReadOnly} className="disabled:opacity-100 flex-1 min-w-0">
        <div className="rounded-xl border border-[#E6E6E6] bg-white">
        {activeTab === 0 && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AdminInput label="Product Title *" {...formik.getFieldProps("title")} error={formik.touched.title ? (formik.errors.title as string) : ""} />
              </div>
              <AdminSelect label="Category *" options={catOptions} {...formik.getFieldProps("categoryId")} error={formik.touched.categoryId ? (formik.errors.categoryId as string) : ""} />
              <AdminSelect
                label="Status"
                options={[{ value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }]}
                {...formik.getFieldProps("status")}
              />
              <AdminInput label="Product Code" {...formik.getFieldProps("productCode")} />
              <AdminInput label="SKU" {...formik.getFieldProps("sku")} />
              <AdminInput label="Brand" {...formik.getFieldProps("brand")} />
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formik.values.isFeatured} onChange={(e) => formik.setFieldValue("isFeatured", e.target.checked)} className="rounded" />
                  <span className="text-[13.5px]">Featured Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formik.values.hasVariants} onChange={(e) => formik.setFieldValue("hasVariants", e.target.checked)} className="rounded" />
                  <span className="text-[13.5px]">Has Variants</span>
                </label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
              <div>
                <label className="mb-1 block text-[13.5px] font-medium text-[#1A1A1A]">Information Image</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const result = event.target?.result as string;
                          formik.setFieldValue("informationImage", result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="information-image-upload"
                  />
                  <label
                    htmlFor="information-image-upload"
                    className="cursor-pointer rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]"
                  >
                    Upload Image
                  </label>
                  {formik.values.informationImage && (
                    <div className="relative h-12 w-12">
                      <img src={formik.values.informationImage} alt="Information preview" className="h-full w-full rounded-md object-cover" />
                      <button
                        type="button"
                        onClick={() => formik.setFieldValue("informationImage", "")}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white hover:bg-[#B5151B]"
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
                {...formik.getFieldProps("informationDescription")}
              />
            </div>
            <AdminTextarea label="Short Description (max 300)" rows={2} maxLength={300} {...formik.getFieldProps("shortDescription")} />
            <AdminTextarea label="Full Description" rows={7} {...formik.getFieldProps("description")} />
          </div>
        )}

        {activeTab === 1 && (
          <div className="p-6 space-y-8">
            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Highlights</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Add title/description pairs to display in the product highlights section.</p>
                </div>
                <button
                  type="button"
                  onClick={() => formik.setFieldValue("highlights", [...(formik.values.highlights || []), { title: "", description: "" }])}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  Add highlight
                </button>
              </div>
              <div className="space-y-4">
                {(formik.values.highlights || []).map((item: { title: string; description: string; image?: string }, index: number) => (
                  <div key={index} className="grid gap-3 lg:grid-cols-[1fr_2.5fr_auto] items-stretch">
                    <div>
                      <AdminInput
                        label="Title"
                        value={item.title}
                        onChange={(event) => {
                          const next = [...(formik.values.highlights || [])];
                          next[index] = { ...next[index], title: event.target.value };
                          formik.setFieldValue("highlights", next);
                        }}
                      />
                    </div>
                    <div>
                      <AdminRichTextEditor
                        label="Description"
                        value={item.description}
                        placeholder="Enter highlight description (use Image button in toolbar to insert photos)"
                        onChange={(value) => {
                          const next = [...(formik.values.highlights || [])];
                          next[index] = { ...next[index], description: value };
                          formik.setFieldValue("highlights", next);
                        }}
                        className="min-h-[120px]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(formik.values.highlights || [])];
                          next.splice(index, 1);
                          formik.setFieldValue("highlights", next);
                        }}
                        className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!formik.values.highlights?.length && <p className="text-[13px] text-[#6B6B6B]">No highlights added yet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Technical Specifications</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Add spec rows that will appear as a table on the product page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => formik.setFieldValue("technicalSpecs", [...(formik.values.technicalSpecs || []), { label: "", value: "" }])}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  Add spec
                </button>
              </div>
              <div className="space-y-4">
                {(formik.values.technicalSpecs || []).map((item: { label: string; value: string }, index: number) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                    <AdminInput
                      label="Label"
                      value={item.label}
                      onChange={(event) => {
                        const next = [...(formik.values.technicalSpecs || [])];
                        next[index] = { ...next[index], label: event.target.value };
                        formik.setFieldValue("technicalSpecs", next);
                      }}
                    />
                    <AdminInput
                      label="Value"
                      value={item.value}
                      onChange={(event) => {
                        const next = [...(formik.values.technicalSpecs || [])];
                        next[index] = { ...next[index], value: event.target.value };
                        formik.setFieldValue("technicalSpecs", next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(formik.values.technicalSpecs || [])];
                        next.splice(index, 1);
                        formik.setFieldValue("technicalSpecs", next);
                      }}
                      className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!formik.values.technicalSpecs?.length && <p className="text-[13px] text-[#6B6B6B]">No technical specifications added yet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Warranty</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Add warranty text lines for the product details accordion.</p>
                </div>
                <button
                  type="button"
                  onClick={() => formik.setFieldValue("warranty", [...(formik.values.warranty || []), ""])}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  Add warranty line
                </button>
              </div>
              <div className="space-y-4">
                {(formik.values.warranty || []).map((line: string, index: number) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto] items-stretch">
                    <div>
                      <AdminRichTextEditor
                        label={`Warranty line ${index + 1}`}
                        value={line}
                        placeholder="Enter warranty text"
                        onChange={(value) => {
                          const next = [...(formik.values.warranty || [])];
                          next[index] = value;
                          formik.setFieldValue("warranty", next);
                        }}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(formik.values.warranty || [])];
                          next.splice(index, 1);
                          formik.setFieldValue("warranty", next);
                        }}
                        className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!formik.values.warranty?.length && <p className="text-[13px] text-[#6B6B6B]">No warranty lines added yet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Primary Features</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Add product features that highlight the product’s main benefits.</p>
                </div>
                <button
                  type="button"
                  onClick={() => formik.setFieldValue("primaryFeatures", [...(formik.values.primaryFeatures || []), { title: "", description: "" }])}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  Add feature
                </button>
              </div>
              <div className="space-y-4">
                {(formik.values.primaryFeatures || []).map((item: { title: string; description: string }, index: number) => (
                  <div key={index} className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto] items-stretch">
                    <div>
                      <AdminInput
                        label="Title"
                        value={item.title}
                        onChange={(event) => {
                          const next = [...(formik.values.primaryFeatures || [])];
                          next[index] = { ...next[index], title: event.target.value };
                          formik.setFieldValue("primaryFeatures", next);
                        }}
                      />
                    </div>
                    <div>
                      <AdminRichTextEditor
                        label="Description"
                        value={item.description}
                        placeholder="Enter feature description"
                        onChange={(value) => {
                          const next = [...(formik.values.primaryFeatures || [])];
                          next[index] = { ...next[index], description: value };
                          formik.setFieldValue("primaryFeatures", next);
                        }}
                        className="min-h-[120px]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(formik.values.primaryFeatures || [])];
                          next.splice(index, 1);
                          formik.setFieldValue("primaryFeatures", next);
                        }}
                        className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!formik.values.primaryFeatures?.length && <p className="text-[13px] text-[#6B6B6B]">No primary features added yet.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Media</h3>
                <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Upload product images used in listings and detail pages.</p>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                <Upload size={14} />
                {uploadingMedia ? "Uploading..." : "Upload Media"}
                <input type="file" accept="image/*" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia} />
              </label>
            </div>

            {(product.media ?? []).length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {(product.media ?? []).map((media: { id?: string; url: string; altText?: string | null }) => (
                  <div key={media.id ?? media.url} className="overflow-hidden rounded-lg border border-[#E6E6E6] bg-white">
                    <div className="aspect-square w-full bg-[#F7F7F7]">
                      <img src={media.url} alt={media.altText ?? product.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex items-center justify-end border-t border-[#E6E6E6] p-2">
                      <button
                        type="button"
                        disabled={!media.id}
                        onClick={() => media.id && setDeletingMedia(media.id)}
                        className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={media.id ? "Delete image" : "Image cannot be deleted because media id is missing"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[#E6E6E6] px-4 py-8 text-center text-[13px] text-[#9A9A9A]">
                No media uploaded yet.
              </p>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Packages</h3>
                <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Packages are separate commercial offerings of the same product.</p>
              </div>
              <button onClick={() => openPackageModal()} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                <Plus size={14} />
                Add Package
              </button>
            </div>
            <DataTable columns={packageCols} data={packageRows} rowKey="id" emptyMessage="No packages added yet." />
          </div>
        )}

        {activeTab === 4 && (
          <div className="p-6">
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
              </div>
            </div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Variants</h3>
                <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Variants are created from package + selected attribute values.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVariantIds(selectedVariantIds.length === filteredVariantRows.length ? [] : filteredVariantRows.map((variant) => variant.id))}
                  disabled={!filteredVariantRows.length}
                  className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] disabled:opacity-40"
                >
                  {selectedVariantIds.length === filteredVariantRows.length && filteredVariantRows.length ? "Clear Selection" : "Select All"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteVariants}
                  disabled={!selectedVariantIds.length || bulkSaving}
                  className="flex items-center gap-1.5 rounded-md border border-[#F2C9C9] bg-white px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 size={14} /> Delete Selected ({selectedVariantIds.length})
                </button>
                {bulkEditMode && bulkCountryOptions.length > 0 && (
                  <select
                    value={selectedBulkCountryId}
                    onChange={(e) => {
                      setBulkCountryId(e.target.value);
                      setBulkDrafts({});
                      setBulkRowErrors({});
                    }}
                    className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                  >
                    {bulkCountryOptions.map((country) => (
                      <option key={country.id} value={country.id}>{country.label}</option>
                    ))}
                  </select>
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
                  type="button"
                  onClick={() => {
                    setBulkEditMode((current) => !current);
                    setBulkDrafts({});
                    setBulkRowErrors({});
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-4 py-2 text-[13px] font-medium",
                    bulkEditMode
                      ? "border-[#F2C9C9] bg-red-50 text-[#B5151B] hover:bg-red-100"
                      : "border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5]"
                  )}
                >
                  {bulkEditMode ? "Exit Bulk Edit" : "Bulk Edit"}
                </button>
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
              </div>
            </div>
            {!product.hasVariants && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-[13px] text-yellow-700">
                Enable &quot;Has Variants&quot; in Basic Info first.
              </div>
            )}
            <div className="mb-5 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">
                {hasMappedProductAttributes ? "Mapped Attribute Catalog" : "Global Attribute Catalog"}
              </h4>
              <p className="mt-1 text-[12.5px] text-[#6B6B6B]">
                {hasMappedProductAttributes
                  ? "Showing attributes mapped to this product. Future generated variants are limited to these mapped values."
                  : "This product has no mapped attributes yet. Generation can still use the full global catalog; map attributes first in Product Attributes when you want product-specific controls."}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {variantGenerationCatalog.map((attribute) => {
                  const values = getAttributeValues(attribute);
                  return (
                    <div key={attribute.id} className="rounded-lg border border-[#E6E6E6] bg-white p-3.5">
                      <div className="text-[13px] font-medium text-[#1A1A1A]">{attribute.name}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {values.slice(0, 5).map((value) => (
                          <span key={value.id} className="rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[11px] text-[#6B6B6B]">{value.value}</span>
                        ))}
                        {values.length > 5 && <span className="text-[11px] text-[#9A9A9A]">+{values.length - 5}</span>}
                      </div>
                    </div>
                  );
                })}
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
                bulkCountryId={selectedBulkCountryId}
                rowErrors={bulkRowErrors}
                getDraft={getBulkVariantDraft}
                onDraftChange={updateBulkDraft}
              />
            ) : bulkEditMode ? (
              renderBulkFlatVariantTable()
            ) : (
              <DataTable columns={variantCols} data={filteredVariantRows} rowKey="id" emptyMessage="No variants match filters." />
            )}
          </div>
        )}

        {activeTab === 5 && (
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap gap-1 rounded-lg border border-[#E6E6E6] bg-white p-1 max-w-max">
              {[
                { key: "base", label: "Base Prices" },
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
                    {selectedPriceIds.length > 0 && (
                      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3.5 text-[13px] text-[#1A1A1A]">
                        <span className="font-medium">{selectedPriceIds.length} row(s) selected</span>
                        <div className="flex gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={handleStartBulkEditPrices}
                            className="rounded border border-[#E6E6E6] bg-white px-3 py-1.5 font-medium text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                          >
                            Bulk Edit Selected
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkDeletePrices}
                            className="rounded bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
                          >
                            Bulk Delete Selected
                          </button>
                        </div>
                      </div>
                    )}
                    <DataTable columns={pricingCols} data={productBasePrices} rowKey="id" emptyMessage="No pricing set. Use Generate to auto-fill all countries." />
                  </>
                )}
              </section>
            )}

            {pricingSubTab === "tier" && (
              <section className="rounded-lg border border-[#E6E6E6] bg-white p-4">
                <div className="mb-4">
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Tier Pricing</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Create product or variant-specific tier rules. Checkout pricing resolver is a later step.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-6">
                  <AdminSelect label="Tier" value={tierRuleDraft.tierId} onChange={(e) => setTierRuleDraft((d) => ({ ...d, tierId: e.target.value }))} options={[{ value: "", label: "Select tier" }, ...tierRows.map((tier) => ({ value: tier.id, label: tier.name }))]} />
                  <AdminSelect label="Country" value={tierRuleDraft.countryId} onChange={(e) => setTierRuleDraft((d) => ({ ...d, countryId: e.target.value }))} options={[{ value: "", label: "Select country" }, ...countryRows.map((country) => ({ value: country.id, label: `${country.name} (${country.code})` }))]} />
                  <AdminSelect label="Variant" value={tierRuleDraft.variantId} onChange={(e) => setTierRuleDraft((d) => ({ ...d, variantId: e.target.value }))} options={[{ value: "", label: "Product-level" }, ...variantRows.map((variant) => ({ value: variant.id, label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title }))]} />
                  <AdminSelect label="Mode" value={tierRuleDraft.mode} onChange={(e) => setTierRuleDraft((d) => ({ ...d, mode: e.target.value as "discount" | "fixed" }))} options={[{ value: "discount", label: "% Discount" }, { value: "fixed", label: "Fixed Price" }]} />
                  <AdminInput label={tierRuleDraft.mode === "discount" ? "Discount %" : "Fixed Price"} type="number" min={0} step="0.01" value={tierRuleDraft.mode === "discount" ? tierRuleDraft.discountPercent : tierRuleDraft.fixedPrice} onChange={(e) => setTierRuleDraft((d) => ({ ...d, [d.mode === "discount" ? "discountPercent" : "fixedPrice"]: e.target.value }))} />
                  <div className="flex items-end">
                    <button type="button" onClick={handleCreateTierRule} disabled={createTierPricing.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">Add Rule</button>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-[#E6E6E6] rounded-md border border-[#E6E6E6]">
                  {tierPricingRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#9A9A9A]">No tier pricing rules yet.</div>
                  ) : tierPricingRows.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                      <span className="font-medium text-[#1A1A1A]">{rule.tier?.name ?? "Tier"}</span>
                      <span className="text-[#6B6B6B]">{rule.country ? `${rule.country.name} (${rule.country.code})` : "Country"}</span>
                      <span className="text-[#6B6B6B]">{rule.variant ? rule.variant.title : "Product-level"}</span>
                      <span className="ml-auto font-semibold text-[#1A1A1A]">{rule.discountPercent ? `${rule.discountPercent}% off` : `${rule.fixedPrice} fixed`}</span>
                      <button type="button" onClick={() => handleDeleteTierRule(rule.id)} className="rounded border border-[#F2C9C9] px-2 py-1 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {pricingSubTab === "moq" && (
              <section className="rounded-lg border border-[#E6E6E6] bg-white p-4">
                <div className="mb-4">
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">MOQ Pricing</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Create quantity price-break rules. Existing variant MOQ remains a minimum-quantity gate only.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-6">
                  <AdminSelect label="Country" value={moqRuleDraft.countryId} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, countryId: e.target.value }))} options={[{ value: "", label: "Select country" }, ...countryRows.map((country) => ({ value: country.id, label: `${country.name} (${country.code})` }))]} />
                  <AdminSelect label="Variant" value={moqRuleDraft.variantId} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, variantId: e.target.value }))} options={[{ value: "", label: "Product-level" }, ...variantRows.map((variant) => ({ value: variant.id, label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title }))]} />
                  <AdminInput label="Min Qty" type="number" min={1} value={moqRuleDraft.minQuantity} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, minQuantity: e.target.value }))} />
                  <AdminSelect label="Mode" value={moqRuleDraft.mode} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, mode: e.target.value as "discount" | "fixed" }))} options={[{ value: "discount", label: "% Discount" }, { value: "fixed", label: "Fixed Price" }]} />
                  <AdminInput label={moqRuleDraft.mode === "discount" ? "Discount %" : "Fixed Price"} type="number" min={0} step="0.01" value={moqRuleDraft.mode === "discount" ? moqRuleDraft.discountPercent : moqRuleDraft.fixedPrice} onChange={(e) => setMoqRuleDraft((d) => ({ ...d, [d.mode === "discount" ? "discountPercent" : "fixedPrice"]: e.target.value }))} />
                  <div className="flex items-end">
                    <button type="button" onClick={handleCreateMoqRule} disabled={createMoqPricing.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">Add Rule</button>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-[#E6E6E6] rounded-md border border-[#E6E6E6]">
                  {moqPricingRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#9A9A9A]">No MOQ pricing rules yet.</div>
                  ) : moqPricingRows.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                      <span className="font-medium text-[#1A1A1A]">{rule.minQuantity}+ units</span>
                      <span className="text-[#6B6B6B]">{rule.country ? `${rule.country.name} (${rule.country.code})` : "Country"}</span>
                      <span className="text-[#6B6B6B]">{rule.variant ? rule.variant.title : "Product-level"}</span>
                      <span className="ml-auto font-semibold text-[#1A1A1A]">{rule.discountPercent ? `${rule.discountPercent}% off` : `${rule.fixedPrice} fixed`}</span>
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
            <h3 className="mb-4 text-[14px] font-semibold text-[#1A1A1A]">Inventory</h3>
            <div className="mb-5">
              {(() => {
                const productLevelInventories = ((product?.inventories ?? []) as NonNullable<VariantRow["inventories"]>).filter((inventory) => !inventory.variantId);
                const baseInventory = productLevelInventories.find((inventory) => !inventory.countryId) ?? null;
                return (
                  <ProductBaseInventoryEditor
                    key={baseInventory?.id ?? "new-product-base-inventory"}
                    productId={productId}
                    inventory={baseInventory}
                    onSaved={refetch}
                    notify={showToast}
                    disabled={isReadOnly}
                  />
                );
              })()}
            </div>
            {variantRows.length > 0 && <div className="space-y-3">
              {variantRows.map((variant) => ({
                    id: variant.id,
                    title: variant.title,
                    inventories: variant.inventories ?? [],
                  })).map(
                (item: { id: string; title: string; inventories?: VariantRow["inventories"] }) => {
                  const baseInventory = getBaseInventory(item.inventories);
                  const countryInventories = (item.inventories ?? []).filter((inventory) => inventory.countryId);
                  const existingCountryIds = new Set(countryInventories.map((inventory) => inventory.countryId).filter(Boolean));
                  const availableOverrideCountries = (productCountries as CountryAvailability[]).filter(
                    (country) => (countryOverrides[country.id] ?? country.enabled) && !existingCountryIds.has(country.id),
                  );
                  const draft = inventoryOverrideDrafts[item.id] ?? { countryId: availableOverrideCountries[0]?.id ?? "", stock: "0" };
                  const canCreateOverride = item.id !== "main" && availableOverrideCountries.length > 0;

                  return (
                    <div key={item.id} className="rounded-lg border border-[#E6E6E6] p-4">
                      <div className="mb-3 text-[13.5px] font-medium text-[#1A1A1A]">{item.title}</div>
                      <div className="space-y-3">
                        {[baseInventory, ...countryInventories].filter(Boolean).map((inventory) => (
                          <div key={inventory?.id ?? `${item.id}-${inventory?.countryId ?? "base"}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#F1F1F1] bg-[#FCFCFC] p-3">
                            <div>
                              <div className="text-[12px] font-medium text-[#1A1A1A]">{inventory?.country ? `${inventory.country.name} (${inventory.country.code})` : "Base Inventory"}</div>
                              <div className="text-[11px] text-[#8A8A8A]">{inventory?.country ? "Overrides base stock for this country." : "Fallback stock used when no country override exists."}</div>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              <div className="text-center">
                                <div className="mb-1 text-[11px] text-[#9A9A9A]">Stock</div>
                                <input
                                  type="number"
                                  min="0"
                                  defaultValue={inventory?.stock || 0}
                                  disabled={isReadOnly}
                                  className="w-20 rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13.5px] outline-none focus:border-[#E31E24] disabled:bg-[#FAFAFA]"
                                  onBlur={async (e) => {
                                    if (!inventory?.id) return;
                                    await adminApi.put(`/inventory/${inventory.id}`, { stock: parseInt(e.target.value) });
                                    showToast("Stock updated.");
                                  }}
                                />
                              </div>
                              <div className="text-center">
                                <div className="mb-1 text-[11px] text-[#9A9A9A]">Low Stock</div>
                                <input
                                  type="number"
                                  min="0"
                                  defaultValue={inventory?.lowStockThreshold || 10}
                                  disabled={isReadOnly}
                                  className="w-20 rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13.5px] outline-none focus:border-[#E31E24] disabled:bg-[#FAFAFA]"
                                  onBlur={async (e) => {
                                    if (!inventory?.id) return;
                                    await adminApi.put(`/inventory/${inventory.id}`, { lowStockThreshold: parseInt(e.target.value) });
                                  }}
                                />
                              </div>
                              {inventory && <StatusBadge status={inventory.status || "INACTIVE"} />}
                            </div>
                          </div>
                        ))}

                        {!isReadOnly && canCreateOverride ? (
                          <div className="rounded-md border border-dashed border-[#E6E6E6] bg-[#FAFAFA] p-3">
                            <div className="mb-2 text-[12px] font-medium text-[#1A1A1A]">Add country override</div>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="min-w-[180px] flex-1">
                                <AdminSelect
                                  label="Country"
                                  value={draft.countryId}
                                  onChange={(e) =>
                                    setInventoryOverrideDrafts((current) => ({
                                      ...current,
                                      [item.id]: { ...draft, countryId: e.target.value },
                                    }))
                                  }
                                  options={[
                                    { value: "", label: "Select country" },
                                    ...availableOverrideCountries.map((country) => ({
                                      value: country.id,
                                      label: `${country.name} (${country.code})`,
                                    })),
                                  ]}
                                />
                              </div>
                              <div>
                                <AdminInput
                                  label="Stock"
                                  type="number"
                                  min={0}
                                  value={draft.stock}
                                  onChange={(e) =>
                                    setInventoryOverrideDrafts((current) => ({
                                      ...current,
                                      [item.id]: { ...draft, stock: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]"
                                onClick={async () => {
                                  if (!draft.countryId) {
                                    showToast("Select a country for the override.", "error");
                                    return;
                                  }
                                  const stock = Math.max(0, parseInt(draft.stock || "0", 10) || 0);
                                  try {
                                    await adminApi.post("/inventory/upsert", {
                                      variantId: item.id,
                                      countryId: draft.countryId,
                                      stock,
                                    });
                                    setInventoryOverrideDrafts((current) => {
                                      const next = { ...current };
                                      delete next[item.id];
                                      return next;
                                    });
                                    showToast("Country inventory override created.");
                                    refetch();
                                  } catch (error) {
                                    showToast(getAdminErrorMessage(error, "Failed to create country override."), "error");
                                  }
                                }}
                              >
                                Add Override
                              </button>
                            </div>
                          </div>
                        ) : (
                          !countryInventories.length && (
                            <p className="rounded-md border border-dashed border-[#E6E6E6] px-3 py-2 text-[12px] text-[#8A8A8A]">
                              {item.id === "main"
                                ? "Enable variants to manage country overrides."
                                : "Enable countries in Country Availability first, then add overrides here."}
                            </p>
                          )
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>}
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
                    highlights?: Array<{ title: string; description: string }> | string | null;
                    technicalSpecs?: Array<{ label: string; value: string }> | string | null;
                    warranty?: string[] | string | null;
                    primaryFeatures?: Array<{ title: string; description: string }> | string | null;
                    isAiGenerated?: boolean;
                    status?: string;
                  } | undefined;
                  const draft = translationDrafts[activeTranslationLang.id] ?? {
                    highlights: Array.isArray(t?.highlights)
                      ? t.highlights
                      : Array.isArray(product.highlights)
                        ? (product.highlights as Array<{ title: string; description: string }>)
                        : [],
                    technicalSpecs: Array.isArray(t?.technicalSpecs)
                      ? t.technicalSpecs
                      : Array.isArray(product.technicalSpecs)
                        ? (product.technicalSpecs as Array<{ label: string; value: string }>)
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
                      <TranslationBlurField
                        key={`description-${activeTranslationLang.id}-${t?.description ?? ""}`}
                        label="Description"
                        rows={5}
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
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Highlights</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add title and description for each highlight.</p>
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
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Technical Specifications</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add label and value rows for the translated table.</p>
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
                            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Primary Features</h4>
                            <p className="text-[12.5px] text-[#6B6B6B]">Add translated feature title and description pairs.</p>
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
                  mappedAttributeRows.map((mapping) => (
                    <div key={mapping.id} className="rounded-lg border border-[#E6E6E6] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">{mapping.attribute.name}</h4>
                            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", roleBadgeClass(getDisplayTypeRole(mapping.gridAxis)))}>
                              {getDisplayTypeLabel(mapping.gridAxis)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {mapping.allowedValues.length ? (
                              mapping.allowedValues.map((allowedValue) => (
                                <span key={allowedValue.attributeValueId} className="rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[11.5px] text-[#555]">
                                  {allowedValue.attributeValue.value}
                                </span>
                              ))
                            ) : (
                              <span className="text-[12px] text-[#9A9A9A]">No allowed values selected.</span>
                            )}
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
                            <button
                              type="button"
                              onClick={() => handleRemoveProductAttribute(mapping.attributeId)}
                              disabled={removeProductAttribute.isPending}
                              className="rounded-md border border-[#F2C9C9] px-2.5 py-1.5 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {canManageAttributes && (
                <div className="rounded-lg border border-[#E6E6E6] p-4">
                  <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Add Attribute</h4>
                  <div className="mt-4 space-y-4">
                    <AdminSelect
                      label="Attribute"
                      value={selectedMappingAttributeId}
                      onChange={(e) => {
                        setSelectedMappingAttributeId(e.target.value);
                        setNewMappingGridAxis(null);
                        setNewMappingValueIds([]);
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
                            <span className="text-[12px] text-[#9A9A9A]">{newMappingValueIds.length} selected</span>
                          </div>

                        <div className="flex flex-wrap items-center gap-2">
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
                          <span className="text-[12px] text-[#9A9A9A]">
                            {newMappingValueIds.length} of {selectedAttributeValues.length} selected
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {selectedAttributeValues.map((value) => (
                            <label key={value.id} className="flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[12.5px]">
                              <input
                                type="checkbox"
                                checked={newMappingValueIds.includes(value.id)}
                                onChange={() => toggleNewMappingValue(value.id)}
                                className="h-4 w-4 accent-[#E31E24]"
                              />
                              {value.value}
                            </label>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleAddProductAttribute}
                          disabled={assignProductAttributes.isPending}
                          className="w-full rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                        >
                          {assignProductAttributes.isPending ? "Saving..." : "Map Attribute"}
                        </button>
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-[#E6E6E6] px-3 py-6 text-center text-[12.5px] text-[#9A9A9A]">
                        Select an attribute to choose allowed values.
                      </p>
                    )}
                  </div>
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
                <span className="text-[12px] text-[#9A9A9A]">{enabledCountryCount} enabled</span>
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
                {(productCountries as CountryAvailability[]).map((country) => (
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
            <AdminInput label="SEO Title (max 60 chars)" maxLength={60} {...formik.getFieldProps("seoTitle")} error={formik.touched.seoTitle ? (formik.errors.seoTitle as string) : ""} />
            <div className="text-[12px] text-[#9A9A9A]">{formik.values.seoTitle.length}/60 characters</div>
            <AdminTextarea label="SEO Description (max 160 chars)" rows={3} maxLength={160} {...formik.getFieldProps("seoDescription")} />
            <div className="text-[12px] text-[#9A9A9A]">{formik.values.seoDescription.length}/160 characters</div>
            <AdminInput label="SEO Keywords" placeholder="Comma-separated" {...formik.getFieldProps("seoKeywords")} />
            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#F8F8F8] p-4">
              <p className="mb-2 text-[11.5px] font-medium uppercase text-[#9A9A9A]">Google Preview</p>
              <p className="cursor-pointer text-[16px] font-medium text-[#1A0DAB] hover:underline">{formik.values.seoTitle || product.title}</p>
              <p className="text-[13px] text-[#006621]">modortho.com › products › {product.slug}</p>
              <p className="mt-1 line-clamp-2 text-[13.5px] text-[#545454]">{formik.values.seoDescription || product.shortDescription || "No meta description."}</p>
            </div>
          </div>
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
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                        <Upload size={14} />
                        {uploadingPackageImage ? "Uploading..." : "Upload image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => void uploadPackageImage(event.target.files?.[0])}
                          disabled={uploadingPackageImage}
                        />
                      </label>
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

      {generateVariantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex h-[92vh] w-full max-w-[1360px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="shrink-0 border-b border-[#E6E6E6] px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1A1A1A]">Generate Variants</h3>
                <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#6B6B6B]">
                  {hasMappedProductAttributes
                    ? "Showing attributes mapped to this product. Add values in Product Attributes before using them here."
                    : "No product attribute mappings found, so this uses the full global catalog exactly as before."}
                </p>
              </div>
              <button onClick={() => setGenerateVariantOpen(false)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-7">
              <div className="space-y-5">

            {packageRows.length > 0 && (
              <div className="mb-5 rounded-lg border border-[#E6E6E6] p-4">
                <div className="mb-2 text-[13px] font-medium text-[#1A1A1A]">Packages</div>
                <div className="flex flex-wrap gap-2">
                  {packageRows.map((pkg) => {
                    const checked = generatePackageIds.includes(pkg.id);
                    return (
                      <label key={pkg.id} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]", checked ? "border-[#E31E24] bg-red-50 text-[#B5151B]" : "border-[#E6E6E6] bg-white text-[#6B6B6B]")}>
                        <input type="checkbox" checked={checked} onChange={(e) => toggleGeneratePackage(pkg.id, e.target.checked)} className="rounded" />
                        {pkg.title}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[12.5px] leading-5 text-blue-800">
              New variants inherit the product-level base inventory and every country inventory override configured in the Inventory tab.
            </div>

            <div className="mb-5 rounded-lg border border-[#E6E6E6] p-4">
              <div className="mb-3 text-[13px] font-medium text-[#1A1A1A]">Base Price (optional)</div>
              <p className="mb-3 text-[12.5px] leading-5 text-[#6B6B6B]">
                Enter the base manufacturer price to automatically generate per-country landed prices (including each country&apos;s customs duty and shipping) for these variants as they are created. Leave blank to set prices later.
              </p>
              <AdminInput
                label="Base Price"
                type="number"
                min="0"
                step="0.01"
                value={generateVariantBasePrice}
                onChange={(event) => setGenerateVariantBasePrice(event.target.value)}
                placeholder="Enter base price"
              />
            </div>

            {/* <div className="mb-4 rounded-lg border border-[#E6E6E6] p-4">
              <div className="mb-3 text-[13px] font-medium text-[#1A1A1A]">Add Attributes To Generation</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <AdminSelect
                    value={generateAttributePicker}
                    onChange={(e) => setGenerateAttributePicker(e.target.value)}
                    options={[
                      { value: "", label: "Select attribute…" },
                      ...variantGenerationCatalog
                        .filter((attribute) => !generateAttributeIds.includes(attribute.id))
                        .map((attribute) => ({ value: attribute.id, label: attribute.name })),
                    ]}
                  />
                </div>
                <button onClick={addGenerateAttribute} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                  Add Attribute
                </button>
              </div>
            </div> */}

            <div className="space-y-4">
              {generateAttributeIds.map((attributeId) => {
                const attribute = variantGenerationCatalog.find((item) => item.id === attributeId);
                if (!attribute) return null;
                const mode = generateModeMap[attribute.id] === "skip" ? "all" : (generateModeMap[attribute.id] ?? "all");
                const selectedValueIds = generateSelectionMap[attribute.id] ?? [];
                const values = getAttributeValues(attribute);
                const selectedValues = values.filter((value) => selectedValueIds.includes(value.id));
                const availableValues = values.filter((value) => !selectedValueIds.includes(value.id));

                return (
                  <div key={attribute.id} className="rounded-lg border border-[#E6E6E6] p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-[#1A1A1A]">{attribute.name} <span className="ml-1 font-normal text-[#9A9A9A]">{attribute.id}</span></div>
                      </div>
                      <button onClick={() => removeGenerateAttribute(attribute.id)} className="text-[13px] font-medium text-[#E31E24] hover:text-[#B5151B]">
                        Remove
                      </button>
                    </div>

                    <div className="mb-4 max-w-[240px]">
                      <AdminSelect
                        value={mode}
                        onChange={(e) => setGenerateAttributeMode(attribute.id, e.target.value as GenerateAttributeMode)}
                        options={[
                          { value: "all", label: "Use All Values" },
                          { value: "specific", label: "Select Specific Values" },
                        ]}
                      />
                    </div>

                    {mode === "all" && (
                      <div className="rounded-md bg-[#FAFAFA] px-3 py-2 text-[12px] text-[#6B6B6B]">
                        All {values.length} values of {attribute.name} will be used.
                      </div>
                    )}

                    {mode === "specific" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {selectedValues.map((value) => (
                            <span key={value.id} className="inline-flex items-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-4 py-2 text-[12px] text-[#1A1A1A]">
                              {value.value}
                              <button type="button" onClick={() => removeGenerateSpecificValue(attribute.id, value.id)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                        {availableValues.length > 0 && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="sm:min-w-[220px]">
                              <AdminSelect
                                value={generateValuePickerMap[attribute.id] ?? ""}
                                onChange={(e) => setGenerateValuePicker(attribute.id, e.target.value)}
                                options={[
                                  { value: "", label: "Add value" },
                                  ...availableValues.map((value) => ({ value: value.id, label: value.value })),
                                ]}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const valueId = generateValuePickerMap[attribute.id] ?? "";
                                if (!valueId) return;
                                addGenerateSpecificValue(attribute.id, valueId);
                                setGenerateValuePicker(attribute.id, "");
                              }}
                              className="rounded-full border border-dashed border-[#BDBDBD] px-4 py-2 text-[12px] font-medium text-[#6B6B6B] hover:border-[#9A9A9A] hover:bg-[#FAFAFA]"
                            >
                              + Add value
                            </button>
                          </div>
                        )}
                        {selectedValues.length === 0 && values.length === 0 && (
                          <p className="text-[12px] text-[#E31E24]">No values found for this attribute. Add values in Admin → Attributes first.</p>
                        )}
                        {selectedValues.length === 0 && values.length > 0 && (
                          <p className="text-[12px] text-[#9A9A9A]">Add one or more values for this attribute, or switch to Use All Values.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E6E6E6] bg-white px-6 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] text-[#6B6B6B]">Review the selected packages and attribute values before generating variants.</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setGenerateVariantOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">
                    Cancel
                  </button>
                  <button onClick={handleGenerateVariants} disabled={generatingVariants} className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#333] disabled:opacity-40">
                    {generatingVariants ? "Generating…" : "Generate Variants"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {manualVariantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-[920px] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            {(() => {
              const createsMultiple = manualVariantAttributeIds.some((attributeId) => (manualVariantModeMap[attributeId] ?? "single") !== "single");
              const selectedValueCount = manualVariantAttributeIds.reduce((count, attributeId) => count + (manualVariantSelectionMap[attributeId] ?? []).length, 0);

              return (
                <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1A1A1A]">Create Manual Variant</h3>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">Pick a package, add only the relevant attributes, then click values directly.</p>
              </div>
              <button onClick={() => setManualVariantOpen(false)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-[#F0E2E2] bg-[#FFF8F8] p-4 text-[12px] text-[#6B6B6B] sm:grid-cols-3">
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
                <div className="mt-1">{createsMultiple ? "This will create multiple variants." : "This will create one exact variant."}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {packageRows.length > 0 && <AdminSelect label="Package" value={manualVariantPackageId} onChange={(e) => setManualVariantPackageId(e.target.value)} options={packageOptions} />}
              <AdminInput label="SKU" value={manualVariantSku} onChange={(e) => setManualVariantSku(e.target.value)} placeholder="Optional custom SKU" />
              <AdminInput label="MOQ" type="number" min={1} value={manualVariantMoq} onChange={(e) => setManualVariantMoq(Math.max(1, Number(e.target.value) || 1))} />
            </div>

            <div className="mt-5 rounded-lg border border-[#E6E6E6] p-4">
              <div className="mb-1 text-[13px] font-medium text-[#1A1A1A]">Choose Attributes For This Variant</div>
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
                <button onClick={addManualVariantAttribute} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
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
                        <button type="button" onClick={() => removeManualVariantAttribute(attributeId)} className="text-[#D06F6F] hover:text-[#B5151B]">
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3 text-[12px] text-[#6B6B6B]">
              <span className="font-semibold text-[#1A1A1A]">{manualVariantAttributeIds.length}</span> attributes selected,{" "}
              <span className="font-semibold text-[#1A1A1A]">{selectedValueCount}</span> values chosen.
            </div>

            <div className="mt-4 space-y-4">
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
                      <button onClick={() => removeManualVariantAttribute(attribute.id)} className="text-[13px] font-medium text-[#E31E24] hover:text-[#B5151B]">
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
                              "rounded-full border px-4 py-2 text-[12px] font-medium transition",
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
                                className="rounded-full border border-[#E6E6E6] px-3 py-1 text-[11px] text-[#6B6B6B] hover:bg-[#F5F5F5]"
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                onClick={() => clearManualVariantValues(attribute.id)}
                                className="rounded-full border border-[#E6E6E6] px-3 py-1 text-[11px] text-[#6B6B6B] hover:bg-[#F5F5F5]"
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
                                  "rounded-full border px-4 py-2 text-[12px] transition",
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

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setManualVariantOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
              <button onClick={handleCreateManualVariant} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                {createsMultiple ? "Create Variants" : "Create Variant"}
              </button>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {variantCountryModalVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[88vh] w-full max-w-[720px] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1A1A1A]">Variant Country Availability</h3>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">
                  Visibility for {variantCountryModalVariant.title}. New variants start hidden in every country until enabled here.
                </p>
              </div>
              <button onClick={closeVariantCountriesModal} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2">
              <span className="text-[13px] font-medium text-[#1A1A1A]">{variantCountryModalVariant.sku || "No SKU"}</span>
              <span className="text-[12px] text-[#9A9A9A]">
                {(variantCountries as CountryAvailability[]).filter((country) => variantCountryOverrides[country.id] ?? country.enabled).length} enabled
              </span>
            </div>

            {variantCountriesLoading ? (
              <div className="h-28 animate-pulse rounded-md bg-[#F2F2F2]" />
            ) : (variantCountries as CountryAvailability[]).length === 0 ? (
              <p className="rounded-md border border-[#E6E6E6] px-3 py-4 text-[13px] text-[#9A9A9A]">No countries found.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {(variantCountries as CountryAvailability[]).map((country) => (
                  <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2">
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

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={closeVariantCountriesModal} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
              <button
                onClick={saveVariantCountryAvailability}
                disabled={updateVariantCountries.isPending || variantCountriesLoading}
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
              >
                {updateVariantCountries.isPending ? "Saving..." : "Save Availability"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-[920px] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1A1A1A]">Edit Variant</h3>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">Update variant details, country prices, tier overrides, and MOQ rules.</p>
              </div>
              <button onClick={closeEditVariantModal} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

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
                    "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
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
                  {packageRows.length > 0 && <AdminSelect label="Package" value={editVariantPackageId} onChange={(e) => setEditVariantPackageId(e.target.value)} options={[{ value: "", label: "No package" }, ...packageOptions.slice(1)]} />}
                  <AdminSelect label="Status" value={editVariantStatus} onChange={(e) => setEditVariantStatus(e.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
                  <AdminInput label="Variant Title" value={editVariantTitle} onChange={(e) => setEditVariantTitle(e.target.value)} placeholder="Optional custom title" />
                  <AdminInput label="SKU" value={editVariantSku} onChange={(e) => setEditVariantSku(e.target.value)} placeholder="Variant SKU" />
                  <AdminInput label="MOQ" type="number" min={1} value={editVariantMoq} onChange={(e) => setEditVariantMoq(Math.max(1, Number(e.target.value) || 1))} />
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
                  const countries = (variantCountries as CountryAvailability[]).filter((c) => c.enabled);
                  if (countries.length === 0) {
                    return <p className="text-[13px] text-[#9A9A9A] py-4 text-center">No countries enabled for this product/variant. Enable them in Country Availability first.</p>;
                  }
                  return countries.map((country) => {
                    const draft = editVariantCountryPrices[country.id] ?? { mrp: "", sellingPrice: "", dealerPrice: "", doctorRetailerPrice: "", stock: "" };
                    const currencySymbol = country.currency?.symbol ?? "$";
                    return (
                      <div key={country.id} className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                        <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">{country.name} ({country.code})</div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <AdminInput
                            label={`MRP (${currencySymbol})`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.mrp}
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
                      options={[{ value: "", label: "Select country" }, ...countryRows.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]}
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <AdminSelect
                      label="Country"
                      value={modalMoqRuleDraft.countryId}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, countryId: e.target.value }))}
                      options={[{ value: "", label: "Select country" }, ...countryRows.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]}
                    />
                    <AdminInput
                      label="Min Qty"
                      type="number"
                      min={1}
                      value={modalMoqRuleDraft.minQuantity}
                      onChange={(e) => setModalMoqRuleDraft((d) => ({ ...d, minQuantity: e.target.value }))}
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
                              discountPercent: modalMoqRuleDraft.mode === "discount" ? Number(modalMoqRuleDraft.discountPercent) || 0 : null,
                              fixedPrice: modalMoqRuleDraft.mode === "fixed" ? Number(modalMoqRuleDraft.fixedPrice) || 0 : null,
                            };
                            await createMoqPricing.mutateAsync(payload);
                            showToast("MOQ pricing rule added.");
                            setModalMoqRuleDraft({ countryId: "", minQuantity: "", mode: "discount", discountPercent: "", fixedPrice: "" });
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
                        <span className="font-medium text-[#1A1A1A]">{rule.minQuantity}+ units</span>
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

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={closeEditVariantModal} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
              <button onClick={handleUpdateVariant} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">Save Variant</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deletingMedia}
        title="Delete this image?"
        message="This will permanently remove the file from storage."
        onConfirm={() => deletingMedia && handleDeleteMedia(deletingMedia)}
        onCancel={() => setDeletingMedia(null)}
      />

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

      <Modal
        open={countryPriceModalOpen}
        onClose={closeCountryPriceModal}
        title="Generate Country Prices"
        panelClassName="max-w-3xl"
      >
        <div className="space-y-5 p-6">
          <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
            Enter the base product prices once, and country prices will be generated automatically using the configured exchange rates. Set variant overrides below if needed.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminInput
              label="Base MRP *"
              type="number"
              min="0"
              step="0.01"
              value={countryPriceMRP}
              onChange={(event) => setCountryPriceMRP(event.target.value)}
              placeholder="Enter base MRP"
            />
            <AdminInput
              label="Base Selling Price (optional)"
              type="number"
              min="0"
              step="0.01"
              value={countryPriceSellingPrice}
              onChange={(event) => setCountryPriceSellingPrice(event.target.value)}
              placeholder="Same as MRP"
            />
            <AdminInput
              label="Base Dealer Price (optional)"
              type="number"
              min="0"
              step="0.01"
              value={countryPriceDealerPrice}
              onChange={(event) => setCountryPriceDealerPrice(event.target.value)}
              placeholder="Not set"
            />
            <AdminInput
              label="Base Doctor / Retailer Price (optional)"
              type="number"
              min="0"
              step="0.01"
              value={countryPriceDistributorPrice}
              onChange={(event) => setCountryPriceDistributorPrice(event.target.value)}
              placeholder="Not set"
            />
          </div>

          {variantRows.length > 0 ? (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#1A1A1A]">
                  Per-variant overrides
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
                      <th className="px-3.5 py-2.5 text-right font-medium">MRP</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Selling Price</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Dealer Price</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Doctor Price</th>
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
