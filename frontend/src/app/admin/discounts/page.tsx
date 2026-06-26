"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, Column, ConfirmModal, DataTable, Pagination, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminCategories,
  useAdminCountries,
  useAdminDiscounts,
  useAdminCollections,
  useAdminProducts,
  useAdminTiers,
  useCreateDiscount,
  useDeleteDiscount,
  useUpdateDiscount,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Related = { id: string; name?: string; title?: string; code?: string; slug?: string };
type Discount = {
  id: string;
  name: string;
  type: "TIER" | "MOQ";
  status: string;
  tierId: string | null;
  tier?: Related | null;
  minQuantity: number | null;
  discountPercent: string | number | null;
  fixedAmount: string | number | null;
  countryId: string | null;
  country?: Related | null;
  productId: string | null;
  product?: Related | null;
  collectionId: string | null;
  collection?: Related | null;
  categoryId: string | null;
  category?: Related | null;
  startDate: string | null;
  endDate: string | null;
};

type FormState = {
  id?: string;
  name: string;
  type: "TIER" | "MOQ";
  status: "ACTIVE" | "INACTIVE";
  tierId: string;
  minQuantity: string;
  valueType: "PERCENT" | "FIXED";
  discountPercent: string;
  fixedAmount: string;
  countryId: string;
  scope: "PLATFORM" | "PRODUCT" | "COLLECTION" | "CATEGORY";
  productId: string;
  collectionId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
};

const blankForm: FormState = {
  name: "",
  type: "TIER",
  status: "ACTIVE",
  tierId: "",
  minQuantity: "",
  valueType: "PERCENT",
  discountPercent: "",
  fixedAmount: "",
  countryId: "",
  scope: "PLATFORM",
  productId: "",
  collectionId: "",
  categoryId: "",
  startDate: "",
  endDate: "",
};

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function discountValue(discount: Discount) {
  return discount.discountPercent != null ? `${Number(discount.discountPercent)}%` : `${Number(discount.fixedAmount ?? 0)} off`;
}

function scopeLabel(discount: Discount) {
  if (discount.product) return `Product: ${discount.product.title}`;
  if (discount.collection) return `Collection: ${discount.collection.name}`;
  if (discount.category) return `Category: ${discount.category.name}`;
  return "Platform-wide";
}

function toForm(discount: Discount): FormState {
  return {
    id: discount.id,
    name: discount.name,
    type: discount.type,
    status: discount.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    tierId: discount.tierId ?? "",
    minQuantity: discount.minQuantity ? String(discount.minQuantity) : "",
    valueType: discount.discountPercent != null ? "PERCENT" : "FIXED",
    discountPercent: discount.discountPercent != null ? String(discount.discountPercent) : "",
    fixedAmount: discount.fixedAmount != null ? String(discount.fixedAmount) : "",
    countryId: discount.countryId ?? "",
    scope: discount.productId ? "PRODUCT" : discount.collectionId ? "COLLECTION" : discount.categoryId ? "CATEGORY" : "PLATFORM",
    productId: discount.productId ?? "",
    collectionId: discount.collectionId ?? "",
    categoryId: discount.categoryId ?? "",
    startDate: dateInput(discount.startDate),
    endDate: dateInput(discount.endDate),
  };
}

