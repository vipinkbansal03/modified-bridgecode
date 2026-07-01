"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, Column, ConfirmModal, DataTable, Pagination, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCollectionCountries,
  useAdminCollectionDiscounts,
  useAdminCollections,
  useAdminCountries,
  useAdminProducts,
  useAdminTiers,
  useCreateCollection,
  useCreateCollectionDiscount,
  useDeleteCollection,
  useDeleteCollectionDiscount,
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

export default function CollectionsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminCollections({ page });
  const { data: productsData } = useAdminProducts({ limit: 200 });
  const { data: countries = [] } = useAdminCollectionCountries(selectedCollectionId);
  const { data: allCountries = [] } = useAdminCountries();
  const { data: tiers = [] } = useAdminTiers();
  const { data: collectionDiscounts = [] } = useAdminCollectionDiscounts(selectedCollectionId);
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const updateCountries = useUpdateCollectionCountries(selectedCollectionId);
  const createCollectionDiscount = useCreateCollectionDiscount(selectedCollectionId);
  const deleteCollectionDiscount = useDeleteCollectionDiscount(selectedCollectionId);

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

  const openCreateModal = () => {
    setForm(emptyForm);
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

  const createDiscount = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createCollectionDiscount.mutateAsync({
        ...discountForm,
        tierId: discountForm.type === "TIER" ? discountForm.tierId || null : null,
        minQuantity: discountForm.type === "MOQ" ? discountForm.minQuantity || null : null,
        discountPercent: discountForm.discountPercent || null,
        fixedAmount: discountForm.fixedAmount || null,
        countryId: discountForm.countryId || null,
        startDate: discountForm.startDate || null,
        endDate: discountForm.endDate || null,
      });
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

  const isCreateModalOpen = showForm && !form.id;
  const isEditInlineOpen = showForm && !!form.id;

  const collectionForm = (
    <form onSubmit={submit} className="rounded-lg border border-[#E6E6E6] bg-white p-5">
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
  );

  return (
    <AdminLayout title="Collections" breadcrumb={[{ label: "Collections" }]}>
      <div className="mb-5 flex justify-end">
        <button onClick={openCreateModal} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={14} /> Create Collection
        </button>
      </div>

      {isEditInlineOpen ? <div className="mb-5">{collectionForm}</div> : null}

      <Modal open={isCreateModalOpen} onClose={reset} title="Create Collection" panelClassName="max-w-5xl max-h-[calc(100vh-2.5rem)] overflow-y-auto">
        {isCreateModalOpen ? collectionForm : null}
      </Modal>

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

          <div className="mt-6 border-t border-[#E6E6E6] pt-5">
            <h3 className="mb-3 text-[14px] font-semibold text-[#111]">Discount Rules</h3>
            <form onSubmit={createDiscount} className="grid gap-3 rounded-md bg-[#FAFAFA] p-4 md:grid-cols-4">
              <AdminInput label="Name" value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} />
              <AdminSelect
                label="Type"
                value={discountForm.type}
                onChange={(event) => setDiscountForm({ ...discountForm, type: event.target.value, tierId: "", minQuantity: "" })}
                options={[{ value: "TIER", label: "Tier" }, { value: "MOQ", label: "MOQ" }]}
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
              <AdminSelect
                label="Country"
                value={discountForm.countryId}
                onChange={(event) => setDiscountForm({ ...discountForm, countryId: event.target.value })}
                options={[{ value: "", label: "All countries" }, ...allCountries.map((country: { id: string; code: string; name: string }) => ({ value: country.id, label: `${country.code} - ${country.name}` }))]}
              />
              <AdminInput label="Discount %" type="number" value={discountForm.discountPercent} onChange={(event) => setDiscountForm({ ...discountForm, discountPercent: event.target.value, fixedAmount: "" })} />
              <AdminInput label="Fixed Amount" type="number" value={discountForm.fixedAmount} onChange={(event) => setDiscountForm({ ...discountForm, fixedAmount: event.target.value, discountPercent: "" })} />
              <AdminInput label="Start Date" type="date" value={discountForm.startDate} onChange={(event) => setDiscountForm({ ...discountForm, startDate: event.target.value })} />
              <AdminInput label="End Date" type="date" value={discountForm.endDate} onChange={(event) => setDiscountForm({ ...discountForm, endDate: event.target.value })} />
              <div className="md:col-span-4">
                <button type="submit" disabled={createCollectionDiscount.isPending} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
                  Add Discount
                </button>
              </div>
            </form>
            <div className="mt-4 divide-y divide-[#EFEFEF] rounded-md border border-[#E6E6E6] bg-white">
              {(collectionDiscounts as DiscountRow[]).length === 0 ? (
                <div className="p-4 text-[13px] text-[#9A9A9A]">No discounts assigned to this collection.</div>
              ) : (
                (collectionDiscounts as DiscountRow[]).map((discount) => (
                  <div key={discount.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-[13px]">
                    <div>
                      <div className="font-semibold text-[#111]">{discount.name}</div>
                      <div className="mt-1 text-[#6B6B6B]">
                        {discount.type}
                        {discount.tier ? ` · ${discount.tier.name}` : ""}
                        {discount.minQuantity ? ` · Qty ${discount.minQuantity}+` : ""}
                        {discount.country ? ` · ${discount.country.code}` : " · All countries"}
                        {" · "}
                        {discount.discountPercent ? `${Number(discount.discountPercent)}% off` : `${Number(discount.fixedAmount ?? 0).toFixed(2)} off`}
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

      <DataTable<Collection> columns={columns} data={collections} rowKey="id" isLoading={isLoading} emptyMessage="No collections yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      <ConfirmModal open={!!deleting} title="Delete collection?" message="This removes the collection and its product/country mappings." onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
