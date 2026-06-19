"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useAdminPricing, useAdminProducts, useAdminCurrencies } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { RefreshCw } from "lucide-react";
interface PriceRow { id: string; product: { title: string }; variant?: { title: string }; country: { name: string; code: string }; currency: { symbol: string; code: string }; mrp: number; sellingPrice: number; status: string }
export default function PricingPage() {
  const [productId, setProductId] = useState("");
  const [genProductId, setGenProductId] = useState("");
  const [genBasePrice, setGenBasePrice] = useState("");
  const { showToast, ToastComponent } = useToast();
  const { data: prices = [], isLoading } = useAdminPricing(productId || undefined);
  const { data: productsData } = useAdminProducts({ limit: 100 });
  const products = productsData?.data || [];
  const productOptions = [{ value: "", label: "All products" }, ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title }))];
  const handleGenerate = async () => {
    if (!genProductId || !genBasePrice) return;
    try { await adminApi.post("/pricing/generate-country-prices", { productId: genProductId, basePrice: parseFloat(genBasePrice), baseCurrencyId: "usd" }); showToast("Prices generated."); }
    catch { showToast("Failed.", "error"); }
  };
  const columns: Column<PriceRow>[] = [
    { key: "product", label: "Product", render: (r) => <div><div className="font-medium text-[13px]">{r.product?.title}</div>{r.variant && <div className="text-[11.5px] text-[#9A9A9A]">{r.variant.title}</div>}</div> },
    { key: "country", label: "Country", render: (r) => `${r.country.name} (${r.country.code})` },
    { key: "mrp", label: "MRP", render: (r) => `${r.currency.symbol}${r.mrp}` },
    { key: "sellingPrice", label: "Selling Price", render: (r) => `${r.currency.symbol}${r.sellingPrice}` },
    { key: "currency", label: "Currency", render: (r) => r.currency.code },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <AdminLayout title="Pricing" breadcrumb={[{ label: "Pricing" }]}>
      <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5">
        <h3 className="text-[13.5px] font-semibold text-[#1A1A1A] mb-3">Auto-Generate Country Prices</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]"><AdminSelect label="Product" options={productOptions} value={genProductId} onChange={(e) => setGenProductId(e.target.value)} /></div>
          <div className="w-40"><AdminInput label="Base Price (USD)" type="number" min="0" step="0.01" value={genBasePrice} onChange={(e) => setGenBasePrice(e.target.value)} /></div>
          <button onClick={handleGenerate} className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#333]"><RefreshCw size={14} /> Generate</button>
        </div>
      </div>
      <div className="mb-4 w-[260px]"><AdminSelect label="Filter by product" options={productOptions} value={productId} onChange={(e) => setProductId(e.target.value)} /></div>
      <DataTable<PriceRow> columns={columns} data={prices} rowKey="id" isLoading={isLoading} emptyMessage="No pricing records." />
      {ToastComponent}
    </AdminLayout>
  );
}
