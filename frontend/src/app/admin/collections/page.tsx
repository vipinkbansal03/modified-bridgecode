"use client";

import { useEffect, useMemo, useState } from "react";
import * as Yup from "yup";
import {
  Archive,
  CheckCircle2,
  Copy,
  Globe,
  Image as ImageIcon,
  Layers,
  Package,
  Pencil,
  Percent,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  Upload,
  XCircle,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  AdminTextarea,
  ConfirmModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
  AdminDeleteModal,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminRowActions, AdminActionButton } from "@/components/admin/AdminRowActions";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCollectionCountries,
  useAdminCollectionDiscounts,
  useAdminCollections,
  useAdminCountries,
  useAdminProducts,
  useAdminTiers,
  useArchiveCollection,
  useCreateCollection,
  useCreateCollectionDiscount,
  useDeleteCollection,
  useDeleteCollectionDiscount,
  useDuplicateCollection,
  useRestoreCollection,
  useUpdateCollection,
  useUpdateCollectionCountries,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { formatDate } from "@/utils/formatDate";
import { slugify } from "@/utils/slugify";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";

type Product = { id: string; title: string };
type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  updatedAt?: string;
  createdAt?: string;
  products: { productId: string; product: Product }[];
  _count?: { products: number };
};
type CountryToggle = { id: string; name: string; code: string; enabled: boolean };
type DiscountRow = {
  id: string;
  name: string;
  type: "TIER" | "MOQ";
  status: string;
  discountPercent?: string | number | null;
  fixedAmount?: string | number | null;
  minQuantity?: number | null;
  tier?: { name: string } | null;
  country?: { code: string } | null;
};

type ColumnKey = "collection" | "products" | "sortOrder" | "status" | "updatedAt";

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  collection: true,
  products: true,
  sortOrder: true,
  status: true,
  updatedAt: true,
};

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "collection", label: "Collection & Slug" },
  { key: "products", label: "Products" },
  { key: "sortOrder", label: "Sort Order" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Updated Date" },
];

const validationSchema = Yup.object({
  name: Yup.string().trim().required("Collection name is required"),
  slug: Yup.string().trim().required("Slug is required"),
  description: Yup.string().nullable(),
  image: Yup.string().nullable(),
  status: Yup.string().oneOf(["ACTIVE", "INACTIVE"]).required("Status is required"),
  sortOrder: Yup.number().typeError("Sort order must be a number").default(0),
});

const emptyForm = {
  id: "",
  name: "",
  slug: "",
  description: "",
  image: "",
  status: "ACTIVE",
  sortOrder: 0,
  productIds: [] as string[],
};

const emptyDiscountForm = {
  name: "",
  type: "TIER",
  status: "ACTIVE",
  tierId: "",
  minQuantity: "",
  discountPercent: "",
  fixedAmount: "",
  countryId: "",
  countryIds: [] as string[],
  startDate: "",
  endDate: "",
};

type CollectionSortBy = "sortOrder" | "name" | "slug" | "status" | "updatedAt" | "createdAt";
const EMPTY_COUNTRIES: CountryToggle[] = [];

