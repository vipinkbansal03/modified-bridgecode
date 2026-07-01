"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Pencil, Plus, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminPricing,
  useAdminProducts,
  useAdminCountries,
  useAdminProduct,
  useCreatePricing,
  useUpdatePricing,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type PriceRow = {
  id: string;
  productId: string;
  variantId?: string | null;
  product: { title: string };
  variant?: { title: string } | null;
  countryId: string;
  country: { name: string; code: string };
  currencyId: string;
  currency: { symbol: string; code: string };
  mrp: number;
  sellingPrice: number;
  dealerPrice?: number | null;
  distributorPrice?: number | null;
  status: string;
};

type PriceFormState = {
  id: string;
  productId: string;
  variantId: string;
  countryId: string;
  mrp: string;
  sellingPrice: string;
  dealerPrice: string;
  distributorPrice: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: PriceFormState = {
  id: "",
  productId: "",
  variantId: "",
  countryId: "",
  mrp: "",
  sellingPrice: "",
  dealerPrice: "",
  distributorPrice: "",
  status: "ACTIVE",
};

export default function PricingPage() {
  const [productId, setProductId] = useState("");
  const [genProductId, setGenProductId] = useState("");
  const [genBasePrice, setGenBasePrice] = useState("");
  const [form, setForm] = useState<PriceFormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const { data: prices = [], isLoading } = useAdminPricing(productId || undefined);
  const { data: productsData } = useAdminProducts({ limit: 100 });
  const { data: countries = [] } = useAdminCountries();
  const { data: selectedProduct } = useAdminProduct(form.productId || genProductId || "");
  const createPricing = useCreatePricing();
  const updatePricing = useUpdatePricing();

  const products = productsData?.data || [];
  const productOptions = [{ value: "", label: "All products" }, ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title }))];
  const formProductOptions = [{ value: "", label: "Select product" }, ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title }))];
  const countryOptions = [
    { value: "", label: "Select country" },
    ...countries.map((country: { id: string; name: string; code: string }) => ({
      value: country.id,
      label: `${country.name} (${country.code})`,
    })),
  ];
  const variantOptions = useMemo(() => {
    const variants = selectedProduct?.variants ?? [];
    return [
      { value: "", label: "Product-level" },
      ...variants.map((variant: { id: string; title: string; sku?: string | null }) => ({
        value: variant.id,
        label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title,
      })),
    ];
  }, [selectedProduct]);

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const handleGenerate = async () => {
    if (!genProductId || !genBasePrice) {
      showToast("Choose a product and base price.", "error");
      return;
    }
    try {
      await adminApi.post("/pricing/generate-country-prices", { productId: genProductId, basePrice: parseFloat(genBasePrice), baseCurrencyId: "usd" });
      showToast("Prices generated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to generate country prices."), "error");
    }
  };

  const startEdit = (row: PriceRow) => {
    setForm({
      id: row.id,
      productId: row.productId,
      variantId: row.variantId ?? "",
      countryId: row.countryId,
      mrp: `${row.mrp}`,
      sellingPrice: `${row.sellingPrice}`,
      dealerPrice: row.dealerPrice != null ? `${row.dealerPrice}` : "",
      distributorPrice: row.distributorPrice != null ? `${row.distributorPrice}` : "",
      status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.productId || !form.countryId || !form.mrp || !form.sellingPrice) {
      showToast("Product, country, MRP, and selling price are required.", "error");
      return;
    }

    const selectedCountry = countries.find((country: { id: string; currencyId: string }) => country.id === form.countryId);
    if (!selectedCountry) {
      showToast("Selected country was not found.", "error");
      return;
    }

    const payload = {
      productId: form.productId,
      variantId: form.variantId || null,
      countryId: form.countryId,
      currencyId: selectedCountry.currencyId,
      mrp: Number(form.mrp),
      sellingPrice: Number(form.sellingPrice),
      dealerPrice: form.dealerPrice ? Number(form.dealerPrice) : null,
      distributorPrice: form.distributorPrice ? Number(form.distributorPrice) : null,
      status: form.status,
    };

    try {
      if (form.id) {
        await updatePricing.mutateAsync({ id: form.id, ...payload });
        showToast("Pricing row updated.");
      } else {
        await createPricing.mutateAsync(payload);
        showToast("Pricing row created.");
      }
      resetForm();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save pricing row."), "error");
    }
  };

  const columns: Column<PriceRow>[] = [
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <div>
          <div className="font-medium text-[13px]">{row.product?.title}</div>
          {row.variant ? <div className="text-[11.5px] text-[#9A9A9A]">{row.variant.title}</div> : <div className="text-[11.5px] text-[#9A9A9A]">Product-level</div>}
        </div>
      ),
    },
    { key: "country", label: "Country", render: (row) => `${row.country.name} (${row.country.code})` },
    { key: "mrp", label: "MRP", render: (row) => `${row.currency.symbol}${row.mrp}` },
    { key: "sellingPrice", label: "Selling", render: (row) => `${row.currency.symbol}${row.sellingPrice}` },
    { key: "dealerPrice", label: "Dealer", render: (row) => (row.dealerPrice != null ? `${row.currency.symbol}${row.dealerPrice}` : "—") },
    { key: "distributorPrice", label: "Doctor / Retailer", render: (row) => (row.distributorPrice != null ? `${row.currency.symbol}${row.distributorPrice}` : "—") },
    { key: "currency", label: "Currency", render: (row) => row.currency.code },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "id",
      label: "",
      render: (row) => (
        <button
          type="button"
          onClick={() => startEdit(row)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F5F5F5]"
        >
          <Pencil size={14} />
        </button>
      ),
    },
  ];

  return (
    <AdminLayout title="Pricing" breadcrumb={[{ label: "Pricing" }]}>
      <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Auto-Generate Country Prices</h3>
            <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Creates or refreshes product-level country pricing. Variant-level overrides remain untouched.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <AdminSelect label="Product" options={formProductOptions} value={genProductId} onChange={(e) => setGenProductId(e.target.value)} />
          </div>
          <div className="w-44">
            <AdminInput label="Base Price (USD)" type="number" min="0" step="0.01" value={genBasePrice} onChange={(e) => setGenBasePrice(e.target.value)} />
          </div>
          <button onClick={handleGenerate} className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#333]">
            <RefreshCw size={14} /> Generate
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="w-[280px]">
          <AdminSelect label="Filter by product" options={productOptions} value={productId} onChange={(e) => setProductId(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
        >
          <Plus size={14} /> New Pricing Row
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{form.id ? "Edit pricing row" : "Create pricing row"}</h3>
              <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Use `Doctor / Retailer` to maintain the existing resolver mapping to the shared `distributorPrice` field.</p>
            </div>
            <button type="button" onClick={resetForm} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminSelect
              label="Product *"
              options={formProductOptions}
              value={form.productId}
              onChange={(e) => setForm((current) => ({ ...current, productId: e.target.value, variantId: "" }))}
            />
            <AdminSelect
              label="Variant"
              options={variantOptions}
              value={form.variantId}
              onChange={(e) => setForm((current) => ({ ...current, variantId: e.target.value }))}
            />
            <AdminSelect
              label="Country *"
              options={countryOptions}
              value={form.countryId}
              onChange={(e) => setForm((current) => ({ ...current, countryId: e.target.value }))}
            />
            <AdminSelect
              label="Status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
              value={form.status}
              onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
            />
            <AdminInput label="MRP *" type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => setForm((current) => ({ ...current, mrp: e.target.value }))} />
            <AdminInput label="Selling Price *" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => setForm((current) => ({ ...current, sellingPrice: e.target.value }))} />
            <AdminInput label="Dealer Price" type="number" min="0" step="0.01" value={form.dealerPrice} onChange={(e) => setForm((current) => ({ ...current, dealerPrice: e.target.value }))} />
            <AdminInput
              label="Doctor / Retailer Price"
              type="number"
              min="0"
              step="0.01"
              value={form.distributorPrice}
              onChange={(e) => setForm((current) => ({ ...current, distributorPrice: e.target.value }))}
            />
          </div>

          <button type="submit" className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
            {form.id ? "Update Pricing" : "Create Pricing"}
          </button>
        </form>
      ) : null}

      <DataTable<PriceRow> columns={columns} data={prices} rowKey="id" isLoading={isLoading} emptyMessage="No pricing records." />
      {ToastComponent}
    </AdminLayout>
  );
}
