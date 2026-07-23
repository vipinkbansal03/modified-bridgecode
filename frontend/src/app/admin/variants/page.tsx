"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Copy, Edit2, Eye, Image as ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, Column, ConfirmModal, DataTable, Pagination, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import {
  useAdminVariants,
  useArchiveVariant,
  useDeleteVariant,
  useDuplicateVariant,
  useRestoreVariant,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

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
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<VariantSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleting, setDeleting] = useState<VariantRow | null>(null);
  const { showToast, ToastComponent } = useToast();

  const { data, isLoading } = useAdminVariants({
    page,
    limit: 10,
    search: search || undefined,
    status: status || undefined,
    sortBy,
    sortDir,
  });

  const archiveVariant = useArchiveVariant();
  const restoreVariant = useRestoreVariant();
  const duplicateVariant = useDuplicateVariant();
  const deleteVariant = useDeleteVariant();

  const variants: VariantRow[] = data?.data ?? [];

  const handleDuplicate = async (row: VariantRow) => {
    try {
      await duplicateVariant.mutateAsync({ productId: row.product.id, variantId: row.id });
      showToast("Variant duplicated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate variant."), "error");
    }
  };

  const handleArchiveToggle = async (row: VariantRow) => {
    try {
      if (row.status !== "ACTIVE") {
        await restoreVariant.mutateAsync({ productId: row.product.id, variantId: row.id });
        showToast("Variant restored.");
      } else {
        await archiveVariant.mutateAsync({ productId: row.product.id, variantId: row.id });
        showToast("Variant archived.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update variant status."), "error");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteVariant.mutateAsync({ productId: deleting.product.id, variantId: deleting.id });
      showToast("Variant deleted.");
      setDeleting(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete variant."), "error");
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
              onClick={() => handleArchiveToggle(row)}
              className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
              title={row.status === "ACTIVE" ? "Archive variant" : "Restore variant"}
              disabled={archiveVariant.isPending || restoreVariant.isPending}
            >
              {row.status === "ACTIVE" ? <Archive size={15} /> : <RotateCcw size={15} />}
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

        <div className="flex items-center justify-between">
          <div className="text-[13.5px] text-[#9A9A9A]">{data?.pagination?.total ?? 0} variants</div>
        </div>

        <DataTable<VariantRow> columns={columns} data={variants} rowKey="id" isLoading={isLoading} emptyMessage="No variants found." />

        <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      </div>

      <ConfirmModal
        open={!!deleting}
        title="Delete variant?"
        message={deleting ? `This will soft-delete "${deleting.title}" from the active variant list.` : ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
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