export default function CollectionsPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("collections.create");
  const canUpdate = hasPermission("collections.update");
  const canDelete = hasPermission("collections.delete");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<CollectionSortBy>("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);

  const [showForm, setShowForm] = useState(false);
  const [editorTab, setEditorTab] = useState<"details" | "countries" | "discounts">("details");
  const [isUploading, setIsUploading] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [slugEdited, setSlugEdited] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [countrySearch, setCountrySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const { showToast, ToastComponent } = useToast();

  // Queries
  const { data, isLoading, refetch, isFetching } = useAdminCollections({
    page,
    limit,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortDir,
  });

  const { data: collectionsAllData, isLoading: collectionsAllLoading } = useAdminCollections({
    limit: 1000,
  });
  const collectionsAll: Collection[] = (collectionsAllData?.data ?? []) as Collection[];

  const collectionStats = useMemo(() => {
    const total = collectionsAll.length;
    const active = collectionsAll.filter((c) => c.status === "ACTIVE").length;
    const inactive = collectionsAll.filter((c) => c.status === "INACTIVE").length;
    const totalProducts = collectionsAll.reduce(
      (acc, c) => acc + (c._count?.products ?? c.products?.length ?? 0),
      0,
    );
    return { total, active, inactive, totalProducts };
  }, [collectionsAll]);

  const { data: productsData } = useAdminProducts({ limit: 500 });
  const { data: countries, isLoading: countriesLoading } = useAdminCollectionCountries(selectedCollectionId);
  const { data: allCountries = [] } = useAdminCountries();
  const { data: tiers = [] } = useAdminTiers();
  const { data: collectionDiscounts = [], refetch: refetchDiscounts } = useAdminCollectionDiscounts(selectedCollectionId);

  // Mutations
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const archiveCollection = useArchiveCollection();
  const restoreCollection = useRestoreCollection();
  const duplicateCollection = useDuplicateCollection();
  const updateCountries = useUpdateCollectionCountries(selectedCollectionId);
  const createCollectionDiscount = useCreateCollectionDiscount(selectedCollectionId);
  const deleteCollectionDiscount = useDeleteCollectionDiscount(selectedCollectionId);

  const collections: Collection[] = data?.data ?? [];
  const products: Product[] = productsData?.data ?? [];
  const selectedCountries = (countries ?? EMPTY_COUNTRIES) as CountryToggle[];

  const deletingCollection = useMemo(
    () => (deleting ? collections.find((c) => c.id === deleting) : null),
    [deleting, collections],
  );

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return selectedCountries;
    return selectedCountries.filter((country) =>
      `${country.name} ${country.code}`.toLowerCase().includes(query),
    );
  }, [countrySearch, selectedCountries]);

  const enabledCountryCount = useMemo(
    () => selectedCountries.filter((c) => countryOverrides[c.id] ?? c.enabled).length,
    [selectedCountries, countryOverrides],
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => p.title.toLowerCase().includes(query));
  }, [products, productSearch]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    if (!selectedCollectionId) {
      setCountryOverrides({});
      return;
    }
    const nextOverrides = Object.fromEntries(
      selectedCountries.map((country) => [country.id, country.enabled]),
    );
    setCountryOverrides(nextOverrides);
  }, [selectedCollectionId, selectedCountries]);

  const form = useAdminForm({
    initialValues: emptyForm,
    validationSchema,
    onSubmit: async (values, { resetForm }) => {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || null,
        image: values.image.trim() || null,
        status: values.status as "ACTIVE" | "INACTIVE",
        sortOrder: Number(values.sortOrder || 0),
        productIds: values.productIds,
      };
      try {
        if (values.id) {
          await updateCollection.mutateAsync({ id: values.id, ...payload });
          showToast("Collection updated successfully.");
        } else {
          const result = await createCollection.mutateAsync(payload);
          setSelectedCollectionId(result.data.id);
          showToast("Collection created. You can now configure regional availability and discounts.");
        }
        resetForm();
        setSelectedCollectionId("");
        setShowForm(false);
        setSlugEdited(false);
        refetch();
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save collection."), "error");
      }
    },
  });

  const handleNameChange = (value: string) => {
    form.setFieldValue("name", value);
    if (!slugEdited) {
      form.setFieldValue("slug", slugify(value));
    }
  };

  const edit = (collection: Collection) => {
    form.reset({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description ?? "",
      image: collection.image ?? "",
      status: collection.status,
      sortOrder: collection.sortOrder ?? 0,
      productIds: collection.products?.map((item) => item.productId) ?? [],
    });
    setSelectedCollectionId(collection.id);
    setEditorTab("details");
    setSlugEdited(false);
    setShowForm(true);
  };

  const openCreateModal = () => {
    form.reset(emptyForm);
    setSelectedCollectionId("");
    setEditorTab("details");
    setSlugEdited(false);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    if (form.dirty) {
      setShowDiscardConfirm(true);
    } else {
      reset();
    }
  };

  const reset = () => {
    form.reset(emptyForm);
    setSelectedCollectionId("");
    setEditorTab("details");
    setSlugEdited(false);
    setShowForm(false);
  };

  const toggleProduct = (productId: string) => {
    const currentIds = form.values.productIds;
    form.setFieldValue(
      "productIds",
      currentIds.includes(productId)
        ? currentIds.filter((id) => id !== productId)
        : [...currentIds, productId],
    );
  };

  const handleImageUpload = async (file?: File) => {
    if (!file) return;
    try {
      setIsUploading(true);
      const results = await uploadMediaFiles([file], {
        entityType: "COLLECTION",
        entityId: selectedCollectionId || undefined,
      });
      const url = results[0]?.url;
      if (url) {
        form.setFieldValue("image", url);
        showToast("Image uploaded successfully.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to upload image."), "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveCountries = async () => {
    try {
      await updateCountries.mutateAsync(
        selectedCountries.map((country) => ({
          countryId: country.id,
          enabled: countryOverrides[country.id] ?? country.enabled,
        })),
      );
      showToast("Country visibility updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save country visibility."), "error");
    }
  };

  const createDiscount = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetCountries =
      discountForm.countryIds?.length > 0
        ? discountForm.countryIds
        : discountForm.countryId
          ? [discountForm.countryId]
          : [];
    const basePayload = {
      name: discountForm.name.trim(),
      type: discountForm.type,
      status: discountForm.status,
      tierId: discountForm.type === "TIER" ? discountForm.tierId || null : null,
      minQuantity: discountForm.type === "MOQ" ? Number(discountForm.minQuantity) || 1 : null,
      discountPercent: discountForm.discountPercent ? Number(discountForm.discountPercent) : null,
      fixedAmount: discountForm.fixedAmount ? Number(discountForm.fixedAmount) : null,
      startDate: discountForm.startDate || null,
      endDate: discountForm.endDate || null,
    };

    if (!basePayload.name) {
      showToast("Discount rule name is required.", "error");
      return;
    }

    try {
      if (targetCountries.length > 1) {
        for (const cId of targetCountries) {
          await createCollectionDiscount.mutateAsync({ ...basePayload, countryId: cId });
        }
      } else {
        await createCollectionDiscount.mutateAsync({
          ...basePayload,
          countryId: targetCountries[0] || null,
        });
      }
      setDiscountForm(emptyDiscountForm);
      showToast("Collection discount rule added.");
      refetchDiscounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create collection discount."), "error");
    }
  };

  const removeDiscount = async (discountId: string) => {
    try {
      await deleteCollectionDiscount.mutateAsync(discountId);
      showToast("Collection discount removed.");
      refetchDiscounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to remove collection discount."), "error");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCollection.mutateAsync(deleting);
      showToast("Collection deleted successfully.");
      if (selectedCollectionId === deleting) {
        setSelectedCollectionId("");
        setCountryOverrides({});
      }
      setDeleting(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete collection."), "error");
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteCollection.mutateAsync(id)));
      showToast(`Successfully deleted ${selectedIds.length} collection(s).`);
      setSelectedIds([]);
      setBulkAction("");
      setShowBulkDeleteModal(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk delete."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleDuplicate = async (collectionId: string) => {
    try {
      const result = await duplicateCollection.mutateAsync(collectionId);
      showToast("Collection duplicated successfully.");
      refetch();
      if (result?.id) {
        edit(result);
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate collection."), "error");
    }
  };

  const handleArchiveToggle = async (collection: Collection) => {
    if (!canUpdate) {
      showToast("You do not have permission to update collections.", "error");
      return;
    }
    try {
      if (collection.status === "ACTIVE") {
        await archiveCollection.mutateAsync(collection.id);
        showToast("Collection marked inactive.");
      } else {
        await restoreCollection.mutateAsync(collection.id);
        showToast("Collection marked active.");
      }
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update collection status."), "error");
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0 || !action) return;

    if (action === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }

    setBulkSaving(true);
    setBulkAction(action);
    try {
      if (action === "activate") {
        await Promise.all(selectedIds.map((id) => updateCollection.mutateAsync({ id, status: "ACTIVE" })));
        showToast(`Successfully activated ${selectedIds.length} collection(s).`);
      } else if (action === "deactivate") {
        await Promise.all(selectedIds.map((id) => updateCollection.mutateAsync({ id, status: "INACTIVE" })));
        showToast(`Successfully deactivated ${selectedIds.length} collection(s).`);
      }
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
      setBulkAction("");
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/collections", {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data?.data ?? []).map((c: any) => c.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} collections across all pages.`, "success");
    } catch {
      setSelectedIds(collections.map((c) => c.id));
    }
  };

  // Table Columns Definition
  const columns: Column<Collection>[] = useMemo(
    () => [
      {
        key: "collection",
        label: "Collection & Slug",
        render: (row) => (
          <div className="flex items-center gap-3 py-1 min-w-0">
            <div className="flex h-10 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
              {row.image ? (
                <img src={row.image} alt={row.name} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={18} className="text-[#9A9A9A]" />
              )}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="truncate text-[13.5px] font-semibold text-[#1A1A1A] leading-snug">
                {row.name}
              </div>
              <div className="flex items-center gap-2 text-[11.5px] text-[#888] leading-snug">
                <code className="font-mono text-[#6B6B6B]">/{row.slug}</code>
                {row.description && (
                  <span className="truncate max-w-[200px] text-gray-400">• {row.description}</span>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "products",
        label: "Products",
        width: "140px",
        render: (row) => {
          const count = row._count?.products ?? row.products?.length ?? 0;
          return (
            <span className="text-[12.5px] font-medium text-[#555]">
              {count} {count === 1 ? "product" : "products"}
            </span>
          );
        },
      },
      {
        key: "sortOrder",
        label: "Sort Order",
        width: "110px",
        render: (row) => (
          <span className="text-[12.5px] font-mono text-[#555]">#{row.sortOrder ?? 0}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "120px",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "updatedAt",
        label: "Updated Date",
        width: "130px",
        render: (row) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDate(row.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "150px",
        render: (row) => (
          <AdminRowActions
            extra={
              <>
                {canCreate && (
                  <AdminActionButton
                    action={{
                      title: "Duplicate collection",
                      onClick: () => handleDuplicate(row.id),
                      icon: <Copy size={13} />,
                    }}
                    defaultIcon={<Copy size={13} />}
                    defaultTitle="Duplicate"
                  />
                )}
                {canUpdate && (
                  <AdminActionButton
                    action={{
                      title: row.status === "ACTIVE" ? "Mark Inactive" : "Mark Active",
                      onClick: () => handleArchiveToggle(row),
                      icon: row.status === "ACTIVE" ? <Archive size={13} /> : <RotateCcw size={13} />,
                    }}
                    defaultIcon={<Archive size={13} />}
                    defaultTitle="Archive"
                  />
                )}
              </>
            }
            edit={
              canUpdate
                ? {
                    title: "Edit collection",
                    onClick: () => edit(row),
                  }
                : undefined
            }
            delete={
              canDelete
                ? {
                    title: "Delete collection",
                    onClick: () => setDeleting(row.id),
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canCreate, canUpdate, canDelete],
  );

  const filteredColumns = useMemo(
    () => columns.filter((col) => col.key === "actions" || visibleColumns[col.key as ColumnKey] !== false),
    [visibleColumns, columns],
  );

  return (
    <AdminLayout
      title="Collections"
      breadcrumb={[
        { label: "Admin", href: "/admin" },
        { label: "Catalog" },
        { label: "Collections" },
      ]}
    >
      <div className="space-y-5">
        {/* 1. TOP KPI STATS GRID */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Collections",
              value: collectionStats.total,
              subtitle: "Curated product groupings",
              icon: <Layers size={18} />,
            },
            {
              title: "Active Collections",
              value: collectionStats.active,
              subtitle: "Visible on storefront",
              icon: <CheckCircle2 size={18} />,
              color: "bg-green-600",
            },
            {
              title: "Inactive Collections",
              value: collectionStats.inactive,
              subtitle: "Hidden collections",
              icon: <XCircle size={18} />,
              color: "bg-gray-600",
            },
            {
              title: "Assigned Products",
              value: collectionStats.totalProducts,
              subtitle: "Total product assignments",
              icon: <Package size={18} />,
              color: "bg-blue-600",
            },
          ]}
          isLoading={collectionsAllLoading || isLoading}
        />

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search collections...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount:
              (statusFilter ? 1 : 0) +
              (sortBy !== "sortOrder" || sortDir !== "asc" ? 1 : 0),
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key: string) =>
              setVisibleColumns((current) => ({
                ...current,
                [key as ColumnKey]: current[key as ColumnKey] === false ? true : false,
              })),
            options: COLUMN_OPTIONS,
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Collections refreshed."));
            },
            isRefreshing: isFetching || isLoading,
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: openCreateModal,
                  label: "Add Collection",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setSortBy("sortOrder");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as CollectionSortBy);
                  setPage(1);
                }}
                options={[
                  { value: "sortOrder", label: "Sort Order" },
                  { value: "name", label: "Collection Name" },
                  { value: "slug", label: "Slug" },
                  { value: "status", label: "Status" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "createdAt", label: "Created Date" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(event) => {
                  setSortDir(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
                options={[
                  { value: "asc", label: "Ascending (A-Z / Low to High)" },
                  { value: "desc", label: "Descending (Z-A / High to Low)" },
                ]}
              />
            </div>
          }
        />

        {/* 3. FULL-WIDTH DATA TABLE */}
        <DataTable<Collection>
          title="Collections List"
          columns={filteredColumns}
          data={collections}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage={
            search || statusFilter
              ? "No collections matched your search or filters."
              : "No collections found. Create your first collection."
          }
          enableSelection={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onToggleStatus={canUpdate ? handleArchiveToggle : undefined}
          statusLoadingId={
            archiveCollection.isPending
              ? ((archiveCollection.variables as any)?.id ?? (archiveCollection.variables as any) ?? null)
              : restoreCollection.isPending
                ? ((restoreCollection.variables as any)?.id ?? (restoreCollection.variables as any) ?? null)
                : null
          }
          isStatusDisabled={() => !canUpdate}
          totalItems={data?.total ?? collections.length}
          currentPage={page}
          pageSize={limit}
          totalPages={Math.ceil((data?.total ?? collections.length) / limit) || 1}
          onPageChange={setPage}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          onSelectAll={handleSelectAll}
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
              actionType={bulkAction}
              onActionTypeChange={setBulkAction}
              actions={[
                { value: "activate", label: "Enable" },
                { value: "deactivate", label: "Disable" },
                { value: "delete", label: "Delete" },
              ]}
              onApply={() => handleBulkAction(bulkAction)}
              applyLoading={bulkSaving}
              applyDisabled={!bulkAction || selectedIds.length === 0}
            />
          )}
        />

        {/* 4. BOTTOM PAGINATION */}
        <div className="flex items-center justify-end mt-4">
          <Pagination
            page={page}
            totalPages={Math.ceil((data?.total ?? collections.length) / limit) || 1}
            onPageChange={setPage}
            alwaysShow={true}
          />
        </div>
      </div>

      {/* COLLECTION CREATE / EDIT MODAL */}
      <Modal
        open={showForm}
        onClose={handleCloseForm}
        title={form.values.id ? `Edit Collection: ${form.values.name}` : "Create Collection"}
        subtitle="Organize products into curated collections with regional availability and custom discounts."
        size="4xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={handleCloseForm}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="collection-form"
              loading={form.isSubmitting || createCollection.isPending || updateCollection.isPending}
              loadingText={form.values.id ? "Saving..." : "Creating..."}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              {form.values.id ? "Update Collection" : "Create Collection"}
            </LoadingButton>
          </div>
        }
      >
        {showForm ? (
          <div className="p-6 space-y-6">
            {/* Modal Tabs when Editing */}
            {form.values.id && (
              <div className="flex items-center gap-2 border-b border-[#E6E6E6] pb-3">
                <button
                  type="button"
                  onClick={() => setEditorTab("details")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                    editorTab === "details"
                      ? "bg-[#1A1A1A] text-white"
                      : "text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                  }`}
                >
                  <Layers size={14} /> General & Products
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("countries")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                    editorTab === "countries"
                      ? "bg-[#1A1A1A] text-white"
                      : "text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                  }`}
                >
                  <Globe size={14} /> Country Visibility ({enabledCountryCount})
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("discounts")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                    editorTab === "discounts"
                      ? "bg-[#1A1A1A] text-white"
                      : "text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
                  }`}
                >
                  <Percent size={14} /> Discount Rules ({(collectionDiscounts as DiscountRow[]).length})
                </button>
              </div>
            )}

            {/* TAB 1: General Details & Products */}
            {(!form.values.id || editorTab === "details") && (
              <form id="collection-form" onSubmit={form.handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminInput
                    label="Collection Name"
                    placeholder="e.g. Featured Brackets"
                    value={form.values.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={form.handleBlur}
                    name="name"
                    required
                    error={form.errors.name as string}
                  />
                  <AdminInput
                    label="Slug"
                    placeholder="featured-brackets"
                    value={form.values.slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      form.setFieldValue("slug", slugify(e.target.value));
                    }}
                    onBlur={form.handleBlur}
                    name="slug"
                    required
                    error={form.errors.slug as string}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminSelect
                    label="Status"
                    options={[
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" },
                    ]}
                    {...form.getFieldProps("status")}
                    error={form.errors.status as string}
                  />
                  <AdminInput
                    label="Sort Order"
                    type="number"
                    {...form.getFieldProps("sortOrder")}
                    error={form.errors.sortOrder as string}
                  />
                </div>

                <AdminTextarea
                  label="Description"
                  rows={3}
                  placeholder="Short description of this collection..."
                  {...form.getFieldProps("description")}
                  error={form.errors.description as string}
                />

                <div className="grid gap-4 md:grid-cols-[120px_1fr]">
                  <div className="flex h-[92px] w-[120px] items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
                    {form.values.image ? (
                      <img src={form.values.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={22} className="text-[#9A9A9A]" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <AdminInput
                      label="Image URL"
                      placeholder="/uploads/collection.jpg"
                      {...form.getFieldProps("image")}
                      error={form.errors.image as string}
                    />
                    <button
                      type="button"
                      onClick={() => setMediaModalOpen(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                    >
                      <ImageIcon size={14} /> Browse Media Library
                    </button>
                  </div>
                </div>

                {/* Assigned Products Section */}
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">
                        Assigned Products ({form.values.productIds.length})
                      </h4>
                      <p className="text-[12px] text-[#6B6B6B]">
                        Select products to include in this collection.
                      </p>
                    </div>
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                      <input
                        type="text"
                        placeholder="Filter products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="h-8 w-48 rounded-md border border-[#E6E6E6] bg-white pl-8 pr-2.5 text-[12.5px] outline-none focus:border-[#E31E24]"
                      />
                    </div>
                  </div>

                  <div className="max-h-[240px] overflow-y-auto rounded-md border border-[#E6E6E6] bg-white p-3 divide-y divide-[#F0F0F0]">
                    {filteredProducts.length === 0 ? (
                      <p className="py-6 text-center text-[13px] text-[#9A9A9A]">
                        No products match your filter.
                      </p>
                    ) : (
                      filteredProducts.map((product) => {
                        const isChecked = form.values.productIds.includes(product.id);
                        return (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 py-2 text-[13px] cursor-pointer hover:bg-neutral-50 px-2 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleProduct(product.id)}
                              className="h-4 w-4 rounded border-[#D1D1D1] accent-[#E31E24]"
                            />
                            <span className="font-medium text-[#1A1A1A]">{product.title}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: Country Visibility */}
            {form.values.id && editorTab === "countries" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Regional Availability</h4>
                    <p className="text-[12px] text-[#6B6B6B]">
                      Control in which countries this collection is visible to customers.
                    </p>
                  </div>
                  <LoadingButton
                    onClick={handleSaveCountries}
                    loading={updateCountries.isPending}
                    loadingText="Saving..."
                    className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800"
                  >
                    Save Visibility
                  </LoadingButton>
                </div>

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                    <input
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder={`Search ${selectedCountries.length} countries by name or code...`}
                      className="h-9 w-[280px] rounded-md border border-[#E6E6E6] bg-white pl-8 pr-3 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6B6B6B]">
                    <span>
                      Showing {filteredCountries.length} of {selectedCountries.length}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-[#E6E6E6] px-2.5 py-1 font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] cursor-pointer"
                      onClick={() =>
                        setCountryOverrides((current) => {
                          const next = { ...current };
                          filteredCountries.forEach((country) => {
                            next[country.id] = true;
                          });
                          return next;
                        })
                      }
                    >
                      Enable visible
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#E6E6E6] px-2.5 py-1 font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] cursor-pointer"
                      onClick={() =>
                        setCountryOverrides((current) => {
                          const next = { ...current };
                          filteredCountries.forEach((country) => {
                            next[country.id] = false;
                          });
                          return next;
                        })
                      }
                    >
                      Disable visible
                    </button>
                  </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto rounded-md border border-[#E6E6E6] p-2">
                  {countriesLoading ? (
                    <div className="py-8 text-center text-[13px] text-[#9A9A9A]">Loading countries...</div>
                  ) : filteredCountries.length === 0 ? (
                    <p className="py-8 text-center text-[13px] text-[#9A9A9A]">No countries match your search.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredCountries.map((country) => (
                        <label
                          key={country.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2 cursor-pointer hover:bg-neutral-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">
                              {country.name}
                            </span>
                            <span className="text-[11.5px] text-[#9A9A9A]">{country.code}</span>
                          </span>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#E31E24]"
                            checked={countryOverrides[country.id] ?? country.enabled}
                            onChange={(e) =>
                              setCountryOverrides((current) => ({
                                ...current,
                                [country.id]: e.target.checked,
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Discount Rules */}
            {form.values.id && editorTab === "discounts" && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Collection Discount Rules</h4>
                  <p className="text-[12px] text-[#6B6B6B]">
                    Define tier-based or volume (MOQ) discounts applicable to this collection.
                  </p>
                </div>

                <form onSubmit={createDiscount} className="grid gap-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 md:grid-cols-4">
                  <AdminInput
                    label="Rule Name"
                    placeholder="e.g. VIP Tier 10% Off"
                    value={discountForm.name}
                    onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                    required
                  />
                  <AdminSelect
                    label="Discount Type"
                    value={discountForm.type}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        type: e.target.value as "TIER" | "MOQ",
                        tierId: "",
                        minQuantity: "",
                      })
                    }
                    options={[
                      { value: "TIER", label: "Customer Tier" },
                      { value: "MOQ", label: "Volume (MOQ)" },
                    ]}
                  />
                  {discountForm.type === "TIER" ? (
                    <AdminSelect
                      label="Target Tier"
                      value={discountForm.tierId}
                      onChange={(e) => setDiscountForm({ ...discountForm, tierId: e.target.value })}
                      options={[
                        { value: "", label: "All Tiers" },
                        ...tiers.map((tier: { id: string; name: string }) => ({
                          value: tier.id,
                          label: tier.name,
                        })),
                      ]}
                    />
                  ) : (
                    <AdminInput
                      label="Minimum Qty"
                      type="number"
                      value={discountForm.minQuantity}
                      onChange={(e) => setDiscountForm({ ...discountForm, minQuantity: e.target.value })}
                    />
                  )}
                  <AdminMultiSearchableSelect
                    label="Countries"
                    values={
                      discountForm.countryIds?.length
                        ? discountForm.countryIds
                        : discountForm.countryId
                          ? [discountForm.countryId]
                          : []
                    }
                    onValuesChange={(values) =>
                      setDiscountForm({
                        ...discountForm,
                        countryIds: values,
                        countryId: values[0] ?? "",
                      })
                    }
                    options={(allCountries as any[]).map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.code})`,
                    }))}
                    placeholder="All countries"
                    allowSelectAll
                    selectAllLabel="All countries"
                  />
                  <AdminInput
                    label="Discount %"
                    type="number"
                    placeholder="e.g. 15"
                    value={discountForm.discountPercent}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        discountPercent: e.target.value,
                        fixedAmount: "",
                      })
                    }
                  />
                  <AdminInput
                    label="Fixed Amount ($)"
                    type="number"
                    placeholder="e.g. 50"
                    value={discountForm.fixedAmount}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        fixedAmount: e.target.value,
                        discountPercent: "",
                      })
                    }
                  />
                  <AdminInput
                    label="Start Date"
                    type="date"
                    value={discountForm.startDate}
                    onChange={(e) => setDiscountForm({ ...discountForm, startDate: e.target.value })}
                  />
                  <AdminInput
                    label="End Date"
                    type="date"
                    value={discountForm.endDate}
                    onChange={(e) => setDiscountForm({ ...discountForm, endDate: e.target.value })}
                  />
                  <div className="md:col-span-4 flex justify-end">
                    <LoadingButton
                      type="submit"
                      loading={createCollectionDiscount.isPending}
                      loadingText="Adding..."
                      className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] cursor-pointer"
                    >
                      Add Discount Rule
                    </LoadingButton>
                  </div>
                </form>

                <div className="divide-y divide-[#EFEFEF] rounded-lg border border-[#E6E6E6] bg-white">
                  {(collectionDiscounts as DiscountRow[]).length === 0 ? (
                    <div className="p-4 text-center text-[13px] text-[#9A9A9A]">
                      No discounts assigned to this collection yet.
                    </div>
                  ) : (
                    (collectionDiscounts as DiscountRow[]).map((discount) => (
                      <div
                        key={discount.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-[13px]"
                      >
                        <div>
                          <div className="font-semibold text-[#1A1A1A]">{discount.name}</div>
                          <div className="text-[12px] text-[#6B6B6B] mt-0.5">
                            {discount.type === "TIER"
                              ? `Tier: ${discount.tier?.name || "All Tiers"}`
                              : `Min Qty: ${discount.minQuantity || 1}`}{" "}
                            •{" "}
                            {discount.discountPercent
                              ? `${discount.discountPercent}% off`
                              : `$${discount.fixedAmount} off`}{" "}
                            • Country: {discount.country?.code || "Global"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={discount.status} />
                          <button
                            type="button"
                            onClick={() => removeDiscount(discount.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] text-red-500 hover:bg-red-50 cursor-pointer"
                            title="Remove discount"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* DISCARD CONFIRMATION MODAL */}
      <ConfirmModal
        open={showDiscardConfirm}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this collection form. Are you sure you want to discard them?"
        danger={true}
        confirmText="Discard Changes"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          reset();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* SINGLE DELETE MODAL */}
      <AdminDeleteModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        itemName={deletingCollection?.name}
        itemType="Collection"
        onSoftDelete={handleDelete}
        onPermanentDelete={handleDelete}
        isSoftDeleting={deleteCollection.isPending}
        isPermanentDeleting={deleteCollection.isPending}
        softDeleteDescription="Hides this collection from the active storefront and admin catalog while safely retaining historical linkages."
        permanentDeleteDescription="Physically removes this collection, its product associations, and regional rules from the database."
      />

      {/* BULK DELETE MODAL */}
      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected collections`}
        itemType="Collections (Bulk)"
        onSoftDelete={handleBulkDelete}
        onPermanentDelete={handleBulkDelete}
        isSoftDeleting={bulkSaving}
        isPermanentDeleting={bulkSaving}
        softDeleteDescription="Hides the selected collections from the active storefront and admin catalog."
        permanentDeleteDescription="Physically removes the selected collections from the database."
      />

      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={(media) => form.setFieldValue("image", media.url)}
        title="Select Collection Image"
        acceptTypes={["IMAGE"]}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
