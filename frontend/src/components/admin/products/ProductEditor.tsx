"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Upload, Trash2, RefreshCw, Plus, Zap, Copy, X, Pencil, Save, Globe2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, StatusBadge, useToast, ConfirmModal, DataTable, Column, toastMessages } from "@/components/admin/AdminComponents";
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
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import {
  filterTranslationLanguages,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationEditorBanner,
  NoTranslationLanguagesMessage,
} from "@/components/admin/TranslationEditorUi";

const TABS = ["Basic Info", "Media", "Packages", "Variants", "Pricing", "Inventory", "Translations", "Product Attributes", "Country Availability", "SEO"];

const basicSchema = Yup.object({
  title: Yup.string().required("Required"),
  categoryId: Yup.string().required("Required"),
  status: Yup.string().required(),
  productCode: Yup.string(),
  sku: Yup.string(),
  brand: Yup.string(),
  shortDescription: Yup.string().max(300),
  description: Yup.string(),
  isFeatured: Yup.boolean(),
  hasVariants: Yup.boolean(),
  seoTitle: Yup.string().max(60),
  seoDescription: Yup.string().max(160),
  seoKeywords: Yup.string(),
});

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
  inventory?: { id?: string; stock: number; lowStockThreshold?: number | null; status?: string | null } | null;
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
    attributeValue?: { value: string };
  }[];
};

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

type ProductAttributeMapping = {
  id: string;
  productId: string;
  attributeId: string;
  required: boolean;
  gridAxis?: GridAxis | null;
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
type ProductTranslationField = "title" | "shortDescription" | "description" | "seoTitle" | "seoDescription";

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
                          <span>Stock: {cell.variant.inventory?.stock ?? "No stock"}</span>
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
};

