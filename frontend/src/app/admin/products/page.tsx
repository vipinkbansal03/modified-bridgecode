"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, Pagination, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminProducts, useDeleteProduct } from "@/hooks/admin/useAdminHooks";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";

interface ProductRow {
  id: string;
  title: string;
  productCode: string;
  category: { name: string };
  status: string;
  hasVariants: boolean;
  _count: { variants: number };
  media: { url: string }[];
  createdAt: string;
}

export default function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  const { data, isLoading } = useAdminProducts({ page, search, status, limit: 20 });
  const deleteMutation = useDeleteProduct();

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting);
      showToast("Product deleted.");
    } catch {
      showToast("Failed to delete.", "error");
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<ProductRow>[] = [
    {
      key: "title",
      label: "Product",
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.media[0] && <img src={r.media[0].url} alt={r.title} className="h-9 w-9 rounded object-cover flex-none" />}
          <div>
            <div className="font-medium text-[13.5px] text-[#1A1A1A]">{r.title}</div>
            <div className="text-[11.5px] text-[#9A9A9A]">{r.productCode}</div>
          </div>
        </div>
      ),
    },
    { key: "category", label: "Category", render: (r) => r.category?.name },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "variants", label: "Variants", render: (r) => r._count.variants },
    {
      key: "actions",
      label: "",
      width: "120px",
      render: (r) => (
        <div className="flex gap-1.5">
          <Link href={`/products/${r.id}`} target="_blank" className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]">
            <Eye size={13} />
          </Link>
          <Link href={`/admin/products/${r.id}/edit`} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]">
            <Pencil size={13} />
          </Link>
          <button onClick={() => setDeleting(r.id)} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Products" breadcrumb={[{ label: "Products" }]}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              placeholder="Search products…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24] w-[220px]"
            />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none">
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <Link href="/admin/products/create" className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={15} /> New Product
        </Link>
      </div>

      {/* Summary */}
      <div className="mb-3 text-[12.5px] text-[#9A9A9A]">
        {data?.pagination ? `${data.pagination.total} products` : ""}
      </div>

      <DataTable<ProductRow> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No products found. Create your first product." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />

      <ConfirmModal
        open={!!deleting}
        title="Delete product?"
        message="This will soft-delete the product. It won't be visible on the website. You can restore it from the database."
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteMutation.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
