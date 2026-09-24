"use client";

import Link from "next/link";
import { useState, useMemo, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Copy, FileText, Image as ImageIcon, Layers, RotateCcw, Trash2, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { formatDate } from "@/utils/formatDate";
import { cn } from "@/utils/cn";
import { Modal } from "@/components/ui/Modal";
import {
  AdminStatsGrid,
  AdminListToolbar,
  AdminSelect,
  AdminRowActions,
  AdminDeleteModal,
  ConfirmModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  AdminBulkActionsBar,
  Column,
} from "@/components/admin/AdminComponents";
import { AdminActionButton } from "@/components/admin/AdminRowActions";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import {
  useAdminVariants,
  useAdminVariantCounts,
  useDeleteVariant,
  useRestoreVariant,
  usePermanentDeleteVariant,
  useBulkPermanentDeleteVariants,
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
  deletedAt?: string | null;
  canPermanentDelete?: boolean;
  permanentDeleteBlockReason?: string | null;
  dependencyCounts?: {
    orderItems: number;
    quoteItems: number;
    adjustments: number;
    activeStock: number;
    reservedStock: number;
    cartItems: number;
  };
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
  prices?: { sellingPrice: string | number; currency: { symbol: string; code: string; isBase?: boolean }; country?: { name: string; code: string } | null }[];
};

type VariantSortBy = "updatedAt" | "createdAt" | "title" | "sku" | "status" | "product";

const COLUMN_OPTIONS = [
  { key: "image", label: "Image" },
  { key: "product", label: "Product" },
  { key: "title", label: "Variant Name" },
  { key: "sku", label: "SKU" },
  { key: "status", label: "Status" },
  { key: "countryAvailability", label: "Countries" },
  { key: "inventory", label: "Inventory" },
  { key: "price", label: "Price" },
  { key: "updatedAt", label: "Updated Date" },
];

type ColumnKey = (typeof COLUMN_OPTIONS)[number]["key"];

const visibleColumnsDefault: Record<ColumnKey, boolean> = {
  image: true,
  product: true,
  title: true,
  sku: true,
  status: true,
  countryAvailability: true,
  inventory: true,
  price: true,
  updatedAt: true,
};

function formatPrice(row: VariantRow) {
  const price = row.prices?.find((p) => (p.currency as any)?.isBase || p.currency?.code === "INR") ?? row.prices?.[0];
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
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);
  const [deleting, setDeleting] = useState<VariantRow | null>(null);
  const { showToast, ToastComponent } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkPermanentModal, setShowBulkPermanentModal] = useState(false);
  const [bulkPermanentResult, setBulkPermanentResult] = useState<any | null>(null);

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
      if (status === "ARCHIVED") {
        setShowBulkPermanentModal(true);
      } else {
        setShowBulkDeleteModal(true);
      }
      return;
    }

    setBulkSaving(true);
    try {
      if (bulkAction === "restore") {
        await Promise.all(
          selectedIds.map((id) => {
            const variant = variants.find((v) => v.id === id);
            return restoreVariant.mutateAsync({
              productId: variant?.product.id ?? "",
              variantId: id,
            });
          })
        );
        showToast(`Successfully restored ${selectedIds.length} variant(s).`, "success");
        await refetch();
        void refetchVariantCounts();
      } else if (bulkAction === "activate") {
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
        await refetch();
        void refetchVariantCounts();
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
        await refetch();
        void refetchVariantCounts();
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

  const { data: variantCounts, isLoading: variantCountsLoading, refetch: refetchVariantCounts } = useAdminVariantCounts();

  const variantStats = useMemo(() => {
    return {
      total: variantCounts?.total ?? 0,
      active: variantCounts?.active ?? 0,
      draft: variantCounts?.draft ?? 0,
      inactive: variantCounts?.inactive ?? 0,
      archived: variantCounts?.archived ?? 0,
    };
  }, [variantCounts]);

  const updateVariant = useUpdateVariant();
  const duplicateVariant = useDuplicateVariant();
  const deleteVariant = useDeleteVariant();
  const restoreVariant = useRestoreVariant();
  const permanentDeleteVariant = usePermanentDeleteVariant();
  const bulkPermanentDeleteVariants = useBulkPermanentDeleteVariants();

  const variants: VariantRow[] = data?.data ?? [];

  const handleDuplicate = async (row: VariantRow) => {
    try {
      await duplicateVariant.mutateAsync({ productId: row.product.id, variantId: row.id });
      showToast("Variant duplicated.", "success");
      await refetch();
      void refetchVariantCounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate variant."), "error");
    }
  };

  const handleRestore = async (row: VariantRow) => {
    try {
      await restoreVariant.mutateAsync({ productId: row.product.id, variantId: row.id });
      showToast("Variant restored.", "success");
      await refetch();
      void refetchVariantCounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to restore variant."), "error");
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
      showToast(`Variant ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`, "success");
      await refetch();
      void refetchVariantCounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update variant status."), "error");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteVariant.mutateAsync({ productId: deleting.product.id, variantId: deleting.id });
      showToast("Variant soft-deleted.", "success");
      setDeleting(null);
      await refetch();
      void refetchVariantCounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete variant."), "error");
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleting) return;
    if (deleting.canPermanentDelete === false) {
      showToast(deleting.permanentDeleteBlockReason || "Permanent deletion is blocked for this variant.", "error");
      return;
    }
    try {
      await permanentDeleteVariant.mutateAsync({ productId: deleting.product.id, variantId: deleting.id });
      showToast(`Variant "${deleting.title}" permanently deleted from database.`, "success");
      setDeleting(null);
      await refetch();
      void refetchVariantCounts();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to permanently delete variant."), "error");
    }
  };

  const handleConfirmBulkPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    const totalSelected = selectedIds.length;
    setBulkSaving(true);
    try {
      const result = await bulkPermanentDeleteVariants.mutateAsync(selectedIds);
      setBulkSaving(false);
      setShowBulkPermanentModal(false);
      setBulkAction("");

      await refetch();
      void refetchVariantCounts();

      if (result) {
        const payload = (result as any)?.data ?? result;
        const deletedIds: string[] = Array.isArray(payload?.deletedIds) ? payload.deletedIds : [];
        const blocked: Array<{ id: string; name?: string; reason: string }> = Array.isArray(payload?.blocked) ? payload.blocked : [];
        const deletedCount = typeof payload?.deletedCount === "number" ? payload.deletedCount : deletedIds.length;
        const blockedCount = typeof payload?.blockedCount === "number" ? payload.blockedCount : (blocked.length || Math.max(0, totalSelected - deletedCount));

        if (blockedCount > 0 && deletedIds.length > 0) {
          setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
        } else if (deletedCount > 0 && blockedCount === 0) {
          setSelectedIds([]);
        }

        setBulkPermanentResult({
          totalSelected,
          deletedCount,
          blockedCount,
          deletedIds,
          blocked,
          tab: "variants",
        });

        if (blockedCount === 0 && deletedCount > 0) {
          showToast(`Successfully permanently deleted all ${deletedCount} variant(s).`, "success");
        } else if (deletedCount === 0 && blockedCount > 0) {
          showToast(`All ${blockedCount} selected variants are protected from permanent deletion.`, "error");
        } else {
          showToast(`Permanently deleted ${deletedCount} variant(s); ${blockedCount} protected variant(s) preserved.`, "warning");
        }
      }
    } catch (err) {
      setBulkSaving(false);
      showToast(getAdminErrorMessage(err, "Failed to permanently delete variants."), "error");
    }
  };

  const columns: Column<VariantRow>[] = useMemo(() => [
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
          <Link
            href={`/admin/products/${row.product.id}/edit`}
            className="truncate font-semibold text-[#1A1A1A] text-[13px] hover:text-[#E31E24] transition-colors block"
            title={row.product.title}
          >
            {row.product.title}
          </Link>
          <div className="truncate text-[11.5px] text-[#6B6B6B] mt-0.5">
            {row.product.sku || row.product.category?.name || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "title",
      label: "Variant",
      width: "320px",
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
      render: (row) => {
        const isArchived = Boolean(row.deletedAt || row.status === "ARCHIVED");
        return <StatusBadge status={isArchived ? "ARCHIVED" : row.status} />;
      },
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
      width: "120px",
      render: (row) => <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">{formatDate(row.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "160px",
      render: (row) => {
        const isArchived = Boolean(row.deletedAt || row.status === "ARCHIVED");
        if (isArchived) {
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              {/* 1. Primary Restore Action */}
              {canUpdate && (
                <button
                  type="button"
                  onClick={() => handleRestore(row)}
                  disabled={restoreVariant.isPending}
                  title="Restore variant to active catalog"
                  className="flex h-7 items-center gap-1.5 rounded-md border border-[#D0D0D0] bg-white px-2.5 text-[12px] font-semibold text-[#1A1A1A] hover:border-[#E31E24] hover:text-[#E31E24] hover:bg-[#FFF5F5] transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={13} className="text-[#E31E24]" />
                  <span>Restore</span>
                </button>
              )}

              {/* 2. Secondary Actions */}
              <AdminRowActions
                view={{
                  title: "View product",
                  href: `/admin/products/${row.product.id}/edit`,
                }}
                delete={
                  canDelete
                    ? {
                        title: "Delete variant",
                        onClick: () => setDeleting(row),
                      }
                    : undefined
                }
              />
            </div>
          );
        }

        return (
          <AdminRowActions
            view={{
              title: "View product",
              href: `/admin/products/${row.product.id}/edit`,
            }}
            edit={
              canUpdate
                ? {
                    title: "Edit variant",
                    onClick: () => {
                      router.push(`/admin/variants?productId=${row.product.id}&variant=${row.id}`, { scroll: false });
                    },
                  }
                : undefined
            }
            extra={
              canCreate ? (
                <AdminActionButton
                  action={{
                    title: "Duplicate variant",
                    onClick: () => handleDuplicate(row),
                    icon: <Copy size={13} />,
                    disabled: duplicateVariant.isPending,
                  }}
                  defaultIcon={<Copy size={13} />}
                  defaultTitle="Duplicate variant"
                />
              ) : undefined
            }
            delete={
              canDelete
                ? {
                    title: "Delete variant",
                    onClick: () => setDeleting(row),
                  }
                : undefined
            }
          />
        );
      },
    },
  ], [canCreate, canUpdate, canDelete, router, duplicateVariant.isPending, restoreVariant.isPending]);

  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      if (col.key === "actions") return true;
      const k = col.key as ColumnKey;
      if (k in visibleColumns) return visibleColumns[k];
      return true;
    });
  }, [columns, visibleColumns]);

  return (
    <AdminLayout
      title="Variants"
      breadcrumb={[
        { label: "Catalog" },
        { label: "Variants" },
      ]}
    >
      <div className="space-y-5">
        {/* 1. TOP KPI STATS GRID */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Variants",
              value: variantStats.total,
              subtitle: "Configured SKU combinations",
              icon: <Layers size={18} />,
              isLoading: variantCountsLoading,
            },
            {
              title: "Active Variants",
              value: variantStats.active,
              subtitle: "Purchasable & active",
              icon: <CheckCircle2 size={18} />,
              color: "bg-green-600",
              isLoading: variantCountsLoading,
            },
            {
              title: "Inactive Variants",
              value: variantStats.inactive,
              subtitle: "Disabled / hidden",
              icon: <XCircle size={18} />,
              color: "bg-gray-600",
              isLoading: variantCountsLoading,
            },
            {
              title: "Archived Variants",
              value: variantStats.archived,
              subtitle: "Soft-deleted combinations",
              icon: <RotateCcw size={18} />,
              color: "bg-amber-600",
              isLoading: variantCountsLoading,
            },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs">
          {[
            { id: "", label: "All Variants", count: variantStats.total, icon: <Layers size={15} /> },
            { id: "ACTIVE", label: "Active", count: variantStats.active, icon: <CheckCircle2 size={15} /> },
            { id: "INACTIVE", label: "Inactive", count: variantStats.inactive, icon: <XCircle size={15} /> },
            { id: "ARCHIVED", label: "Archived / Deleted", count: variantStats.archived, icon: <RotateCcw size={15} /> },
          ].map((tab) => {
            const isActive = status === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatus(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer",
                  isActive
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A] hover:border-[#D0D0D0]"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "bg-[#F2F2F2] text-[#6B6B6B]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: (val: string) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: status === "ARCHIVED" ? "Search archived variants..." : "Search variants...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [status, sortBy !== "updatedAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
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
              void refetch().then(() => showToast("Variants refreshed."));
            },
            isRefreshing: isFetching || isLoading,
          }}
          onResetFilters={() => {
            setSearch("");
            setStatus("");
            setSortBy("updatedAt");
            setSortDir("desc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AdminSelect
                label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "ARCHIVED", label: "Archived / Deleted" },
                  { value: "DRAFT", label: "Draft" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as VariantSortBy);
                  setPage(1);
                }}
                options={[
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "createdAt", label: "Created Date" },
                  { value: "title", label: "Variant Name" },
                  { value: "sku", label: "SKU" },
                  { value: "status", label: "Status" },
                  { value: "product", label: "Product" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
                  setPage(1);
                }}
                options={[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
                ]}
              />
            </div>
          }
        />

        {/* 4. FULL-WIDTH DATA TABLE WITH BULK ACTIONS */}
        <div>
          <DataTable<VariantRow>
            title="Variants List"
            columns={filteredColumns}
            data={variants}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage={
              status === "ARCHIVED"
                ? "No archived variants found."
                : debouncedSearch
                ? "No variants match your search."
                : "No variants found."
            }
            enableSelection={canUpdate}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onToggleStatus={canUpdate ? handleStatusToggle : undefined}
            statusLoadingId={updateVariant.isPending ? ((updateVariant.variables as any)?.variantId ?? null) : null}
            isStatusDisabled={(row) => !canUpdate || Boolean(row.deletedAt || row.status === "ARCHIVED")}
            totalItems={data?.pagination?.total ?? 0}
            currentPage={page}
            pageSize={limit}
            totalPages={data?.pagination?.totalPages || 1}
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
                actions={
                  status === "ARCHIVED"
                    ? [
                        { value: "restore", label: "Restore selected" },
                        { value: "delete", label: "Permanently delete selected" },
                      ]
                    : [
                        { value: "activate", label: "Mark active" },
                        { value: "deactivate", label: "Mark inactive" },
                        { value: "delete", label: "Delete selected" },
                      ]
                }
                onApply={handleBulkAction}
                applyLoading={bulkSaving}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={data?.pagination?.totalPages || 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>

      <AdminDeleteModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        itemName={deleting ? `${deleting.title} (${deleting.sku || "No SKU"})` : undefined}
        itemType="Variant"
        warningMessage={
          deleting?.deletedAt || deleting?.status === "ARCHIVED" || status === "ARCHIVED"
            ? "Choose the deletion method for this product variant. Soft Delete is recommended to maintain historical orders, invoices, and analytics integrity."
            : "Choose the deletion method for this variant. Soft Delete hides it from active catalog while preserving order & quote history."
        }
        softDeleteDescription={
          deleting?.deletedAt || deleting?.status === "ARCHIVED" || status === "ARCHIVED"
            ? "This variant is already soft-deleted and stored in the central Archive."
            : undefined
        }
        permanentDeleteDescription={
          deleting
            ? `Physically and permanently purges variant "${deleting.title}" from the database. Allowed ONLY if this variant has 0 historical orders, 0 quotation items, 0 customer cart items, 0 active/reserved stock, and 0 stock adjustment audit records.`
            : undefined
        }
        permanentDeleteDisabled={Boolean(deleting && deleting.canPermanentDelete === false)}
        permanentDeleteDisabledReason={deleting?.permanentDeleteBlockReason ?? undefined}
        initialDeleteType={
          deleting?.deletedAt || deleting?.status === "ARCHIVED" || status === "ARCHIVED"
            ? "permanent"
            : "soft"
        }
        onSoftDelete={
          deleting?.deletedAt || deleting?.status === "ARCHIVED" || status === "ARCHIVED"
            ? () => {
                showToast("Variant is already archived.");
                setDeleting(null);
              }
            : handleDelete
        }
        onPermanentDelete={handlePermanentDelete}
        isSoftDeleting={deleteVariant.isPending}
        isPermanentDeleting={permanentDeleteVariant.isPending}
      />

      {/* ─── Bulk Permanent Delete Confirmation Modal ─── */}
      <Modal
        open={showBulkPermanentModal}
        onClose={() => !(bulkSaving || bulkPermanentDeleteVariants.isPending) && setShowBulkPermanentModal(false)}
        title={`Permanently Delete ${selectedIds.length} VARIANT Record${selectedIds.length > 1 ? "s" : ""}`}
        subtitle="Physical database purge with authoritative dependency evaluation."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              disabled={bulkSaving || bulkPermanentDeleteVariants.isPending}
              onClick={() => setShowBulkPermanentModal(false)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkSaving || bulkPermanentDeleteVariants.isPending}
              onClick={handleConfirmBulkPermanentDelete}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Trash2 size={14} />
              {bulkSaving || bulkPermanentDeleteVariants.isPending ? "Evaluating & Deleting..." : "Permanently Delete"}
            </button>
          </div>
        }
      >
        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-900 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-red-800 mb-1">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              Warning: Irreversible Action
            </div>
            You have selected <span className="font-bold">{selectedIds.length}</span> record{selectedIds.length > 1 ? "s" : ""} from the{" "}
            <span className="font-semibold uppercase tracking-wide">VARIANTS</span> archive for permanent deletion.
          </div>

          <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 text-[12.5px] text-[#555] space-y-2">
            <span className="font-semibold text-[#1A1A1A] block">Authoritative Data Integrity Protection:</span>
            <p>
              Every selected record is individually verified by backend safety rules before deletion.
            </p>
            <p>
              Any item associated with historical orders, invoices, shipment tracking, customer carts, or active inventory will be <strong className="text-[#1A1A1A]">strictly protected</strong> and skipped.
            </p>
          </div>
        </div>
      </Modal>

      {/* ─── Bulk Permanent Delete Result Modal ─── */}
      <Modal
        open={Boolean(bulkPermanentResult)}
        onClose={() => setBulkPermanentResult(null)}
        title={
          bulkPermanentResult
            ? bulkPermanentResult.deletedCount === 0
              ? "Permanent Deletion Blocked"
              : bulkPermanentResult.blockedCount === 0
              ? "Permanent Delete Completed"
              : "Permanent Delete Completed (Mixed Result)"
            : "Bulk Permanent Deletion Results"
        }
        subtitle={
          bulkPermanentResult
            ? bulkPermanentResult.deletedCount === 0
              ? `All ${bulkPermanentResult.blockedCount || bulkPermanentResult.totalSelected} selected records are protected by database integrity rules.`
              : bulkPermanentResult.blockedCount === 0
              ? `All ${bulkPermanentResult.totalSelected} selected records were permanently purged from the database.`
              : `${bulkPermanentResult.deletedCount} permanently deleted, ${bulkPermanentResult.blockedCount} protected records preserved.`
            : "Summary of processed and protected records."
        }
        size="lg"
        footer={
          <div className="flex items-center justify-end w-full">
            <button
              type="button"
              onClick={() => setBulkPermanentResult(null)}
              className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-black transition-colors cursor-pointer shadow-2xs"
            >
              Close Summary
            </button>
          </div>
        }
      >
        {bulkPermanentResult && (
          <div className="p-5 space-y-4">
            {/* 3 Metric Cards: Selected, Permanently Deleted, Protected / Skipped */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666] block">
                  Selected
                </span>
                <span className="text-2xl font-bold text-[#1A1A1A]">
                  {bulkPermanentResult.totalSelected ?? (bulkPermanentResult.deletedCount + bulkPermanentResult.blockedCount)}
                </span>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-green-700 block">
                  Permanently Deleted
                </span>
                <span className="text-2xl font-bold text-green-800">
                  {bulkPermanentResult.deletedCount}
                </span>
              </div>
              <div
                className={cn(
                  "rounded-lg border p-3",
                  bulkPermanentResult.deletedCount === 0
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider block",
                    bulkPermanentResult.deletedCount === 0 ? "text-red-700" : "text-amber-700"
                  )}
                >
                  Protected / Skipped
                </span>
                <span
                  className={cn(
                    "text-2xl font-bold",
                    bulkPermanentResult.deletedCount === 0 ? "text-red-800" : "text-amber-800"
                  )}
                >
                  {bulkPermanentResult.blockedCount}
                </span>
              </div>
            </div>

            {/* Status Outcome Banner */}
            {bulkPermanentResult.blockedCount === 0 && bulkPermanentResult.deletedCount > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-[12.5px] text-emerald-900">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>
                  All {bulkPermanentResult.deletedCount} selected records were verified as unreferenced and permanently removed from the database.
                </span>
              </div>
            )}

            {bulkPermanentResult.deletedCount === 0 && bulkPermanentResult.blockedCount > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[12.5px] text-red-900">
                <XCircle size={16} className="shrink-0 text-red-600" />
                <span>
                  No records were deleted. All selected items are protected because they are linked to order history, tax invoices, carts, or active stock.
                </span>
              </div>
            )}

            {bulkPermanentResult.deletedCount > 0 && bulkPermanentResult.blockedCount > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[12.5px] text-amber-900">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <span>
                  Mixed outcome: {bulkPermanentResult.deletedCount} eligible records were permanently purged. {bulkPermanentResult.blockedCount} records with active system dependencies remain safely preserved in the archive.
                </span>
              </div>
            )}

            {/* Protected Records List */}
            {bulkPermanentResult.blocked && bulkPermanentResult.blocked.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#1A1A1A]">
                    Protected Records ({bulkPermanentResult.blocked.length}):
                  </span>
                  <span className="text-[11px] text-[#888]">
                    Untouched in database
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-[#E6E6E6] rounded-lg p-2.5 bg-[#FAFAFA]">
                  {bulkPermanentResult.blocked.map((item: any, index: number) => (
                    <div key={item.id || index} className="text-[12px] bg-white p-3 rounded-lg border border-[#E6E6E6] shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1A1A1A]">{item.name || item.id}</span>
                        <span className="inline-flex shrink-0 items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 border border-amber-200">
                          Protected
                        </span>
                      </div>
                      <div className="text-amber-900 mt-1 flex items-start gap-1">
                        <span className="font-medium shrink-0">Reason:</span>
                        <span>{item.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ─── Non-Archived Bulk Soft Delete Modal ─── */}
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
            await refetch();
            void refetchVariantCounts();
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to complete bulk delete."), "error");
          } finally {
            setBulkSaving(false);
          }
        }}
        isSoftDeleting={bulkSaving && deleteVariant.isPending}
        softDeleteDescription={`Hides the ${selectedIds.length} selected variants from the active catalog while safely retaining order and quote history.`}
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
