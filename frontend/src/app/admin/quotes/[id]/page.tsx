"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { useAdminQuote, useConvertQuoteToOrder, useUpdateQuoteReview, useUpdateQuoteStatus } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "CONVERTED", label: "Converted" },
  { value: "EXPIRED", label: "Expired" },
];

type QuoteItem = { id: string; title: string; sku: string | null; quantity: number; unitPrice: number; total: number };
type QuoteDetail = {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  companyName: string | null;
  country: { name: string; code: string };
  currency: { code: string; symbol: string };
  subtotal: number;
  discount: number;
  shippingCharge: number;
  total: number;
  status: string;
  convertedOrderId?: string | null;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { data: quote, isLoading } = useAdminQuote(id) as { data: QuoteDetail | undefined; isLoading: boolean };
  const { mutate: updateStatus, isPending } = useUpdateQuoteStatus();
  const updateReview = useUpdateQuoteReview();
  const convertQuote = useConvertQuoteToOrder();
  const [newStatus, setNewStatus] = useState("");
  const [items, setItems] = useState<{ id: string; quantity: string; unitPrice: string }[]>([]);
  const [discount, setDiscount] = useState("0");
  const [shippingCharge, setShippingCharge] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!quote) return;
    setItems(quote.items.map((item) => ({ id: item.id, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })));
    setDiscount(String(quote.discount ?? 0));
    setShippingCharge(String(quote.shippingCharge ?? 0));
    setNotes(quote.notes ?? "");
  }, [quote]);

  async function saveReview() {
    if (!quote) return;
    if (quote.status === "CONVERTED" || quote.convertedOrderId) {
      showToast("Converted quotes cannot be edited.", "error");
      return;
    }
    try {
      await updateReview.mutateAsync({ id: quote.id, items, discount, shippingCharge, notes });
      showToast("Quote review updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update quote."), "error");
    }
  }

  async function approveAndConvert() {
    if (!quote) return;
    if (quote.status === "CONVERTED" || quote.convertedOrderId) {
      showToast("Quote already converted.", "error");
      return;
    }
    try {
      await updateReview.mutateAsync({ id: quote.id, items, discount, shippingCharge, notes });
      const result = await convertQuote.mutateAsync(quote.id);
      showToast("Quote approved and converted.");
      if (result.data?.id) router.push(`/admin/orders/${result.data.id}`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to convert quote."), "error");
    }
  }

  if (isLoading) {
    return (
      <AdminLayout title="Quote Detail" breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: "Loading" }]}>
        <div className="animate-pulse space-y-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#F0F0F0]" />)}</div>
      </AdminLayout>
    );
  }

  if (!quote) {
    return (
      <AdminLayout title="Quote Detail" breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: "Not found" }]}>
        <p className="text-[#9A9A9A]">Quote not found.</p>
        <Link href="/admin/quotes" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"><ArrowLeft size={14} /> Back to quotes</Link>
      </AdminLayout>
    );
  }

  const sym = quote.currency?.symbol ?? "$";
  const isConverted = quote.status === "CONVERTED" || Boolean(quote.convertedOrderId);

  return (
    <AdminLayout title={`Quote ${quote.quoteNumber}`} breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: quote.quoteNumber }]}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]"><ArrowLeft size={14} /> Back</button>
        <StatusBadge status={quote.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
            <div className="border-b border-[#E6E6E6] px-5 py-3.5"><h3 className="text-[14px] font-semibold text-[#111]">Review Items</h3></div>
            <div className="custom-scrollbar-x overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
                  <tr>{["Product", "SKU", "Qty", "Unit Price", "Saved Total"].map((h) => <th key={h} className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-[#111]">{item.title}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6B6B6B]">{item.sku ?? "-"}</td>
                      <td className="px-4 py-3"><input className="w-20 rounded border border-[#E6E6E6] px-2 py-1 disabled:bg-[#F8F8F8] disabled:text-[#9A9A9A]" type="number" min="1" disabled={isConverted} value={items.find((i) => i.id === item.id)?.quantity ?? item.quantity} onChange={(event) => setItems((current) => current.map((i) => i.id === item.id ? { ...i, quantity: event.target.value } : i))} /></td>
                      <td className="px-4 py-3"><input className="w-28 rounded border border-[#E6E6E6] px-2 py-1 disabled:bg-[#F8F8F8] disabled:text-[#9A9A9A]" type="number" min="0" step="0.01" disabled={isConverted} value={items.find((i) => i.id === item.id)?.unitPrice ?? item.unitPrice} onChange={(event) => setItems((current) => current.map((i) => i.id === item.id ? { ...i, unitPrice: event.target.value } : i))} /></td>
                      <td className="px-4 py-3 font-semibold text-[#111]">{sym}{Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E6E6E6] px-5 py-4 space-y-3 text-[13.5px]">
              <div className="flex justify-between text-[#6B6B6B]"><span>Saved subtotal</span><span>{sym}{Number(quote.subtotal).toFixed(2)}</span></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AdminInput label="Discount" type="number" min="0" step="0.01" disabled={isConverted} value={discount} onChange={(event) => setDiscount(event.target.value)} />
                <AdminInput label="Shipping Charge" type="number" min="0" step="0.01" disabled={isConverted} value={shippingCharge} onChange={(event) => setShippingCharge(event.target.value)} />
              </div>
              <div className="flex justify-between font-semibold text-[#111] text-[15px]"><span>Saved total</span><span>{sym}{Number(quote.total).toFixed(2)}</span></div>
              <button onClick={saveReview} disabled={isConverted || updateReview.isPending} className="rounded-md bg-[#111] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50">{isConverted ? "Review Locked" : updateReview.isPending ? "Saving..." : "Save Review Changes"}</button>
            </div>
          </div>

          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4">
            <h3 className="mb-2 text-[14px] font-semibold text-[#111]">Notes</h3>
            <textarea value={notes} disabled={isConverted} onChange={(event) => setNotes(event.target.value)} className="min-h-[120px] w-full rounded-md border border-[#E6E6E6] px-3 py-2 text-[13.5px] disabled:bg-[#F8F8F8] disabled:text-[#9A9A9A]" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Customer</h3>
            <InfoRow label="Name" value={quote.customerName} />
            <InfoRow label="Email" value={<a href={`mailto:${quote.customerEmail}`} className="text-brand hover:underline">{quote.customerEmail}</a>} />
            {quote.customerPhone && <InfoRow label="Phone" value={quote.customerPhone} />}
            {quote.companyName && <InfoRow label="Company" value={quote.companyName} />}
            <InfoRow label="Country" value={`${quote.country.name} (${quote.country.code})`} />
          </div>

          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Update Status</h3>
            <AdminSelect label="" options={STATUS_OPTIONS} value={newStatus || quote.status} disabled={isConverted} onChange={(e) => setNewStatus(e.target.value)} />
            {isConverted && <p className="text-[12.5px] text-[#9A9A9A]">This quote has already been converted to an order, so its status is locked.</p>}
            <button onClick={() => updateStatus({ id: quote.id, status: newStatus }, { onSuccess: () => setNewStatus("") })} disabled={isConverted || isPending || !newStatus || newStatus === quote.status} className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50">{isConverted ? "Status Locked" : isPending ? "Saving..." : "Update Status"}</button>
          </div>

          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111]"><CheckCircle size={15} /> Approval</h3>
            <p className="text-[13px] text-[#6B6B6B]">Saves review edits before converting the quote to an order and notifying the customer.</p>
            <button onClick={approveAndConvert} disabled={isConverted || updateReview.isPending || convertQuote.isPending} className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#B5151B] disabled:opacity-50">{isConverted ? "Already Converted" : convertQuote.isPending ? "Converting..." : "Approve & Convert to Order"}</button>
          </div>
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-[13.5px] sm:flex-row sm:justify-between sm:gap-3">
      <span className="text-[#9A9A9A]">{label}</span>
      <span className="break-words text-left font-medium text-[#111] sm:text-right">{value}</span>
    </div>
  );
}
