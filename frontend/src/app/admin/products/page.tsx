"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ConfirmModal, Pagination, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import { Modal } from "@/components/ui/Modal";
import { ProductCreateForm } from "@/components/admin/products/ProductCreateForm";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import {
  useAdminCategories,
  useAdminCountries,
  useAdminProducts,
  useBulkUpdateProducts,
  useDeleteProduct,
  useReorderProducts,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { Eye, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";

interface ProductRow {
  id: string;
  slug?: string;
  title: string;
  productCode?: string | null;
  category: { id: string; name: string };
  status: string;
  sortOrder?: number;
  hasVariants: boolean;
  _count: { variants: number };
  media: { url: string }[];
  createdAt: string;
}

type BulkAction = "enable" | "disable" | "assignCategory" | "assignCountries" | "delete";

export default function AdminProductsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("enable");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkCountryIds, setBulkCountryIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const { showToast, ToastComponent } = useToast();

  const { data, isLoading, refetch } = useAdminProducts({ page, search, status, limit: 20 });
  const { data: categories = [] } = useAdminCategories();
  const { data: countries = [] } = useAdminCountries();
  const deleteMutation = useDeleteProduct();
  const reorderProducts = useReorderProducts();
  const bulkUpdate = useBulkUpdateProducts();

  const products = useMemo(() => ((data?.data ?? []) as ProductRow[]).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [data?.data]);
  const allVisibleSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = products.map((product) => product.id);
      if (visibleIds.every((id) => current.includes(id))) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting);
      setSelectedIds((current) => current.filter((id) => id !== deleting));
      showToast("Product deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete product."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleReorder = async (nextRows: ProductRow[]) => {
    try {
      await reorderProducts.mutateAsync(toSortOrderPayload(nextRows));
      showToast("Products reordered.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder products."), "error");
    }
  };

  const handleBulkAction = async () => {
    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        action: bulkAction,
        categoryId: bulkAction === "assignCategory" ? bulkCategoryId : undefined,
        countryIds: bulkAction === "assignCountries" ? bulkCountryIds : undefined,
      });
      setSelectedIds([]);
      showToast("Bulk action completed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const closeEditModal = () => {
    setEditingProduct(null);
    refetch();
  };

  return (
    <AdminLayout title="Products" breadcrumb={[{ label: "Products" }]}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-[220px] rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={15} /> New Product
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#9A9A9A]">
        <span>{data?.pagination ? `${data.pagination.total} products` : ""}</span>
        <label className="inline-flex items-center gap-2 text-[#555]">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
          Select visible
        </label>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[#E6E6E6] bg-white p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-[#1A1A1A]">{selectedIds.length} selected</span>
            <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction)} className="h-9 rounded-md border border-[#E6E6E6] px-3 text-[13px]">
              <option value="enable">Enable</option>
              <option value="disable">Disable</option>
              <option value="assignCategory">Assign category</option>
              <option value="assignCountries">Enable countries</option>
              <option value="delete">Delete</option>
            </select>
            {bulkAction === "assignCategory" ? (
              <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)} className="h-9 rounded-md border border-[#E6E6E6] px-3 text-[13px]">
                <option value="">Select category</option>
                {categories.map((category: { id: string; name: string }) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            ) : null}
            {bulkAction === "assignCountries" ? (
              <div className="flex flex-wrap gap-2">
                {countries.map((country: { id: string; code: string; name: string }) => (
                  <label key={country.id} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E6E6E6] px-3 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={bulkCountryIds.includes(country.id)}
                      onChange={() =>
                        setBulkCountryIds((current) => (current.includes(country.id) ? current.filter((id) => id !== country.id) : [...current, country.id]))
                      }
                    />
                    {country.code}
                  </label>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleBulkAction}
              disabled={bulkUpdate.isPending}
              className="h-9 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              Apply
            </button>
            <button type="button" onClick={() => setSelectedIds([])} className="h-9 rounded-md border border-[#E6E6E6] px-4 text-[13px] font-semibold text-[#555]">
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 text-[13.5px] text-[#9A9A9A]">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 text-[13.5px] text-[#9A9A9A]">No products found. Create your first product.</div>
      ) : (
        <SortableList
          items={products}
          onReorder={handleReorder}
          disabled={reorderProducts.isPending}
          handleAriaLabel="Drag product to reorder"
          renderItem={(product) => (
            <div className="grid gap-3 md:grid-cols-[minmax(260px,1.7fr)_1fr_110px_90px_130px] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} onClick={(event) => event.stopPropagation()} />
                {product.media[0] ? <img src={product.media[0].url} alt={product.title} className="h-10 w-10 flex-none rounded object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded bg-[#F2F2F2] text-[#9A9A9A]"><Layers size={16} /></div>}
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium text-[#1A1A1A]">{product.title}</div>
                  <div className="truncate text-[11.5px] text-[#9A9A9A]">{product.productCode || product.id}</div>
                </div>
              </div>
              <div className="text-[13px] text-[#555]">{product.category?.name || "Uncategorized"}</div>
              <StatusBadge status={product.status} />
              <div className="text-[13px] text-[#555]">{product._count.variants} variants</div>
              <div className="flex gap-1.5 md:justify-end">
                {product.slug ? (
                  <Link href={`/products/${product.slug}`} target="_blank" className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]">
                    <Eye size={13} />
                  </Link>
                ) : (
                  <span title="Product slug missing" className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded border border-[#E6E6E6] text-[#C4C4C4]">
                    <Eye size={13} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingProduct(product)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                >
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => setDeleting(product.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        />
      )}

      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />

      <ConfirmModal
        open={!!deleting}
        title="Delete product?"
        message="This will soft-delete the product. It will be blocked if active orders reference it."
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteMutation.isPending}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Product"
        panelClassName="max-w-5xl max-h-[calc(100vh-2.5rem)] overflow-y-auto"
      >
        <ProductCreateForm
          compact
          onCancel={() => setCreateOpen(false)}
          onCreated={(productId) => {
            setCreateOpen(false);
            router.push(`/admin/products/${productId}/edit`);
          }}
        />
      </Modal>

      <Modal
        open={!!editingProduct}
        onClose={closeEditModal}
        title={editingProduct ? `Edit Product: ${editingProduct.title}` : "Edit Product"}
        panelClassName="h-[calc(100vh-2.5rem)] w-[min(1440px,calc(100vw-2.5rem))] max-w-[1440px] overflow-hidden p-7"
      >
        {editingProduct ? (
          <div className="h-[calc(100vh-10rem)] overflow-y-auto">
            <ProductEditor productId={editingProduct.id} embedded />
          </div>
        ) : null}
      </Modal>

      {ToastComponent}
    </AdminLayout>
  );
}
