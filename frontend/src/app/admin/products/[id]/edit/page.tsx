"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Upload, Trash2, RefreshCw, Plus, Zap, Copy, X, Pencil } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, StatusBadge, useToast, ConfirmModal, DataTable, Column } from "@/components/admin/AdminComponents";
import { useAdminProduct, useUpdateProduct, useAdminCategories, useAdminAttributes, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";

const TABS = ["Basic Info", "Media", "Packages", "Variants", "Pricing", "Inventory", "Translations", "SEO"];

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
  inventory?: { stock: number } | null;
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
  values: { id: string; value: string }[];
};

type SelectionMap = Record<string, string[]>;
type GenerateAttributeMode = "all" | "specific" | "skip";
type GenerateModeMap = Record<string, GenerateAttributeMode>;
type ManualAttributeMode = "single" | "specific" | "all";
type ManualModeMap = Record<string, ManualAttributeMode>;
type SingleSelectionMap = Record<string, string>;

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
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
  const { showToast, ToastComponent } = useToast();

  const { data: product, isLoading, refetch } = useAdminProduct(id);
  const { data: categories = [] } = useAdminCategories();
  const { data: attributes = [] } = useAdminAttributes();
  const { data: languages = [] } = useAdminLanguages();
  const updateProduct = useUpdateProduct(id);

  const attributeCatalog = useMemo(() => attributes as GlobalAttribute[], [attributes]);
  const packageRows = useMemo(() => (product?.packages ?? []) as PackageRow[], [product?.packages]);
  const variantRows = useMemo(() => (product?.variants ?? []) as VariantRow[], [product?.variants]);

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
      } catch {
        showToast("Save failed.", "error");
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

  const pricingCols: Column<{ id: string; country: { name: string; code: string }; currency: { symbol: string }; mrp: number; sellingPrice: number; status: string }>[] = [
    { key: "country", label: "Country", render: (r) => `${r.country.name} (${r.country.code})` },
    { key: "mrp", label: "MRP", render: (r) => `${r.currency.symbol}${r.mrp}` },
    { key: "sellingPrice", label: "Selling Price", render: (r) => `${r.currency.symbol}${r.sellingPrice}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const resetPackageForm = () => {
    setEditingPackage(null);
    setPackageTitle("");
    setPackageDescription("");
    setPackageImage("");
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
        await adminApi.put(`/products/${id}/packages/${editingPackage.id}`, payload);
        showToast("Package updated.");
      } else {
        await adminApi.post(`/products/${id}/packages`, payload);
        showToast("Package created.");
      }
      setPackageModalOpen(false);
      resetPackageForm();
      refetch();
    } catch {
      showToast("Failed to save package.", "error");
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    try {
      await adminApi.delete(`/products/${id}/packages/${packageId}`);
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
      await adminApi.post(`/products/${id}/media`, formData, { headers: { "Content-Type": "multipart/form-data" } });
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
      await adminApi.delete(`/products/${id}/media/${mediaId}`);
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
      Object.fromEntries(attributeCatalog.map((attribute) => [attribute.id, "skip"])) as GenerateModeMap
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

  const handleCloneVariant = async (variantId: string) => {
    try {
      await adminApi.post(`/products/${id}/variants/${variantId}/clone`);
      showToast("Variant cloned.");
      refetch();
    } catch {
      showToast("Failed to clone variant.", "error");
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await adminApi.delete(`/products/${id}/variants/${variantId}`);
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
          return { attributeId, attributeValueIds: attribute.values.map((value) => value.id) };
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
        await adminApi.post(`/products/${id}/variants`, {
          attributeValueIds: attributesPayload.flatMap((attribute) => attribute.attributeValueIds),
          packageId: manualVariantPackageId || null,
          sku: manualVariantSku.trim() || undefined,
          moq: manualVariantMoq,
        });
        showToast("Variant created.");
      } else {
        const result = await adminApi.post(`/products/${id}/generate-variants`, {
          packageIds: manualVariantPackageId ? [manualVariantPackageId] : [],
          attributes: attributesPayload,
        });
        showToast(result.data.message || "Variants created.");
      }
      setManualVariantOpen(false);
      refetch();
    } catch {
      showToast("Failed to create variant.", "error");
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
      await adminApi.put(`/products/${id}/variants/${editingVariant.id}`, {
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
    const selectedAttributes = attributeCatalog
      .filter((attribute) => generateAttributeIds.includes(attribute.id))
      .map((attribute) => {
        const mode = generateModeMap[attribute.id] ?? "skip";
        if (mode === "skip") return null;
        if (mode === "all") {
          return {
            attributeId: attribute.id,
            attributeValueIds: attribute.values.map((value) => value.id),
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

    const specificMissing = attributeCatalog
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
      const result = await adminApi.post(`/products/${id}/generate-variants`, {
        packageIds: generatePackageIds,
        attributes: selectedAttributes,
      });
      showToast(result.data.message || "Variants generated.");
      setGenerateVariantOpen(false);
      refetch();
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to generate variants.", "error");
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
        [attributeId]: attribute?.values.map((value) => value.id) ?? [],
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
      [attributeId]: attribute.values.map((value) => value.id),
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

  if (isLoading) {
    return (
      <AdminLayout title="Edit Product">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#E6E6E6]" />)}
        </div>
      </AdminLayout>
    );
  }

  if (!product) {
    return <AdminLayout title="Product not found"><p className="text-[#9A9A9A]">Product not found.</p></AdminLayout>;
  }

  return (
    <AdminLayout title={product.title} breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "Edit" }]}>
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
        {activeTab === 0 || activeTab === 7 ? (
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
              <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Global Attribute Catalog</h4>
              <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Attributes are not assigned to the product. They are selected directly when creating or generating a variant.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {attributeCatalog.map((attribute) => (
                  <div key={attribute.id} className="rounded-lg border border-[#E6E6E6] bg-white p-3.5">
                    <div className="text-[13px] font-medium text-[#1A1A1A]">{attribute.name}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {attribute.values.slice(0, 5).map((value) => (
                        <span key={value.id} className="rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[11px] text-[#6B6B6B]">{value.value}</span>
                      ))}
                      {attribute.values.length > 5 && <span className="text-[11px] text-[#9A9A9A]">+{attribute.values.length - 5}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DataTable columns={variantCols} data={variantRows} rowKey="id" emptyMessage="No variants created yet." />
          </div>
        )}

        {activeTab === 4 && (
          <div className="p-6">
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
                    await adminApi.post("/pricing/generate-country-prices", { productId: id, basePrice: parseFloat(base), baseCurrencyId: "usd" });
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
          </div>
        )}

        {activeTab === 5 && (
          <div className="p-6">
            <h3 className="mb-4 text-[14px] font-semibold text-[#1A1A1A]">Inventory</h3>
            <div className="space-y-3">
              {(variantRows.length ? variantRows : [{ id: "main", title: "Main Stock", inventory: null }]).map((v: { id: string; title: string; inventory: { id: string; stock: number; lowStockThreshold: number; status: string } | null }) => (
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
                    {v.inventory && <StatusBadge status={v.inventory.status} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 6 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Translations</h3>
              <button
                onClick={async () => {
                  try {
                    await adminApi.post("/translations/generate", { productId: id });
                    showToast("AI generation started.");
                    refetch();
                  } catch {
                    showToast("Failed.", "error");
                  }
                }}
                className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
              >
                <Zap size={14} /> AI Generate All
              </button>
            </div>
            <div className="space-y-4">
              {languages.map((lang: { id: string; name: string; code: string }) => {
                const t = product.translations?.find((tr: { languageId: string }) => tr.languageId === lang.id);
                return (
                  <details key={lang.id} className="overflow-hidden rounded-lg border border-[#E6E6E6]">
                    <summary className="flex cursor-pointer items-center justify-between bg-[#F8F8F8] px-4 py-3 hover:bg-[#F2F2F2]">
                      <span className="text-[13.5px] font-medium text-[#1A1A1A]">{lang.name} ({lang.code.toUpperCase()})</span>
                      {t?.isAiGenerated && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">AI Generated</span>}
                    </summary>
                    <div className="space-y-3 p-4">
                      <AdminInput
                        label="Title"
                        defaultValue={t?.title || ""}
                        placeholder={product.title}
                        onBlur={async (e) => {
                          if (!t?.id) return;
                          await adminApi.put(`/translations/${t.id}`, { title: e.target.value });
                          showToast("Saved.");
                        }}
                      />
                      <AdminTextarea
                        label="Short Description"
                        rows={2}
                        defaultValue={t?.shortDescription || ""}
                        onBlur={async (e) => {
                          if (!t?.id) return;
                          await adminApi.put(`/translations/${t.id}`, { shortDescription: e.target.value });
                        }}
                      />
                      <AdminTextarea
                        label="Description"
                        rows={5}
                        defaultValue={t?.description || ""}
                        onBlur={async (e) => {
                          if (!t?.id) return;
                          await adminApi.put(`/translations/${t.id}`, { description: e.target.value });
                        }}
                      />
                    </div>
                  </details>
                );
              })}
              {languages.length === 0 && (
                <p className="text-[13.5px] text-[#9A9A9A]">No languages configured. Add languages in the Translations module.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 7 && (
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
          <div className="w-full max-w-[720px] rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1A1A1A]">{editingPackage ? "Edit Package" : "Create Package"}</h3>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">Packages are commercial offerings and are not attribute values.</p>
              </div>
              <button onClick={() => setPackageModalOpen(false)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminInput label="Title" value={packageTitle} onChange={(e) => setPackageTitle(e.target.value)} />
              <AdminSelect
                label="Status"
                value={packageStatus}
                onChange={(e) => setPackageStatus(e.target.value)}
                options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
              />
              <AdminInput label="Image URL" value={packageImage} onChange={(e) => setPackageImage(e.target.value)} placeholder="Optional image URL" />
              <AdminInput label="Sort Order" type="number" value={packageSortOrder} onChange={(e) => setPackageSortOrder(Number(e.target.value) || 0)} />
              <div className="sm:col-span-2">
                <AdminTextarea label="Description" rows={4} value={packageDescription} onChange={(e) => setPackageDescription(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setPackageModalOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
              <button onClick={handleSavePackage} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">{editingPackage ? "Save Package" : "Create Package"}</button>
            </div>
          </div>
        </div>
      )}

      {generateVariantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-[920px] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1A1A1A]">Generate Variants</h3>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">Select packages and attribute values. The system will generate every combination.</p>
              </div>
              <button onClick={() => setGenerateVariantOpen(false)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

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
                      ...attributeCatalog
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
                const attribute = attributeCatalog.find((item) => item.id === attributeId);
                if (!attribute) return null;
                const mode = generateModeMap[attribute.id] ?? "specific";
                const selectedValueIds = generateSelectionMap[attribute.id] ?? [];
                const selectedValues = attribute.values.filter((value) => selectedValueIds.includes(value.id));
                const availableValues = attribute.values.filter((value) => !selectedValueIds.includes(value.id));

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
                        All {attribute.values.length} values of {attribute.name} will be used.
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

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setGenerateVariantOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancel</button>
              <button onClick={handleGenerateVariants} disabled={generatingVariants} className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#333] disabled:opacity-40">{generatingVariants ? "Generating…" : "Generate Variants"}</button>
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
                const selectedValues = attribute.values.filter((value) => selectedValueIds.includes(value.id));

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
                        All {attribute.values.length} values of {attribute.name} will be used.
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
                          {attribute.values.map((value) => {
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
                const selectedValue = attribute.values.find((value) => value.id === editVariantSelections[attribute.id]);
                const availableValues = attribute.values.filter((value) => value.id !== editVariantSelections[attribute.id]);

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
                        {(selectedValue ? availableValues : attribute.values).map((value) => (
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
    </AdminLayout>
  );
}
