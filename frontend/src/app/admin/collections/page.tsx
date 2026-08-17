"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Copy, Edit2, Globe, Image as ImageIcon, Layers, Package, Plus, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminListToolbar, AdminSelect, AdminStatsGrid, Column, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, LoadingButton } from "@/components/admin/AdminComponents";
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
import { getAdminErrorMessage } from "@/services/adminApi";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { Loader2 } from "lucide-react";

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

const emptyForm = { id: "", name: "", slug: "", description: "", image: "", status: "ACTIVE", sortOrder: "0", productIds: [] as string[] };
const emptyDiscountForm = {
  name: "",
  type: "TIER",
  status: "ACTIVE",
  tierId: "",
  minQuantity: "",
  discountPercent: "",
  fixedAmount: "",
  countryId: "",
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<CollectionSortBy>("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showForm, setShowForm] = useState(false);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [countrySearch, setCountrySearch] = useState("");
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const results = await uploadMediaFiles([file], {
        entityType: "COLLECTION",
        purpose: "COLLECTION_IMAGE",
      });
      const url = results[0]?.url;
      if (url) {
        form.setFieldValue("image", url);
        showToast("Image uploaded successfully", "success");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to upload image"), "error");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();

  const form = useAdminForm({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Collection name is required.";
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim() || undefined,
        description: values.description.trim() || null,
        image: values.image.trim() || null,
        status: values.status as any,
        sortOrder: Number(values.sortOrder),
        productIds: values.productIds,
      };
      try {
        if (values.id) {
          await updateCollection.mutateAsync({ id: values.id, ...payload });
          showToast("Collection updated.");
        } else {
          const result = await createCollection.mutateAsync(payload);
          setSelectedCollectionId(result.data.id);
          showToast("Collection created.");
        }
        resetForm();
        setSelectedCollectionId("");
        setShowForm(false);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save collection."), "error");
      }
    },
  });

  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);

  const { data, isLoading, refetch, isFetching } = useAdminCollections({
    page,
    limit: 10,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortDir,
  });
  const { data: collectionsAllData, isLoading: collectionsAllLoading } = useAdminCollections({ limit: 500 });
  const collectionsAll: Collection[] = (collectionsAllData?.data ?? []) as Collection[];

  const collectionStats = useMemo(() => {
    const total = collectionsAll.length;
    const active = collectionsAll.filter((c) => c.status === "ACTIVE").length;
    const inactive = collectionsAll.filter((c) => c.status === "INACTIVE").length;
    const totalProducts = collectionsAll.reduce((acc, c) => acc + (c._count?.products ?? c.products?.length ?? 0), 0);
    return { total, active, inactive, totalProducts };
  }, [collectionsAll]);

  const { data: productsData } = useAdminProducts({ limit: 200 });
  const { data: countries, isLoading: countriesLoading } = useAdminCollectionCountries(selectedCollectionId);
  const { data: allCountries = [] } = useAdminCountries();
  const { data: tiers = [] } = useAdminTiers();
  const { data: collectionDiscounts = [] } = useAdminCollectionDiscounts(selectedCollectionId);
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
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return selectedCountries;
    return selectedCountries.filter((country) => `${country.name} ${country.code}`.toLowerCase().includes(query));
  }, [countrySearch, selectedCountries]);

  useEffect(() => {
    if (!selectedCollectionId) {
      setCountryOverrides((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    const nextOverrides = Object.fromEntries(selectedCountries.map((country) => [country.id, country.enabled]));
    setCountryOverrides((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextOverrides);
      if (currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === nextOverrides[key])) {
        return current;
      }
      return nextOverrides;
    });
  }, [selectedCollectionId, selectedCountries]);

  const edit = (collection: Collection) => {
    form.reset({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description ?? "",
      image: collection.image ?? "",
      status: collection.status,
      sortOrder: String(collection.sortOrder ?? 0),
      productIds: collection.products?.map((item) => item.productId) ?? [],
    });
    setSelectedCollectionId(collection.id);
    setShowForm(true);
  };

  const openCreateModal = () => {
    form.reset(emptyForm);
    setShowForm(true);
  };
  const reset = () => {
    form.reset(emptyForm);
    setSelectedCollectionId("");
    setShowForm(false);
  };
  const toggleProduct = (productId: string) => {
    const currentIds = form.values.productIds;
    form.setFieldValue("productIds", currentIds.includes(productId) ? currentIds.filter((id) => id !== productId) : [...currentIds, productId]);
  };



  const saveCountries = async () => {
    try {
      await updateCountries.mutateAsync(selectedCountries.map((country) => ({ countryId: country.id, enabled: countryOverrides[country.id] ?? country.enabled })));
      showToast("Country visibility saved.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save country visibility."), "error");
    }
  };

  const createDiscount = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedCountries = (discountForm as any).countryIds?.length ? (discountForm as any).countryIds : (discountForm.countryId ? [discountForm.countryId] : []);
    const basePayload = {
      ...discountForm,
      tierId: discountForm.type === "TIER" ? discountForm.tierId || null : null,
      minQuantity: discountForm.type === "MOQ" ? discountForm.minQuantity || null : null,
      discountPercent: discountForm.discountPercent || null,
      fixedAmount: discountForm.fixedAmount || null,
      startDate: discountForm.startDate || null,
      endDate: discountForm.endDate || null,
    };
    try {
      if (selectedCountries.length > 1) {
        for (const cId of selectedCountries) {
          await createCollectionDiscount.mutateAsync({ ...basePayload, countryId: cId });
        }
      } else {
        await createCollectionDiscount.mutateAsync({ ...basePayload, countryId: selectedCountries[0] || null });
      }
      setDiscountForm(emptyDiscountForm);
      showToast("Collection discount created.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create collection discount."), "error");
    }
  };

  const removeDiscount = async (discountId: string) => {
    try {
      await deleteCollectionDiscount.mutateAsync(discountId);
      showToast("Collection discount removed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to remove collection discount."), "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCollection.mutateAsync(deleting);
      showToast("Collection deleted.");
      if (selectedCollectionId === deleting) {
        setSelectedCollectionId("");
        setCountryOverrides((current) => (Object.keys(current).length === 0 ? current : {}));
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete collection."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (collectionId: string) => {
    try {
      const result = await duplicateCollection.mutateAsync(collectionId);
      setSelectedCollectionId(result.data.id);
      showToast("Collection duplicated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate collection."), "error");
    }
  };

  const handleArchiveToggle = async (collection: Collection) => {
    try {
      if (collection.status === "ACTIVE") {
        await archiveCollection.mutateAsync(collection.id);
        showToast("Collection archived.");
      } else {
        await restoreCollection.mutateAsync(collection.id);
        showToast("Collection restored.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update collection status."), "error");
    }
  };

  const columns: Column<Collection>[] = useMemo(
    () => [
      {
        key: "image",
        label: "Image",
        width: "84px",
        render: (row) => (
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
            {row.image ? <img src={row.image} alt={row.name} className="h-full w-full object-cover" /> : <ImageIcon size={16} className="text-[#9A9A9A]" />}
          </div>
        ),
      },
      {
        key: "name",
        label: "Collection",
        width: "280px",
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-[#1A1A1A]">{row.name}</div>
            <div className="truncate text-[12px] text-[#6B6B6B]">{row.description || "No description"}</div>
          </div>
        ),
      },
      { key: "slug", label: "Slug", width: "180px", render: (row) => <span className="truncate font-mono text-[12px] text-[#6B6B6B]">{row.slug}</span> },
      { key: "products", label: "Products", width: "100px", render: (row) => row._count?.products ?? row.products?.length ?? 0 },
      { key: "sortOrder", label: "Sort", width: "84px", render: (row) => row.sortOrder },
      { key: "status", label: "Status", width: "120px", render: (row) => <StatusBadge status={row.status} /> },
      {
        key: "updatedAt",
        label: "Updated",
        width: "120px",
        render: (row) => (row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"),
      },
      {
        key: "actions",
        label: "Actions",
        width: "220px",
        render: (row) => (
          <div className="flex items-center gap-1.5">
            {canCreate && (
              <button
                type="button"
                onClick={() => handleDuplicate(row.id)}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                title="Duplicate collection"
              >
                <Copy size={13} />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => handleArchiveToggle(row)}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                title={row.status === "ACTIVE" ? "Archive collection" : "Restore collection"}
              >
                {row.status === "ACTIVE" ? <Archive size={13} /> : <RotateCcw size={13} />}
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => edit(row)}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                title="Edit collection"
              >
                <Edit2 size={13} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleting(row.id)}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
                title="Delete collection"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [archiveCollection, duplicateCollection, edit, canCreate, canUpdate, canDelete],
  );

  const isCreateModalOpen = showForm && !form.values.id;
  const isEditInlineOpen = showForm && !!form.values.id;

  const collectionForm = (
        <form onSubmit={form.handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <AdminInput label="Name" required {...form.getFieldProps("name")} error={form.errors.name as string} />
            <AdminInput label="Slug" placeholder="Auto from name if blank" {...form.getFieldProps("slug")} error={form.errors.slug as string} />
            <AdminSelect
              label="Status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
              {...form.getFieldProps("status")}
              error={form.errors.status as string}
            />
          </div>
          <div className="grid grid-cols-3 gap-6">
            <AdminInput label="Sort Order" type="number" {...form.getFieldProps("sortOrder")} error={form.errors.sortOrder as string} />
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-[#111]">Image URL</label>
              <div className="flex gap-2">
                <input
                  {...form.getFieldProps("image")}
                  className="flex-1 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#E31E24]"
                  placeholder="https://..."
                />
                <label className="flex cursor-pointer items-center justify-center rounded-md bg-[#F2F2F2] px-3 py-2 text-[13.5px] font-medium text-[#111] hover:bg-[#E6E6E6]">
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : "Upload"}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                </label>
              </div>
              {form.errors.image && <div className="text-[12px] text-red-500">{form.errors.image as string}</div>}
            </div>
            <AdminInput label="Description" {...form.getFieldProps("description")} error={form.errors.description as string} />
          </div>
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-medium text-[#111]">Products</div>
        <div className="grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto rounded-md border border-[#E6E6E6] p-3 md:grid-cols-2">
          {products.map((product) => (
            <label key={product.id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={form.values.productIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    {product.title}
            </label>
          ))}
        </div>
      </div>

      <LoadingButton
        type="submit"
        loading={form.isSubmitting || createCollection.isPending || updateCollection.isPending}
        loadingText={form.values.id ? "Updating..." : "Creating..."}
        className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
      >
        {form.values.id ? "Update Collection" : "Create Collection"}
      </LoadingButton>
        </form>
  );

  return (
    <AdminLayout title="Collections" breadcrumb={[{ label: "Collections" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Total Collections", value: collectionStats.total, subtitle: "Curated product groupings", icon: <Layers size={18} />, isLoading: collectionsAllLoading },
          { title: "Active Collections", value: collectionStats.active, subtitle: "Visible on storefront", icon: <CheckCircle2 size={18} />, color: "bg-green-600", isLoading: collectionsAllLoading },
          { title: "Inactive Collections", value: collectionStats.inactive, subtitle: "Hidden collections", icon: <XCircle size={18} />, color: "bg-gray-600", isLoading: collectionsAllLoading },
          { title: "Assigned Products", value: collectionStats.totalProducts, subtitle: "Total product assignments", icon: <Package size={18} />, color: "bg-blue-600", isLoading: collectionsAllLoading }
        ]}
      />

      <AdminListToolbar
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: "Search collections...",
          widthClassName: "w-[240px]",
        }}
        leftExtra={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13.5px] outline-none hover:border-[#D1D1D1]"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as CollectionSortBy)} className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13.5px] outline-none hover:border-[#D1D1D1]">
              <option value="sortOrder">Sort order</option>
              <option value="name">Name</option>
              <option value="slug">Slug</option>
              <option value="status">Status</option>
              <option value="updatedAt">Updated date</option>
              <option value="createdAt">Created date</option>
            </select>
            <select value={sortDir} onChange={(event) => setSortDir(event.target.value as "asc" | "desc")} className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13.5px] outline-none hover:border-[#D1D1D1]">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        }
        refresh={{
          onRefresh: refetch,
          isRefreshing: isFetching,
        }}
        primaryAction={canCreate ? {
          onClick: openCreateModal,
          label: "Create Collection",
        } : undefined}
      />

      <Modal
        open={showForm}
        onClose={reset}
        title={form.values.id ? "Edit Collection" : "Create Collection"}
        panelClassName="max-w-5xl max-h-[calc(100vh-2.5rem)] overflow-y-auto"
      >
        {showForm ? (
          <div className="space-y-6 p-6">
            {collectionForm}

            {form.values.id && (
              <div className="space-y-6 border-t border-[#E6E6E6] pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[14.5px] font-bold text-[#111]">Country Visibility</h3>
                    <p className="text-[12.5px] text-[#6B6B6B]">Use the switches below to control where this collection appears.</p>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                    <input
                      value={countrySearch}
                      onChange={(event) => setCountrySearch(event.target.value)}
                      placeholder="Search countries..."
                      className="w-[240px] rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3 text-[13px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                  <LoadingButton onClick={saveCountries} loading={updateCountries.isPending} loadingText="Saving..." className="rounded-md bg-[#111] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222]">
                    Save Visibility
                  </LoadingButton>
                </div>

                <div className="grid max-h-[260px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-3">
                  {countriesLoading ? (
                    <div className="col-span-full rounded-md border border-dashed border-[#E6E6E6] px-4 py-8 text-center text-[13px] text-[#9A9A9A]">Loading country visibility...</div>
                  ) : filteredCountries.length === 0 ? (
                    <div className="col-span-full rounded-md border border-dashed border-[#E6E6E6] px-4 py-8 text-center text-[13px] text-[#9A9A9A]">No countries found.</div>
                  ) : (
                    filteredCountries.map((country) => (
                      <label key={country.id} className="flex items-center gap-2 rounded border border-[#E6E6E6] px-3 py-2 text-[13px]">
                        <input type="checkbox" checked={countryOverrides[country.id] ?? country.enabled} onChange={(event) => setCountryOverrides((current) => ({ ...current, [country.id]: event.target.checked }))} />
                        {country.name} ({country.code})
                      </label>
                    ))
                  )}
                </div>

                <div className="border-t border-[#E6E6E6] pt-6">
                  <h3 className="mb-3 text-[14.5px] font-bold text-[#111]">Discount Rules</h3>
                  <form onSubmit={createDiscount} className="grid gap-3 rounded-md bg-[#FAFAFA] p-4 md:grid-cols-4">
                    <AdminInput label="Name" value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} />
                    <AdminSelect
                      label="Type"
                      value={discountForm.type}
                      onChange={(event) => setDiscountForm({ ...discountForm, type: event.target.value, tierId: "", minQuantity: "" })}
                      options={[
                        { value: "TIER", label: "Tier" },
                        { value: "MOQ", label: "MOQ" },
                      ]}
                    />
                    {discountForm.type === "TIER" ? (
                      <AdminSelect
                        label="Tier"
                        value={discountForm.tierId}
                        onChange={(event) => setDiscountForm({ ...discountForm, tierId: event.target.value })}
                        options={[{ value: "", label: "Select tier" }, ...tiers.map((tier: { id: string; name: string }) => ({ value: tier.id, label: tier.name }))]}
                      />
                    ) : (
                      <AdminInput label="Minimum Qty" type="number" value={discountForm.minQuantity} onChange={(event) => setDiscountForm({ ...discountForm, minQuantity: event.target.value })} />
                    )}
                    <AdminMultiSearchableSelect
                      label="Countries"
                      values={(discountForm as any).countryIds ?? (discountForm.countryId ? [discountForm.countryId] : [])}
                      onValuesChange={(values) => setDiscountForm({ ...discountForm, countryIds: values, countryId: values[0] ?? "" } as any)}
                      options={(allCountries as any[]).map((country) => ({
                        value: country.id,
                        label: `${country.name} (${country.code})`,
                      }))}
                      placeholder="Select countries"
                      allowSelectAll
                      selectAllLabel="All countries"
                    />
                    <AdminInput label="Discount %" type="number" value={discountForm.discountPercent} onChange={(event) => setDiscountForm({ ...discountForm, discountPercent: event.target.value, fixedAmount: "" })} />
                    <AdminInput label="Fixed Amount" type="number" value={discountForm.fixedAmount} onChange={(event) => setDiscountForm({ ...discountForm, fixedAmount: event.target.value, discountPercent: "" })} />
                    <AdminInput label="Start Date" type="date" value={discountForm.startDate} onChange={(event) => setDiscountForm({ ...discountForm, startDate: event.target.value })} />
                    <AdminInput label="End Date" type="date" value={discountForm.endDate} onChange={(event) => setDiscountForm({ ...discountForm, endDate: event.target.value })} />
                    <div className="md:col-span-4">
                      <LoadingButton type="submit" loading={createCollectionDiscount.isPending} loadingText="Adding..." className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
                        Add Discount
                      </LoadingButton>
                    </div>
                  </form>
                  <div className="mt-4 divide-y divide-[#EFEFEF] rounded-md border border-[#E6E6E6] bg-white">
                    {(collectionDiscounts as DiscountRow[]).length === 0 ? (
                      <div className="p-4 text-[13px] text-[#9A9A9A]">No discounts assigned to this collection.</div>
                    ) : (
                      (collectionDiscounts as DiscountRow[]).map((discount) => (
                        <div key={discount.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-[13px]">
                          <div>
                            <div className="font-medium text-[#111]">{discount.name}</div>
                            <div className="text-[12px] text-[#6B6B6B]">
                              {discount.type === "TIER" ? `Tier: ${discount.tier?.name || "All"}` : `Min Qty: ${discount.minQuantity || 1}`} •{" "}
                              {discount.discountPercent ? `${discount.discountPercent}% off` : `$${discount.fixedAmount} off`} • Country: {discount.country?.code || "Global"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={discount.status} />
                            <button type="button" onClick={() => removeDiscount(discount.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <DataTable<Collection> columns={columns} data={collections} rowKey="id" isLoading={isLoading} emptyMessage="No collections yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />

      <ConfirmModal
        open={!!deleting}
        title="Delete collection?"
        message="This removes the collection and its product/country mappings."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteCollection.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
