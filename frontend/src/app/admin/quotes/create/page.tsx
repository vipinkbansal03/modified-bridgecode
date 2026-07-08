"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useAdminCountries, useAdminProduct, useAdminProducts, useCreateQuote } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type QuoteLine = { productId: string; variantId: string; quantity: string; overridePrice: string };

const emptyLine: QuoteLine = { productId: "", variantId: "", quantity: "1", overridePrice: "" };

export default function CreateQuotePage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { data: productsData } = useAdminProducts({ limit: 200 });
  const { data: countries = [] } = useAdminCountries();
  const createQuote = useCreateQuote();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [shippingCharge, setShippingCharge] = useState("0");
  const [lines, setLines] = useState<QuoteLine[]>([{ ...emptyLine }]);

  const products = productsData?.data ?? [];

  const setLine = (index: number, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const items = lines.filter((line) => line.productId.trim());
    if (!items.length) {
      showToast("Add at least one quote item.", "error");
      return;
    }

    try {
      const result = await createQuote.mutateAsync({
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        companyName: companyName || null,
        countryId: countryId || null,
        notes: notes || null,
        discount,
        shippingCharge,
        items: items.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: line.quantity,
          overridePrice: line.overridePrice || null,
        })),
      });

      showToast("Quote created.");
      if (result.data?.id) {
        router.push(`/admin/quotes/${result.data.id}`);
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create quote."), "error");
    }
  };

  return (
    <AdminLayout title="Create Quote" breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: "Create" }]}>
      <button onClick={() => router.back()} className="mb-5 flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]">
        <ArrowLeft size={14} />
        Back
      </button>

      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <h3 className="mb-4 text-[14px] font-semibold text-[#111]">Customer</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AdminInput label="Customer Name *" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <AdminInput label="Customer Email *" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
            <AdminInput label="Phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            <AdminInput label="Company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            <AdminSelect
              label="Country"
              value={countryId}
              onChange={(event) => setCountryId(event.target.value)}
              options={[{ value: "", label: "Use default country" }, ...countries.map((country: { id: string; name: string; code: string }) => ({ value: country.id, label: `${country.name} (${country.code})` }))]}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#111]">Line Items</h3>
            <button
              type="button"
              onClick={() => setLines((current) => [...current, { ...emptyLine }])}
              className="flex items-center gap-1 rounded border border-[#E6E6E6] px-3 py-1.5 text-[13px] hover:bg-[#F2F2F2]"
            >
              <Plus size={13} />
              Add line
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <QuoteLineEditor
                key={index}
                line={line}
                products={products}
                onChange={(patch) => setLine(index, patch)}
                onRemove={() => setLines((current) => current.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput label="Discount" type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            <AdminInput label="Shipping Charge" type="number" min="0" step="0.01" value={shippingCharge} onChange={(event) => setShippingCharge(event.target.value)} />
            <AdminInput label="Internal Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <p className="mt-3 text-[12.5px] text-[#6B6B6B]">
            Pricing is resolved on the server using the selected country, product, variant, customer role, and tier rules.
          </p>

          <button
            type="submit"
            disabled={createQuote.isPending}
            className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
          >
            {createQuote.isPending ? "Creating..." : "Create Quote"}
          </button>
        </div>
      </form>

      {ToastComponent}
    </AdminLayout>
  );
}

function QuoteLineEditor({
  line,
  products,
  onChange,
  onRemove,
}: {
  line: QuoteLine;
  products: { id: string; title: string }[];
  onChange: (patch: Partial<QuoteLine>) => void;
  onRemove: () => void;
}) {
  const { data: productDetail } = useAdminProduct(line.productId);
  const variants = productDetail?.variants ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 rounded border border-[#E6E6E6] p-3 md:grid-cols-[1.4fr_1.4fr_0.6fr_0.8fr_auto]">
      <AdminSelect
        label="Product"
        value={line.productId}
        onChange={(event) => onChange({ productId: event.target.value, variantId: "" })}
        options={[{ value: "", label: "Select product" }, ...products.map((product) => ({ value: product.id, label: product.title }))]}
      />
      <AdminSelect
        label="Variant"
        value={line.variantId}
        onChange={(event) => onChange({ variantId: event.target.value })}
        options={[{ value: "", label: "Product-level price" }, ...variants.map((variant: { id: string; title: string; sku?: string }) => ({ value: variant.id, label: `${variant.title}${variant.sku ? ` (${variant.sku})` : ""}` }))]}
      />
      <AdminInput label="Qty" type="number" min="1" value={line.quantity} onChange={(event) => onChange({ quantity: event.target.value })} />
      <AdminInput label="Override Price" type="number" min="0" step="0.01" value={line.overridePrice} onChange={(event) => onChange({ overridePrice: event.target.value })} placeholder="Server pricing" />
      <button type="button" onClick={onRemove} className="mt-6 flex h-10 w-10 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
