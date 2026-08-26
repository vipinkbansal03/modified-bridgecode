"use client";

import Link from "next/link";
import { useState, useMemo, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Edit2, Eye, EyeOff, FileText, Image as ImageIcon, Layers, Trash2, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, AdminStatsGrid, Column, AdminDeleteModal, DataTable, Pagination, StatCard, StatusBadge, useToast, AdminBulkActionsBar } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import {
  useAdminVariants,
  useDeleteVariant,
  usePermanentDeleteVariant,
  useDuplicateVariant,
  useUpdateVariant,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type VariantRow = {
  id: string;
  title: string;
  sku: string | null;
  status: string;
  variantKey: string;
  updatedAt: string;
  product: {
    id: string;
    title: string;
    sku: string | null;
    category?: { id: string; name: string; slug: string } | null;
    media?: { url: string; altText?: string | null }[];
  };
  package?: { id: string; title: string } | null;
  countries?: { countryId: string }[];
  inventories?: { countryId?: string | null; stock?: number; reservedStock?: number; status?: string }[];
  prices?: { sellingPrice: string | number; currency: { symbol: string; code: string }; country?: { name: string; code: string } | null }[];
};

type VariantSortBy = "updatedAt" | "createdAt" | "title" | "sku" | "status" | "product";

function formatPrice(row: VariantRow) {
  const price = row.prices?.[0];
  if (!price) return "No price";
  const amount = Number(price.sellingPrice);
  const formatted = Number.isFinite(amount) ? amount.toLocaleString("en-IN") : String(price.sellingPrice);
  return `${price.currency.symbol}${formatted}`;
}

function getBaseInventory(row: VariantRow) {
  return row.inventories?.find((inventory) => !inventory.countryId) ?? null;
}

function VariantsList() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("variants.create");
  const canUpdate = hasPermission("variants.update");
  const canDelete = hasPermission("variants.delete");

  const router = useRouter();
  const searchParams = useSearchParams();
  const activeVariantId = searchParams.get("variant");
  const activeProductId = searchParams.get("productId");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<VariantSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleting, setDeleting] = useState<VariantRow | null>(null);
  const { showToast, ToastComponent } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/variants", {
        params: {
          search: debouncedSearch || undefined,
          status: status || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((v: any) => v.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} variants across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all variants.", "error");
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;

    if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }

    setBulkSaving(true);
    try {
      if (bulkAction === "activate") {
        await Promise.all(
          selectedIds.map((id) => {
            const variant = variants.find((v) => v.id === id);
            return updateVariant.mutateAsync({
              productId: variant?.product.id ?? "",
              variantId: id,
              data: { status: "ACTIVE" },
            });
          })
        );
        showToast(`Successfully activated ${selectedIds.length} variant(s).`, "success");
      } else if (bulkAction === "deactivate") {
        await Promise.all(
          selectedIds.map((id) => {
            const variant = variants.find((v) => v.id === id);
            return updateVariant.mutateAsync({
              productId: variant?.product.id ?? "",
              variantId: id,
              data: { status: "INACTIVE" },
            });
          })
        );
        showToast(`Successfully deactivated ${selectedIds.length} variant(s).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, status, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading } = useAdminVariants({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: status || undefined,
    sortBy,
    sortDir,
  });

  const { data: totalVariantData, isLoading: totalLoading } = useAdminVariants({ limit: 1 });
  const { data: activeVariantData, isLoading: activeLoading } = useAdminVariants({ status: "ACTIVE", limit: 1 });
  const { data: draftVariantData, isLoading: draftLoading } = useAdminVariants({ status: "DRAFT", limit: 1 });
  const { data: inactiveVariantData, isLoading: inactiveLoading } = useAdminVariants({ status: "INACTIVE", limit: 1 });

  const variantStats = useMemo(() => {
    return {
      total: totalVariantData?.pagination?.total ?? 0,
      active: activeVariantData?.pagination?.total ?? 0,
      draft: draftVariantData?.pagination?.total ?? 0,
      inactive: inactiveVariantData?.pagination?.total ?? 0,
    };
  }, [totalVariantData, activeVariantData, draftVariantData, inactiveVariantData]);

  const updateVariant = useUpdateVariant();
  const duplicateVariant = useDuplicateVariant();
  const deleteVariant = useDeleteVariant();
  const permanentDeleteVariant = usePermanentDeleteVariant();

  const variants: VariantRow[] = data?.data ?? [];

  const handleDuplicate = async (row: VariantRow) => {
    try {
      await duplicateVariant.mutateAsync({ productId: row.product.id, variantId: row.id });
      showToast("Variant duplicated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate variant."), "error");
    }
  };

  const handleStatusToggle = async (row: VariantRow) => {
    try {
      const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateVariant.mutateAsync({
        productId: row.product.id,
        variantId: row.id,
        data: { status: nextStatus },
      });
      showToast(`Variant ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update variant status."), "error");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteVariant.mutateAsync({ productId: deleting.product.id, variantId: deleting.id });
      showToast("Variant soft-deleted.");
      setDeleting(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete variant."), "error");
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleting) return;
    try {
      await permanentDeleteVariant.mutateAsync({ productId: deleting.product.id, variantId: deleting.id });
      showToast("Variant permanently deleted from database.");
      setDeleting(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to permanently delete variant."), "error");
    }
  };

  const columns: Column<VariantRow>[] = [
    {
      key: "image",
      label: "Image",
      width: "84px",
      render: (row) => {
        const media = row.product.media?.[0];
        return (
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-[#E6E6E6] bg-[#F8F8F8]">
            {media?.url ? <img src={media.url} alt={media.altText ?? row.product.title} className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-[#BDBDBD]" />}
          </div>
        );
      },
    },
    {
      key: "product",
      label: "Product",
      width: "230px",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[#1A1A1A]">{row.product.title}</div>
          <div className="truncate text-[12px] text-[#9A9A9A]">{row.product.sku || row.product.id}</div>
        </div>
      ),
    },
    {
      key: "title",
      label: "Variant",
      width: "220px",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[#1A1A1A]">{row.title}</div>
          <div className="truncate text-[12px] text-[#9A9A9A]">{row.package?.title || row.variantKey}</div>
        </div>
      ),
    },
    {
      key: "sku",
      label: "SKU",
      width: "150px",
      render: (row) => <span className="font-medium text-[#1A1A1A]">{row.sku || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "120px",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "countryAvailability",
      label: "Country Availability",
      width: "170px",
      render: (row) => <span className="font-medium text-[#1A1A1A]">{row.countries?.length ?? 0}</span>,
    },
    {
      key: "inventory",
      label: "Inventory",
      width: "140px",
      render: (row) => {
        const inventory = getBaseInventory(row);
        const stock = Number(inventory?.stock ?? 0);
        const reserved = Number(inventory?.reservedStock ?? 0);
        return <span className="font-medium text-[#1A1A1A]">{`${stock} / ${Math.max(0, stock - reserved)}`}</span>;
      },
    },
    {
      key: "price",
      label: "Price",
      width: "130px",
      render: (row) => <span className="font-medium text-[#1A1A1A]">{formatPrice(row)}</span>,
    },
    {
      key: "updatedAt",
      label: "Updated Date",
      width: "140px",
      render: (row) => <span className="text-[#1A1A1A]">{new Date(row.updatedAt).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "260px",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/admin/products/${row.product.id}/edit`} className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]" title="View product">
            <Eye size={15} />
          </Link>
          {canUpdate && (
            <button
              type="button"
              onClick={() => {
                router.push(`/admin/variants?productId=${row.product.id}&variant=${row.id}`, { scroll: false });
              }}
              className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
              title="Edit variant"
            >
              <Edit2 size={15} />
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => handleDuplicate(row)}
              className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
              title="Duplicate variant"
              disabled={duplicateVariant.isPending}
            >
              <Copy size={15} />
            </button>
          )}
          {canUpdate && (
            <button
              type="button"
              onClick={() => handleStatusToggle(row)}
              className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
              title={row.status === "ACTIVE" ? "Deactivate variant" : "Activate variant"}
              disabled={updateVariant.isPending}
            >
              {row.status === "ACTIVE" ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleting(row)}
              className="rounded border border-[#F2D7D7] p-2 text-[#E31E24] hover:bg-[#FFF5F5]"
              title="Delete variant"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Variants" breadcrumb={[{ label: "Variants" }]}>
      {/* StatCards Row */}
      <AdminStatsGrid
        stats={[
          { title: "Total Variants", value: variantStats.total, subtitle: "Configured SKU combinations", icon: <Layers size={18} />, isLoading: totalLoading },
          { title: "Active Variants", value: variantStats.active, subtitle: "Purchasable & active", icon: <CheckCircle2 size={18} />, color: "bg-green-600", isLoading: activeLoading },
          { title: "Draft Variants", value: variantStats.draft, subtitle: "Unpublished variants", icon: <FileText size={18} />, color: "bg-amber-600", isLoading: draftLoading },
          { title: "Inactive Variants", value: variantStats.inactive, subtitle: "Disabled / hidden", icon: <XCircle size={18} />, color: "bg-gray-600", isLoading: inactiveLoading }
        ]}
      />

      <div className="space-y-5">
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="mb-4 rounded-md border border-dashed border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3 text-[13px] leading-5 text-[#6B6B6B]">
            Variants are managed through the product editor. The page below lists them globally so you can search and route directly to the right product.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AdminInput
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Search variants..."
                className="pl-3"
                label="Search"
              />
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value);
                }}
                options={[
                  { value: "", label: "All status" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Sort by"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as VariantSortBy)}
                options={[
                  { value: "updatedAt", label: "Updated date" },
                  { value: "createdAt", label: "Created date" },
                  { value: "title", label: "Variant name" },
                  { value: "sku", label: "SKU" },
                  { value: "status", label: "Status" },
                  { value: "product", label: "Product" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
                ]}
              />
          </div>
        </div>

        <DataTable<VariantRow>
          title="Variants List"
          columns={columns}
          data={variants}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage="No variants found."
          enableSelection={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          totalItems={data?.pagination?.total}
          currentPage={page}
          pageSize={10}
          totalPages={data?.pagination?.totalPages || 1}
          onPageChange={setPage}
          onSelectAll={handleSelectAll}
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
              actionType={bulkAction}
              onActionTypeChange={setBulkAction}
              actions={[
                { value: "activate", label: "Mark active" },
                { value: "deactivate", label: "Mark inactive" },
                { value: "delete", label: "Delete selected" }
              ]}
              onApply={handleBulkAction}
              applyLoading={bulkSaving}
              applyDisabled={!bulkAction || selectedIds.length === 0}
            />
          )}
        />
      </div>

      <AdminDeleteModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        itemName={deleting?.title}
        itemType="Variant"
        onSoftDelete={handleDelete}
        onPermanentDelete={handlePermanentDelete}
        isSoftDeleting={deleteVariant.isPending}
        isPermanentDeleting={permanentDeleteVariant.isPending}
      />

      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected variants`}
        itemType="Variants (Bulk)"
        onSoftDelete={async () => {
          setBulkSaving(true);
          try {
            await Promise.all(
              selectedIds.map((id) => {
                const variant = variants.find((v) => v.id === id);
                return deleteVariant.mutateAsync({
                  productId: variant?.product.id ?? "",
                  variantId: id,
                });
              })
            );
            showToast(`Successfully soft-deleted ${selectedIds.length} variant(s).`, "success");
            setSelectedIds([]);
            setBulkAction("");
            setShowBulkDeleteModal(false);
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to complete bulk delete."), "error");
          } finally {
            setBulkSaving(false);
          }
        }}
        onPermanentDelete={async () => {
          setBulkSaving(true);
          try {
            await Promise.all(
              selectedIds.map((id) => {
                const variant = variants.find((v) => v.id === id);
                return permanentDeleteVariant.mutateAsync({
                  productId: variant?.product.id ?? "",
                  variantId: id,
                });
              })
            );
            showToast(`Successfully permanently deleted ${selectedIds.length} variant(s).`, "success");
            setSelectedIds([]);
            setBulkAction("");
            setShowBulkDeleteModal(false);
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to complete bulk permanent delete."), "error");
          } finally {
            setBulkSaving(false);
          }
        }}
        isSoftDeleting={bulkSaving && deleteVariant.isPending}
        isPermanentDeleting={bulkSaving && permanentDeleteVariant.isPending}
        softDeleteDescription={`Hides the ${selectedIds.length} selected variants from the active catalog while safely retaining order and quote history.`}
        permanentDeleteDescription={`Physically purges the ${selectedIds.length} selected variants from the database. Any variant referenced in existing orders or quotes will be blocked.`}
      />

      {activeProductId && activeVariantId && (
        <ProductEditor productId={activeProductId} isEmbed={true} />
      )}

      {ToastComponent}
    </AdminLayout>
  );
}

export default function VariantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F2F2F2]">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
        </div>
      }
    >
      <VariantsList />
    </Suspense>
  );
}