export default function DiscountsPage() {
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminDiscounts({ page });
  const { data: tiers = [] } = useAdminTiers();
  const { data: countries = [] } = useAdminCountries();
  const { data: collectionsData } = useAdminCollections({ page: 1 });
  const { data: categories = [] } = useAdminCategories();
  const { data: productsData } = useAdminProducts({ limit: 200 });
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const deleteDiscount = useDeleteDiscount();

  const products: Related[] = productsData?.data ?? [];
  const collections: Related[] = collectionsData?.data ?? [];
  const discounts: Discount[] = data?.data ?? [];

  const options = useMemo(
    () => ({
      tiers: [{ value: "", label: "Select tier" }, ...tiers.map((tier: Related) => ({ value: tier.id, label: tier.name ?? tier.id }))],
      countries: [{ value: "", label: "All countries" }, ...countries.map((country: Related) => ({ value: country.id, label: `${country.name} (${country.code})` }))],
      products: [{ value: "", label: "Select product" }, ...products.map((product) => ({ value: product.id, label: product.title ?? product.id }))],
      collections: [{ value: "", label: "Select collection" }, ...collections.map((collection) => ({ value: collection.id, label: collection.name ?? collection.id }))],
      categories: [{ value: "", label: "Select category" }, ...categories.map((category: Related) => ({ value: category.id, label: category.name ?? category.id }))],
    }),
    [tiers, countries, products, collections, categories]
  );

  const resetForm = () => {
    setForm(blankForm);
    setShowForm(false);
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "type" && value === "TIER") next.minQuantity = "";
      if (key === "type" && value === "MOQ") next.tierId = "";
      if (key === "valueType" && value === "PERCENT") next.fixedAmount = "";
      if (key === "valueType" && value === "FIXED") next.discountPercent = "";
      if (key === "scope" && value === "PLATFORM") {
        next.productId = "";
        next.collectionId = "";
        next.categoryId = "";
      }
      if (key === "scope" && value === "PRODUCT") { next.collectionId = ""; next.categoryId = ""; }
      if (key === "scope" && value === "COLLECTION") { next.productId = ""; next.categoryId = ""; }
      if (key === "scope" && value === "CATEGORY") { next.productId = ""; next.collectionId = ""; }
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      status: form.status,
      tierId: form.type === "TIER" ? form.tierId || null : null,
      minQuantity: form.type === "MOQ" ? form.minQuantity : null,
      discountPercent: form.valueType === "PERCENT" ? form.discountPercent : null,
      fixedAmount: form.valueType === "FIXED" ? form.fixedAmount : null,
      countryId: form.countryId || null,
      productId: form.scope === "PRODUCT" ? form.productId || null : null,
      collectionId: form.scope === "COLLECTION" ? form.collectionId || null : null,
      categoryId: form.scope === "CATEGORY" ? form.categoryId || null : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    try {
      if (form.id) {
        await updateDiscount.mutateAsync({ id: form.id, ...payload });
        showToast("Discount updated.");
      } else {
        await createDiscount.mutateAsync(payload);
        showToast("Discount created.");
      }
      resetForm();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save discount."), "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteDiscount.mutateAsync(deleting);
      showToast("Discount deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete discount."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<Discount>[] = [
    { key: "name", label: "Rule", render: (row) => <div><div className="font-medium">{row.name}</div><div className="text-[12px] text-[#6B6B6B]">{scopeLabel(row)}</div></div> },
    { key: "type", label: "Type", render: (row) => <span className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-medium">{row.type}</span> },
    { key: "value", label: "Discount", render: discountValue },
    { key: "condition", label: "Condition", render: (row) => row.type === "TIER" ? row.tier?.name ?? "Tier" : `${row.minQuantity}+ units` },
    { key: "country", label: "Country", render: (row) => row.country ? `${row.country.name} (${row.country.code})` : "All" },
    { key: "dates", label: "Dates", render: (row) => row.startDate || row.endDate ? `${dateInput(row.startDate) || "Any"} to ${dateInput(row.endDate) || "Any"}` : "Always active" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "",
      width: "86px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(toForm(row)); setShowForm(true); }} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]">
            <Edit2 size={13} />
          </button>
          <button onClick={() => setDeleting(row.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Discounts" breadcrumb={[{ label: "Discounts" }]}>
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Create Discount"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-5 rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput label="Rule Name *" value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Gold launch promo" />
            <AdminSelect label="Discount Type" value={form.type} onChange={(event) => setField("type", event.target.value)} options={[{ value: "TIER", label: "Tier-based" }, { value: "MOQ", label: "MOQ-based" }]} />
            <AdminSelect label="Status" value={form.status} onChange={(event) => setField("status", event.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />

            {form.type === "TIER" ? (
              <AdminSelect label="Tier *" value={form.tierId} onChange={(event) => setField("tierId", event.target.value)} options={options.tiers} />
            ) : (
              <AdminInput label="Minimum Quantity *" type="number" min="1" value={form.minQuantity} onChange={(event) => setField("minQuantity", event.target.value)} />
            )}

            <AdminSelect label="Value Type" value={form.valueType} onChange={(event) => setField("valueType", event.target.value)} options={[{ value: "PERCENT", label: "Percentage" }, { value: "FIXED", label: "Fixed amount off" }]} />
            {form.valueType === "PERCENT" ? (
              <AdminInput label="Discount Percent *" type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={(event) => setField("discountPercent", event.target.value)} />
            ) : (
              <AdminInput label="Fixed Amount *" type="number" min="0" step="0.01" value={form.fixedAmount} onChange={(event) => setField("fixedAmount", event.target.value)} />
            )}

            <AdminSelect label="Country" value={form.countryId} onChange={(event) => setField("countryId", event.target.value)} options={options.countries} />
            <AdminSelect label="Scope" value={form.scope} onChange={(event) => setField("scope", event.target.value)} options={[{ value: "PLATFORM", label: "Platform-wide" }, { value: "PRODUCT", label: "Product" }, { value: "COLLECTION", label: "Collection" }, { value: "CATEGORY", label: "Category" }]} />
            {form.scope === "PRODUCT" && <AdminSelect label="Product *" value={form.productId} onChange={(event) => setField("productId", event.target.value)} options={options.products} />}
            {form.scope === "COLLECTION" && <AdminSelect label="Collection *" value={form.collectionId} onChange={(event) => setField("collectionId", event.target.value)} options={options.collections} />}
            {form.scope === "CATEGORY" && <AdminSelect label="Category *" value={form.categoryId} onChange={(event) => setField("categoryId", event.target.value)} options={options.categories} />}

            <AdminInput label="Start Date" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} />
            <AdminInput label="End Date" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} />
          </div>
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={createDiscount.isPending || updateDiscount.isPending} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
              {form.id ? "Update Discount" : "Create Discount"}
            </button>
            {form.id && <button type="button" onClick={resetForm} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]">Clear Edit</button>}
          </div>
        </form>
      )}

      <DataTable<Discount> columns={columns} data={discounts} rowKey="id" isLoading={isLoading} emptyMessage="No discount rules yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      <ConfirmModal open={!!deleting} title="Delete discount?" message="This rule will stop applying immediately." onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
