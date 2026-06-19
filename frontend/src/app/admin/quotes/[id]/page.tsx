"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Send, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatusBadge, AdminSelect } from "@/components/admin/AdminComponents";
import { useAdminQuote, useUpdateQuoteStatus } from "@/hooks/admin/useAdminHooks";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "CONVERTED", label: "Converted" },
  { value: "EXPIRED", label: "Expired" },
];

interface QuoteItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuoteDetail {
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
  total: number;
  status: string;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: quote, isLoading } = useAdminQuote(id) as { data: QuoteDetail | undefined; isLoading: boolean };
  const { mutate: updateStatus, isPending } = useUpdateQuoteStatus();
  const [newStatus, setNewStatus] = useState("");

  function handleStatusUpdate() {
    if (!newStatus || !quote) return;
    updateStatus({ id: quote.id, status: newStatus }, {
      onSuccess: () => setNewStatus(""),
    });
  }

  if (isLoading) {
    return (
      <AdminLayout title="Quote Detail" breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: "Loading…" }]}>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-[#F0F0F0]" />
          ))}
        </div>
      </AdminLayout>
    );
  }

  if (!quote) {
    return (
      <AdminLayout title="Quote Detail" breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: "Not found" }]}>
        <p className="text-[#9A9A9A]">Quote not found.</p>
        <Link href="/admin/quotes" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline">
          <ArrowLeft size={14} /> Back to quotes
        </Link>
      </AdminLayout>
    );
  }

  const sym = quote.currency.symbol;

  return (
    <AdminLayout
      title={`Quote ${quote.quoteNumber}`}
      breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: quote.quoteNumber }]}
    >
      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]">
          <ArrowLeft size={14} /> Back
        </button>
        <StatusBadge status={quote.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items table */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
            <div className="border-b border-[#E6E6E6] px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-[#111]">Items</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
                <tr>
                  {["Product", "SKU", "Qty", "Unit Price", "Total"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-[#111]">{item.title}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6B6B6B]">{item.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-[#6B6B6B]">{item.quantity}</td>
                    <td className="px-4 py-3 text-[#6B6B6B]">{sym}{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold text-[#111]">{sym}{Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[#E6E6E6] px-5 py-4 space-y-1.5 text-[13.5px]">
              <div className="flex justify-between text-[#6B6B6B]"><span>Subtotal</span><span>{sym}{Number(quote.subtotal).toFixed(2)}</span></div>
              <div className="flex justify-between text-[#6B6B6B]"><span>Discount</span><span>−{sym}{Number(quote.discount).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-[#111] text-[15px]"><span>Total</span><span>{sym}{Number(quote.total).toFixed(2)}</span></div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4">
              <h3 className="mb-2 text-[14px] font-semibold text-[#111]">Notes</h3>
              <p className="text-[13.5px] text-[#6B6B6B] whitespace-pre-line">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Customer info */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Customer</h3>
            <InfoRow label="Name" value={quote.customerName} />
            <InfoRow label="Email" value={<a href={`mailto:${quote.customerEmail}`} className="text-brand hover:underline">{quote.customerEmail}</a>} />
            {quote.customerPhone && <InfoRow label="Phone" value={quote.customerPhone} />}
            {quote.companyName && <InfoRow label="Company" value={quote.companyName} />}
            <InfoRow label="Country" value={`${quote.country.name} (${quote.country.code})`} />
          </div>

          {/* Meta */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Details</h3>
            <InfoRow label="Quote #" value={<span className="font-mono font-semibold">{quote.quoteNumber}</span>} />
            <InfoRow label="Created" value={new Date(quote.createdAt).toLocaleDateString()} />
            <InfoRow label="Updated" value={new Date(quote.updatedAt).toLocaleDateString()} />
            {quote.expiresAt && <InfoRow label="Expires" value={new Date(quote.expiresAt).toLocaleDateString()} />}
            <InfoRow label="Currency" value={`${quote.currency.code} (${quote.currency.symbol})`} />
          </div>

          {/* Status update */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Update Status</h3>
            <AdminSelect
              label=""
              options={STATUS_OPTIONS}
              value={newStatus || quote.status}
              onChange={(e) => setNewStatus(e.target.value)}
            />
            <button
              onClick={handleStatusUpdate}
              disabled={isPending || !newStatus || newStatus === quote.status}
              className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Update Status"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[13.5px]">
      <span className="text-[#9A9A9A]">{label}</span>
      <span className="text-right font-medium text-[#111]">{value}</span>
    </div>
  );
}
