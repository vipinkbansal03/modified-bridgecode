"use client";

import Link from "next/link";
import { useState, useMemo, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Edit2, Eye, EyeOff, FileText, Image as ImageIcon, Layers, Trash2, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminStatsGrid,
  AdminListToolbar,
  AdminDeleteModal,
  DataTable,
  StatusBadge,
  useToast,
  AdminBulkActionsBar,
  Column,
} from "@/components/admin/AdminComponents";
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
  if (!price) return "—";
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
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<VariantSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
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
      const res = await adminApi.get("/products/variants", {
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

  const { data, isLoading, isFetching, refetch } = useAdminVariants({
    page,
    limit,
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
      width: "70px",
      render: (row) => {
        const media = row.product.media?.[0];
        return (
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8] shrink-0">
            {media?.url ? (
              <img src={media.url} alt={media.altText ?? row.product.title} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={16} className="text-[#BDBDBD]" />
            )}
          </div>
        );
      },
    },
    {
      key: "product",
      label: "Product",
      width: "200px",
      render: (row) => (
        <div className="min-w-0 pr-3">
          <div className="truncate font-semibold text-[#1A1A1A] text-[13px]" title={row.product.title}>
            {row.product.title}
          </div>
          <div className="truncate text-[11.5px] text-[#6B6B6B] mt-0.5">
            {row.product.sku || row.product.category?.name || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "title",
      label: "Variant",
      width: "360px",
      render: (row) => (
        <div className="min-w-0 pr-4">
          <div className="font-semibold text-[#1A1A1A] text-[13px] leading-snug break-words" title={row.title}>
            {row.title}
          </div>
          {row.package?.title ? (
            <div className="text-[11.5px] text-[#6B6B6B] mt-0.5 font-medium">
              Package: {row.package.title}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "sku",
      label: "SKU",
      width: "160px",
      render: (row) => <span className="font-medium text-[#1A1A1A] text-[12.5px] font-mono">{row.sku || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "110px",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "countryAvailability",
      label: "Countries",
      width: "90px",
      render: (row) => <span className="font-medium text-[#1A1A1A] text-[12.5px]">{row.countries?.length ?? 0}</span>,
    },
    {
      key: "inventory",
      label: "Inventory",
      width: "130px",
      render: (row) => {
        const inventory = getBaseInventory(row);
        const stock = Number(inventory?.stock ?? 0);
        const reserved = Number(inventory?.reservedStock ?? 0);
        return <span className="font-medium text-[#1A1A1A] text-[12.5px]">{`${stock} / ${Math.max(0, stock - reserved)}`}</span>;
      },
    },
    {
      key: "price",
      label: "Price",
      width: "100px",
      render: (row) => <span className="font-semibold text-[#1A1A1A] text-[12.5px]">{formatPrice(row)}</span>,
    },
    {
      key: "updatedAt",
      label: "Updated Date",
      width: "110px",
      render: (row) => <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">{new Date(row.updatedAt).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "170px",
      align: "left",
      render: (row) => (
        <div className="flex items-center justify-start gap-1">
          <Link
            href={`/admin/products/${row.product.id}/edit`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs"
            title="View product"
          >
            <Eye size={13} />
          </Link>
          {canUpdate && (
            <button
              type="button"
              onClick={() => {
                router.push(`/admin/variants?productId=${row.product.id}&variant=${row.id}`, { scroll: false });
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs cursor-pointer"
              title="Edit variant"
            >
              <Edit2 size={13} />
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => handleDuplicate(row)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
              title="Duplicate variant"
              disabled={duplicateVariant.isPending}
            >
              <Copy size={13} />
            </button>
          )}
          {canUpdate && (
            <button
              type="button"
              onClick={() => handleStatusToggle(row)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
              title={row.status === "ACTIVE" ? "Deactivate variant" : "Activate variant"}
              disabled={updateVariant.isPending}
            >
              {row.status === "ACTIVE" ? <EyeOff size={13} /> : <CheckCircle2 size={13} />}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleting(row)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] transition-colors shadow-2xs cursor-pointer"
              title="Delete variant"
            >
              <Trash2 size={13} />
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
          { title: "Inactive Variants", value: variantStats.inactive, subtitle: "Disabled / hidden", icon: <XCircle size={18} />, color: "bg-gray-600", isLoading: inactiveLoading },
        ]}
      />

      <div className="space-y-5">
        <AdminListToolbar
          search={{
            value: search,
            onChange: (val: string) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search variants...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [status, sortBy !== "updatedAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Variants refreshed."));
            },
            isRefreshing: isFetching,
          }}
          onResetFilters={() => {
            setStatus("");
            setSortBy("updatedAt");
            setSortDir("desc");
            setPage(1);
          }}
          filterPanel={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DRAFT">Draft</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as VariantSortBy);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none"
              >
                <option value="updatedAt">Sort by Updated Date</option>
                <option value="createdAt">Sort by Created Date</option>
                <option value="title">Sort by Variant Name</option>
                <option value="sku">Sort by SKU</option>
                <option value="status">Sort by Status</option>
                <option value="product">Sort by Product</option>
              </select>
              <select
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          }
        />

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
          totalItems={data?.pagination?.total ?? 0}
          currentPage={page}
          pageSize={limit}
          totalPages={data?.pagination?.totalPages || 1}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
          pageSizeOptions={[10, 25, 50, 100]}
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
                { value: "delete", label: "Delete selected" },
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
