"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, Column, ConfirmModal, DataTable, Pagination, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminCollectionCountries,
  useAdminCollections,
  useAdminProducts,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
  useUpdateCollectionCountries,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Product = { id: string; title: string };
type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  products: { productId: string; product: Product }[];
  _count?: { products: number };
};
type CountryToggle = { id: string; name: string; code: string; enabled: boolean };

const emptyForm = { id: "", name: "", slug: "", description: "", image: "", status: "ACTIVE", sortOrder: "0", productIds: [] as string[] };

export default function CollectionsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminCollections({ page });
  const { data: productsData } = useAdminProducts({ limit: 200 });
  const { data: countries = [] } = useAdminCollectionCountries(selectedCollectionId);
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const updateCountries = useUpdateCollectionCountries(selectedCollectionId);

  const collections: Collection[] = data?.data ?? [];
  const products: Product[] = productsData?.data ?? [];

  const edit = (collection: Collection) => {
    setForm({
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

  const reset = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const toggleProduct = (productId: string) => {
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || null,
      image: form.image || null,
      status: form.status,
      sortOrder: form.sortOrder,
      productIds: form.productIds,
    };
    try {
      if (form.id) {
        await updateCollection.mutateAsync({ id: form.id, ...payload });
        showToast("Collection updated.");
      } else {
        const result = await createCollection.mutateAsync(payload);
        setSelectedCollectionId(result.data.id);
        showToast("Collection created.");
      }
      reset();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save collection."), "error");
    }
  };

  const saveCountries = async () => {
    try {
      await updateCountries.mutateAsync((countries as CountryToggle[]).map((country) => ({ countryId: country.id, enabled: country.enabled })));
      showToast("Country visibility saved.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save country visibility."), "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCollection.mutateAsync(deleting);
      showToast("Collection deleted.");
      if (selectedCollectionId === deleting) setSelectedCollectionId("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete collection."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<Collection>[] = [
    { key: "name", label: "Collection", render: (row) => <div><div className="font-medium">{row.name}</div><div className="text-[12px] text-[#6B6B6B]">{row.slug}</div></div> },
    { key: "products", label: "Products", render: (row) => row._count?.products ?? row.products?.length ?? 0 },
    { key: "sortOrder", label: "Sort", render: (row) => row.sortOrder },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "",
      width: "116px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedCollectionId(row.id)} className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F2F2F2]">Countries</button>
          <button onClick={() => edit(row)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Edit2 size={13} /></button>
          <button onClick={() => setDeleting(row.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Collections" breadcrumb={[{ label: "Collections" }]}>
      <div className="mb-5 flex justify-end">
        <button onClick={() => (showForm ? reset() : setShowForm(true))} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Create Collection"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-5 rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput label="Name *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <AdminInput label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Auto from name if blank" />
            <AdminSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
            <AdminInput label="Sort Order" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
            <AdminInput label="Image URL" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
            <AdminInput label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>

          <div className="mt-4">
            <div className="mb-2 text-[13px] font-medium text-[#111]">Products</div>
            <div className="grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto rounded-md border border-[#E6E6E6] p-3 md:grid-cols-2">
              {products.map((product) => (
                <label key={product.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
                  {product.title}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
            {form.id ? "Update Collection" : "Create Collection"}
          </button>
        </form>
      )}

      {selectedCollectionId && (
        <div className="mb-5 rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#111]">Country Visibility</h3>
            <button onClick={() => setSelectedCollectionId("")} className="text-[12px] text-[#6B6B6B]">Close</button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {(countries as CountryToggle[]).map((country) => (
              <label key={country.id} className="flex items-center gap-2 rounded border border-[#E6E6E6] px-3 py-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={country.enabled}
                  onChange={(event) => {
                    country.enabled = event.target.checked;
                  }}
                />
                {country.name} ({country.code})
              </label>
            ))}
          </div>
          <button onClick={saveCountries} className="mt-4 rounded-md bg-[#111] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[#222]">Save Visibility</button>
        </div>
      )}

      <DataTable<Collection> columns={columns} data={collections} rowKey="id" isLoading={isLoading} emptyMessage="No collections yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      <ConfirmModal open={!!deleting} title="Delete collection?" message="This removes the collection and its product/country mappings." onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