export function ProductEditor({ productId }: ProductEditorProps) {
  const searchParams = useSearchParams();
  const variantIdFromQuery = searchParams.get("variant");
  const [activeTab, setActiveTab] = useState(0);
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
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [generateVariantOpen, setGenerateVariantOpen] = useState(false);
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
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [variantCountryModalVariant, setVariantCountryModalVariant] = useState<VariantRow | null>(null);
  const [variantCountryOverrides, setVariantCountryOverrides] = useState<Record<string, boolean>>({});
  const [selectedMappingAttributeId, setSelectedMappingAttributeId] = useState("");
  const [newMappingRequired, setNewMappingRequired] = useState(true);
  const [newMappingGridAxis, setNewMappingGridAxis] = useState<GridAxis | null>(null);
  const [newMappingValueIds, setNewMappingValueIds] = useState<string[]>([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkCountryId, setBulkCountryId] = useState("");
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, BulkVariantDraft>>({});
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [tierRuleDraft, setTierRuleDraft] = useState<RuleDraft>(emptyRuleDraft);
  const [moqRuleDraft, setMoqRuleDraft] = useState<RuleDraft>(emptyRuleDraft);
  const { showToast, ToastComponent } = useToast();

  const { data: product, isLoading, refetch } = useAdminProduct(productId);
  const { data: productCountries = [], isLoading: countriesLoading } = useAdminProductCountries(productId);
  const { data: variantCountries = [], isLoading: variantCountriesLoading } = useAdminVariantCountries(productId, variantCountryModalVariant?.id);
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

  const translationLanguages = useMemo(() => filterTranslationLanguages(languages), [languages]);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];

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
            values: mapping.allowedValues.map((allowedValue) => ({
              id: allowedValue.attributeValueId,
              value: allowedValue.attributeValue.value,
            })),
          }))
        : attributeCatalog,
    [attributeCatalog, hasMappedProductAttributes, mappedAttributeRows]
  );
  const packageRows = useMemo(() => (product?.packages ?? []) as PackageRow[], [product?.packages]);
  const variantRows = useMemo(() => (product?.variants ?? []) as VariantRow[], [product?.variants]);
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

  const formik = useFormik({
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
      isFeatured: product?.isFeatured || false,
      hasVariants: product?.hasVariants || false,
      seoTitle: product?.seoTitle || "",
      seoDescription: product?.seoDescription || "",
      seoKeywords: product?.seoKeywords || "",
    },
    validationSchema: basicSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        await updateProduct.mutateAsync(values);
        showToast("Product saved.");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Save failed."), "error");
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
    { key: "title", label: "Variant" },
    { key: "package", label: "Package", render: (row) => row.package?.title ?? "Default" },
    { key: "sku", label: "SKU" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "stock", label: "Stock", render: (row) => row.inventory?.stock ?? "—" },
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

    const variantPackageKeys = new Set(variantRows.map((variant) => variant.packageId ?? "default"));
    if (variantPackageKeys.size > 1) {
      reasons.push("more than one package is present, so each row/column cell would match multiple package variants");
    }

    const rows = rowValues.map((rowValue) => ({
      value: rowValue,
      cells: columnValues.map((columnValue) => {
        const matches = variantRows.filter((variant) => {
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
  }, [mappedAttributeRows, variantRows]);
  const variantDisplayMode = variantGridState.mode;

  const pricingCols: Column<{
    id: string;
    country: { name: string; code: string };
    currency: { symbol: string };
    mrp: number;
    sellingPrice: number;
    dealerPrice?: number | null;
    distributorPrice?: number | null;
    status: string;
  }>[] = [
    { key: "country", label: "Country", render: (r) => `${r.country.name} (${r.country.code})` },
    { key: "mrp", label: "MRP", render: (r) => `${r.currency.symbol}${r.mrp}` },
    { key: "sellingPrice", label: "Selling Price", render: (r) => `${r.currency.symbol}${r.sellingPrice}` },
    { key: "dealerPrice", label: "Dealer", render: (r) => (r.dealerPrice != null ? `${r.currency.symbol}${r.dealerPrice}` : "—") },
    { key: "distributorPrice", label: "Doctor / Retailer", render: (r) => (r.distributorPrice != null ? `${r.currency.symbol}${r.distributorPrice}` : "—") },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

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
      stock: bulkDrafts[variant.id]?.stock ?? (variant.inventory?.stock !== undefined && variant.inventory?.stock !== null ? `${variant.inventory.stock}` : ""),
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
        const currentStockValue = variant.inventory?.stock !== undefined && variant.inventory?.stock !== null ? `${variant.inventory.stock}` : "";
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
      await assignProductAttributes.mutateAsync([
        ...toProductAttributePayload(mappedAttributeRows),
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
          mapping.attributeId === attributeId ? { ...mapping, gridAxis } : mapping
        )
      );
      showToast("Grid axis updated.");
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

  const roleBadgeClass = (role: AttributeRole) =>
    role === "DROPDOWN"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : role === "X_GRID"
        ? "border-purple-200 bg-purple-50 text-purple-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const getDisplayTypeLabel = (gridAxis?: GridAxis | null, fallbackRole?: AttributeRole) => {
    const role = gridAxis === "ROW" ? "Y_GRID" : gridAxis === "COLUMN" ? "X_GRID" : fallbackRole ?? "DROPDOWN";
    return role === "X_GRID" ? "Matrix columns" : role === "Y_GRID" ? "Matrix rows" : "Dropdown filter";
  };

  const getDisplayTypeValue = (gridAxis?: GridAxis | null, fallbackRole?: AttributeRole) => {
    if (gridAxis === "ROW") return "ROW";
    if (gridAxis === "COLUMN") return "COLUMN";
    if (fallbackRole === "X_GRID") return "COLUMN";
    if (fallbackRole === "Y_GRID") return "ROW";
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
    setGeneratePackageIds(packageRows.map((pkg) => pkg.id));
    setGenerateAttributeIds([]);
    setGenerateSelectionMap({});
    setGenerateModeMap(
      Object.fromEntries(variantGenerationCatalog.map((attribute) => [attribute.id, "skip"])) as GenerateModeMap
    );
    setGenerateAttributePicker("");
    setGenerateValuePickerMap({});
    setGenerateVariantOpen(true);
  };

  const openEditVariantModal = (variant: VariantRow) => {
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
  };

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
      showToast("Variant updated.");
      setEditingVariant(null);
      refetch();
    } catch {
      showToast("Failed to update variant.", "error");
    }
  };

  const handleGenerateVariants = async () => {
    const selectedAttributes = variantGenerationCatalog
      .filter((attribute) => generateAttributeIds.includes(attribute.id))
      .map((attribute) => {
        const mode = generateModeMap[attribute.id] ?? "skip";
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
      showToast("Select at least one attribute group.", "error");
      return;
    }

    const specificMissing = variantGenerationCatalog
      .filter((attribute) => generateAttributeIds.includes(attribute.id))
      .some((attribute) => {
      const mode = generateModeMap[attribute.id] ?? "skip";
      return mode === "specific" && !(generateSelectionMap[attribute.id] ?? []).length;
    });
    if (specificMissing) {
      showToast("Choose specific values for every attribute set to Specific Values.", "error");
      return;
    }

    setGeneratingVariants(true);
    try {
      const result = await adminApi.post(`/products/${productId}/generate-variants`, {
        packageIds: generatePackageIds,
        attributes: selectedAttributes,
      });
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
    setGenerateModeMap((current) => ({ ...current, [generateAttributePicker]: "specific" }));
    setGenerateAttributePicker("");
  };

  const removeGenerateAttribute = (attributeId: string) => {
    setGenerateAttributeIds((current) => current.filter((id) => id !== attributeId));
    setGenerateSelectionMap((current) => {
      const next = { ...current };
      delete next[attributeId];
      return next;
    });
    setGenerateModeMap((current) => ({ ...current, [attributeId]: "skip" }));
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
          {variantRows.map((variant) => {
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
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                activeTab === i ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 0 || activeTab === 9 ? (
          <button
            type="button"
            onClick={() => formik.handleSubmit()}
            disabled={formik.isSubmitting}
            className="rounded-md bg-[#E31E24] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
          >
            {formik.isSubmitting ? "Saving…" : "Save Changes"}
          </button>
        ) : null}
      </div>

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
            <AdminTextarea label="Short Description (max 300)" rows={2} maxLength={300} {...formik.getFieldProps("shortDescription")} />
            <AdminTextarea label="Full Description" rows={7} {...formik.getFieldProps("description")} />
          </div>
        )}

        {activeTab === 1 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Images &amp; Files</h3>
              <label className={cn("flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium text-white cursor-pointer", uploadingMedia ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                <Upload size={14} />
                {uploadingMedia ? "Uploading…" : "Upload Files"}
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia} />
              </label>
            </div>
            {product.media?.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-[#E6E6E6] text-[13.5px] text-[#9A9A9A]">
                No media uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {product.media?.map((m: { id: string; url: string; altText: string; type: string }) => (
                  <div key={m.id} className="group relative aspect-square rounded-lg border border-[#E6E6E6] overflow-hidden bg-[#F8F8F8]">
                    {m.type === "IMAGE" ? (
                      <img src={m.url} alt={m.altText || ""} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[11px] text-[#6B6B6B]">PDF</div>
                    )}
                    <button
                      onClick={() => setDeletingMedia(m.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={18} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[12px] text-[#9A9A9A]">Supported: JPEG, PNG, WebP, PDF. Max 20MB per file.</p>
          </div>
        )}

        {activeTab === 2 && (
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

        {activeTab === 3 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Variants</h3>
                <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Variants are created from package + selected attribute values.</p>
              </div>
              <div className="flex flex-wrap gap-2">
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
              <DataTable columns={variantCols} data={variantRows} rowKey="id" emptyMessage="No variants created yet." />
            )}
          </div>
        )}

        {activeTab === 4 && (
          <div className="space-y-6 p-6">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country-wise Pricing</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Set prices per country. Use Generate to auto-convert from base price.</p>
                </div>
                <button
                  onClick={async () => {
                    const base = prompt("Enter base price in USD:");
                    if (!base) return;
                    try {
                      await adminApi.post("/pricing/generate-country-prices", {
                        productId,
                        basePrice: parseFloat(base),
                        baseCurrencyId: product.defaultCurrencyId || undefined,
                      });
                      showToast("Country prices generated.");
                      refetch();
                    } catch {
                      showToast("Failed.", "error");
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
                >
                  <RefreshCw size={14} /> Generate All Country Prices
                </button>
              </div>
              <DataTable columns={pricingCols} data={product.prices || []} rowKey="id" emptyMessage="No pricing set. Use Generate to auto-fill all countries." />
            </section>

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
          </div>
        )}

        {activeTab === 5 && (
          <div className="p-6">
            <h3 className="mb-4 text-[14px] font-semibold text-[#1A1A1A]">Inventory</h3>
            <div className="space-y-3">
              {(variantRows.length ? variantRows : [{ id: "main", title: "Main Stock", inventory: null }]).map((v: { id: string; title: string; inventory?: { id?: string; stock: number; lowStockThreshold?: number | null; status?: string | null } | null }) => (
                <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E6E6E6] p-4">
                  <span className="min-w-[160px] text-[13.5px] font-medium text-[#1A1A1A]">{v.title}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="text-center">
                      <div className="mb-1 text-[11px] text-[#9A9A9A]">Stock</div>
                      <input
                        type="number"
                        min="0"
                        defaultValue={v.inventory?.stock || 0}
                        className="w-20 rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13.5px] outline-none focus:border-[#E31E24]"
                        onBlur={async (e) => {
                          if (!v.inventory?.id) return;
                          await adminApi.put(`/inventory/${v.inventory.id}`, { stock: parseInt(e.target.value) });
                          showToast("Stock updated.");
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="mb-1 text-[11px] text-[#9A9A9A]">Low Stock</div>
                      <input
                        type="number"
                        min="0"
                        defaultValue={v.inventory?.lowStockThreshold || 10}
                        className="w-20 rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13.5px] outline-none focus:border-[#E31E24]"
                        onBlur={async (e) => {
                          if (!v.inventory?.id) return;
                          await adminApi.put(`/inventory/${v.inventory.id}`, { lowStockThreshold: parseInt(e.target.value) });
                        }}
                      />
                    </div>
                    {v.inventory && <StatusBadge status={v.inventory.status || "INACTIVE"} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 6 && (
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
                    isAiGenerated?: boolean;
                    status?: string;
                  } | undefined;

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
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 7 && (
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Attributes</h3>
                <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#6B6B6B]">
                  Mapping attributes here defines which values are valid for this product. Future variant generation uses these mapped attributes by default; products with no mappings can still use the global catalog.
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", roleBadgeClass(mapping.attribute.role))}>
                              {getDisplayTypeLabel(mapping.gridAxis, mapping.attribute.role as AttributeRole)}
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
                              value={getDisplayTypeValue(mapping.gridAxis, mapping.attribute.role as AttributeRole)}
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
                              disabled={assignProductAttributes.isPending}
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveProductAttribute(mapping.attributeId)}
                            disabled={removeProductAttribute.isPending}
                            className="rounded-md border border-[#F2C9C9] px-2.5 py-1.5 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-[#E6E6E6] p-4">
                <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Add Attribute</h4>
                <div className="mt-4 space-y-4">
                  <AdminSelect
                    label="Attribute"
                    value={selectedMappingAttributeId}
                    onChange={(e) => {
                      setSelectedMappingAttributeId(e.target.value);
                      const attribute = availableMappingAttributes.find((item) => item.id === e.target.value);
                      setNewMappingGridAxis(attribute?.role === "X_GRID" ? "COLUMN" : attribute?.role === "Y_GRID" ? "ROW" : null);
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
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium", roleBadgeClass(selectedAttributeDetail?.role as AttributeRole))}>
                      {getDisplayTypeLabel(newMappingGridAxis, selectedAttributeDetail?.role as AttributeRole)}
                    </span>
                    <span className="text-[12px] text-[#9A9A9A]">Current display type</span>
                  </div>
                  <p className="text-[12px] leading-5 text-[#9A9A9A]">
                    Use Dropdown for normal filtering, Matrix columns for X axis, and Matrix rows for Y axis.
                  </p>

                  {selectedMappingAttributeId && selectedAttributeDetail ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", roleBadgeClass(selectedAttributeDetail.role as AttributeRole))}>
                            {getDisplayTypeLabel(newMappingGridAxis, selectedAttributeDetail.role as AttributeRole)}
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
            </div>
          </div>
        )}

        {activeTab === 8 && (
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country Availability</h3>
                <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#6B6B6B]">
                  Availability controls where this product is visible. New products start invisible everywhere until countries are enabled here.
                  This is separate from default country/currency fallback values, which are not edited on this screen.
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

        {activeTab === 9 && (
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

            <div className="mb-4 rounded-lg border border-[#E6E6E6] p-4">
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
            </div>

            <div className="space-y-4">
              {generateAttributeIds.map((attributeId) => {
                const attribute = variantGenerationCatalog.find((item) => item.id === attributeId);
                if (!attribute) return null;
                const mode = generateModeMap[attribute.id] ?? "specific";
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
                          { value: "skip", label: "Skip Attribute" },
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
                        {selectedValues.length === 0 && (
                          <p className="text-[12px] text-[#9A9A9A]">Add one or more values for this attribute.</p>
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
                <p className="mt-1 text-[13px] text-[#6B6B6B]">Update package, attribute values, SKU and variant status.</p>
              </div>
              <button onClick={() => setEditingVariant(null)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {packageRows.length > 0 && <AdminSelect label="Package" value={editVariantPackageId} onChange={(e) => setEditVariantPackageId(e.target.value)} options={[{ value: "", label: "No package" }, ...packageOptions.slice(1)]} />}
              <AdminSelect label="Status" value={editVariantStatus} onChange={(e) => setEditVariantStatus(e.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
              <AdminInput label="Variant Title" value={editVariantTitle} onChange={(e) => setEditVariantTitle(e.target.value)} placeholder="Optional custom title" />
              <AdminInput label="SKU" value={editVariantSku} onChange={(e) => setEditVariantSku(e.target.value)} placeholder="Variant SKU" />
              <AdminInput label="MOQ" type="number" min={1} value={editVariantMoq} onChange={(e) => setEditVariantMoq(Math.max(1, Number(e.target.value) || 1))} />
            </div>

            <div className="mt-5 rounded-lg border border-[#E6E6E6] p-4">
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
                const attribute = attributeCatalog.find((item) => item.id === attributeId);
                if (!attribute) return null;
                const values = getAttributeValues(attribute);
                const selectedValue = values.find((value) => value.id === editVariantSelections[attribute.id]);
                const availableValues = values.filter((value) => value.id !== editVariantSelections[attribute.id]);

                return (
                  <div key={attribute.id} className="rounded-lg border border-[#E6E6E6] p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-[#1A1A1A]">{attribute.name} <span className="ml-1 font-normal text-[#9A9A9A]">{attribute.id}</span></div>
                        <p className="mt-1 text-[12px] text-[#6B6B6B]">Choose one exact value for this attribute.</p>
                      </div>
                      <button onClick={() => removeEditVariantAttribute(attribute.id)} className="text-[13px] font-medium text-[#E31E24] hover:text-[#B5151B]">
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedValue ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-4 py-2 text-[12px] text-[#1A1A1A]">
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
                      <select
                        value=""
                        onChange={(e) => setEditVariantSelections((current) => ({ ...current, [attribute.id]: e.target.value }))}
                        className="rounded-full border border-dashed border-[#BDBDBD] bg-white px-4 py-2 text-[12px] text-[#6B6B6B] outline-none hover:border-[#9A9A9A]"
                      >
                        <option value="">+ Add value</option>
                        {(selectedValue ? availableValues : values).map((value) => (
                          <option key={value.id} value={value.id}>
                            {value.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setEditingVariant(null)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
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

      {ToastComponent}
    </>
  );

  return (
    <AdminLayout title={product.title} breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "Edit" }]}>
      {content}
    </AdminLayout>
  );
}
