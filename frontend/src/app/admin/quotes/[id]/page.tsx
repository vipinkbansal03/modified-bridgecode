"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, FileText, MapPin, MessageSquare, Printer, Send } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import {
  useAddQuoteNote,
  useAdminQuote,
  useConvertQuoteToOrder,
  useUpdateQuoteReview,
  useUpdateQuoteStatus,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

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
type QuoteInternalNote = { id: string; note: string; createdAt: string; user?: { name: string } };

type ShippingAddressJson = {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

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
  shippingAddress: ShippingAddressJson | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
  internalNotes?: QuoteInternalNote[];
};

export default function QuoteDetailPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("quotes.update");

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { data: quote, isLoading } = useAdminQuote(id) as { data: QuoteDetail | undefined; isLoading: boolean };
  const { mutate: updateStatus, isPending } = useUpdateQuoteStatus();
  const updateReview = useUpdateQuoteReview();
  const convertQuote = useConvertQuoteToOrder();
  const addInternalNote = useAddQuoteNote();

  const [newStatus, setNewStatus] = useState("");
  const [items, setItems] = useState<{ id: string; quantity: string; unitPrice: string }[]>([]);
  const [discount, setDiscount] = useState("0");
  const [shippingCharge, setShippingCharge] = useState("0");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [newNoteText, setNewNoteText] = useState("");

  useEffect(() => {
    if (!quote) return;
    setItems(quote.items.map((item) => ({ id: item.id, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })));
    setDiscount(String(quote.discount ?? 0));
    setShippingCharge(String(quote.shippingCharge ?? 0));
    setNotes(quote.notes ?? "");
    setExpiresAt(quote.expiresAt ? new Date(quote.expiresAt).toISOString().split("T")[0] : "");
  }, [quote]);

  async function saveReview() {
    if (!quote) return;
    if (quote.status === "CONVERTED" || quote.convertedOrderId) {
      showToast("Converted quotes cannot be edited.", "error");
      return;
    }
    try {
      await updateReview.mutateAsync({
        id: quote.id,
        items,
        discount,
        shippingCharge,
        notes,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      showToast("Quote review updated successfully.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update quote."), "error");
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !newNoteText.trim()) return;
    try {
      await addInternalNote.mutateAsync({ id: quote.id, note: newNoteText.trim() });
      showToast("Internal note added.");
      setNewNoteText("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to add note."), "error");
    }
  }

  async function approveAndConvert() {
    if (!quote) return;
    if (quote.status === "CONVERTED" || quote.convertedOrderId) {
      showToast("Quote already converted.", "error");
      return;
    }
    try {
      await updateReview.mutateAsync({
        id: quote.id,
        items,
        discount,
        shippingCharge,
        notes,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      const result = await convertQuote.mutateAsync(quote.id);
      showToast("Quote approved and converted.");
      if (result.data?.id) router.push(`/admin/orders/${result.data.id}`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to convert quote."), "error");
    }
  }

  async function handleDownloadPdf() {
    if (!quote) return;
    try {
      const res = await adminApi.get(`/quotes/${quote.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Quote-${quote.quoteNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download PDF."), "error");
    }
  }

  function handlePrint() {
    window.print();
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
        <Link href="/admin/quotes" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline">
          <ArrowLeft size={14} /> Back to quotes
        </Link>
      </AdminLayout>
    );
  }

  const sym = quote.currency?.symbol ?? "$";
  const isConverted = quote.status === "CONVERTED" || Boolean(quote.convertedOrderId);

  return (
    <AdminLayout title={`Quote ${quote.quoteNumber}`} breadcrumb={[{ label: "Quotes", href: "/admin/quotes" }, { label: quote.quoteNumber }]}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#111] hover:bg-[#F5F5F5] transition-all shadow-sm"
          >
            <FileText size={14} className="text-brand" /> Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#111] hover:bg-[#F5F5F5] transition-all shadow-sm"
          >
            <Printer size={14} /> Print
          </button>
          <StatusBadge status={quote.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Review Items Table */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
            <div className="border-b border-[#E6E6E6] px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#111]">Review Items</h3>
              <span className="text-[12.5px] text-[#6B6B6B]">{quote.items.length} line item(s)</span>
            </div>
            <div className="custom-scrollbar-x overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
                  <tr>
                    {["Product", "SKU", "Qty", "Unit Price", "Saved Total"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-[#111]">{item.title}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6B6B6B]">{item.sku ?? "-"}</td>
                      <td className="px-4 py-3">
                        <input
                          className="w-20 rounded border border-[#E6E6E6] px-2 py-1 disabled:bg-[#F8F8F8] disabled:text-[#9A9A9A]"
                          type="text"
                          disabled={isConverted || !canUpdate}
                          value={items.find((i) => i.id === item.id)?.quantity ?? item.quantity}
                          onChange={(event) =>
                            setItems((current) => current.map((i) => (i.id === item.id ? { ...i, quantity: event.target.value.replace(/\D/g, "") } : i)))
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-28 rounded border border-[#E6E6E6] px-2 py-1 disabled:bg-[#F8F8F8] disabled:text-[#9A9A9A]"
                          type="text"
                          disabled={isConverted || !canUpdate}
                          value={items.find((i) => i.id === item.id)?.unitPrice ?? item.unitPrice}
                          onChange={(event) =>
                            setItems((current) => current.map((i) => (i.id === item.id ? { ...i, unitPrice: event.target.value.replace(/[^0-9.]/g, "") } : i)))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#111]">
                        {Number(item.total) > 0
                          ? `${sym}${Number(item.total).toFixed(2)}`
                          : "Price Upon Request"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E6E6E6] px-5 py-4 space-y-3 text-[13.5px]">
              <div className="flex justify-between text-[#6B6B6B]">
                <span>Saved Subtotal</span>
                <span>
                  {Number(quote.subtotal) > 0
                    ? `${sym}${Number(quote.subtotal).toFixed(2)}`
                    : "Price Upon Request"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <AdminInput
                  label="Discount"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={isConverted || !canUpdate}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
                <AdminInput
                  label="Shipping Charge"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={isConverted || !canUpdate}
                  value={shippingCharge}
                  onChange={(event) => setShippingCharge(event.target.value)}
                />
                <AdminInput
                  label="Expiry Date"
                  type="date"
                  disabled={isConverted || !canUpdate}
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
              <div className="flex justify-between font-semibold text-[#111] text-[15px] pt-1">
                <span>Saved Total</span>
                <span>
                  {Number(quote.total) > 0
                    ? `${sym}${Number(quote.total).toFixed(2)}`
                    : "Price Upon Request"}
                </span>
              </div>
              <button
                onClick={saveReview}
                disabled={isConverted || updateReview.isPending || !canUpdate}
                className="rounded-md bg-[#111] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50 transition-all"
              >
                {isConverted ? "Review Locked" : !canUpdate ? "No Edit Permission" : updateReview.isPending ? "Saving..." : "Save Review Changes"}
              </button>
            </div>
          </div>

          {/* Customer Notes */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
            <h3 className="text-[14px] font-semibold text-[#111]">Customer Request Notes</h3>
            <textarea
              value={notes}
              disabled={isConverted || !canUpdate}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-[90px] w-full rounded-md border border-[#E6E6E6] px-3 py-2 text-[13.5px] disabled:bg-[#F8F8F8] disabled:text-[#9A9A9A]"
              placeholder="Notes provided by customer during RFQ submission..."
            />
          </div>

          {/* Internal Notes Log Timeline */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E6E6E6] pb-3">
              <MessageSquare size={16} className="text-[#6B6B6B]" />
              <h3 className="text-[14px] font-semibold text-[#111]">Internal Admin Notes Timeline</h3>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {quote.internalNotes && quote.internalNotes.length > 0 ? (
                quote.internalNotes.map((n) => (
                  <div key={n.id} className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] p-3 text-[13px]">
                    <div className="flex items-center justify-between text-[#6B6B6B] mb-1">
                      <span className="font-semibold text-[#111]">{n.user?.name ?? "Admin"}</span>
                      <span className="text-[11.5px]">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-[#333] whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[#9A9A9A] italic">No internal notes added yet.</p>
              )}
            </div>

            <form onSubmit={handleAddNote} className="flex items-center gap-2 pt-2 border-t border-[#E6E6E6]">
              <input
                type="text"
                placeholder="Type an internal admin note..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="flex-1 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] focus:outline-none focus:border-[#111]"
              />
              <button
                type="submit"
                disabled={addInternalNote.isPending || !newNoteText.trim()}
                className="flex items-center gap-1.5 rounded-md bg-[#111] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222] disabled:opacity-50 transition-all"
              >
                <Send size={13} /> Note
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Info & Actions */}
        <div className="space-y-5">
          {/* Customer Info Card */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Customer Overview</h3>
            <InfoRow label="Name" value={quote.customerName} />
            <InfoRow
              label="Email"
              value={
                <a href={`mailto:${quote.customerEmail}`} className="text-brand hover:underline">
                  {quote.customerEmail}
                </a>
              }
            />
            {quote.customerPhone && <InfoRow label="Phone" value={quote.customerPhone} />}
            {quote.companyName && <InfoRow label="Company" value={quote.companyName} />}
            <InfoRow label="Country" value={`${quote.country.name} (${quote.country.code})`} />
            {quote.expiresAt && (
              <InfoRow
                label="Valid Until"
                value={
                  <span className="flex items-center gap-1 text-amber-700 font-medium">
                    <Clock size={12} /> {new Date(quote.expiresAt).toLocaleDateString()}
                  </span>
                }
              />
            )}
          </div>

          {/* Shipping Address Card */}
          {quote.shippingAddress && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#111]">
                <MapPin size={15} className="text-brand" /> Shipping Address
              </h3>
              <div className="text-[13px] text-[#444] space-y-0.5 pt-1">
                {quote.shippingAddress.street && <p>{quote.shippingAddress.street}</p>}
                {(quote.shippingAddress.city || quote.shippingAddress.state) && (
                  <p>
                    {[quote.shippingAddress.city, quote.shippingAddress.state].filter(Boolean).join(", ")}
                    {quote.shippingAddress.postalCode ? ` - ${quote.shippingAddress.postalCode}` : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status Update Card */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Update Status</h3>
            <AdminSelect
              label=""
              options={STATUS_OPTIONS}
              value={newStatus || quote.status}
              disabled={isConverted || !canUpdate}
              onChange={(e) => setNewStatus(e.target.value)}
            />
            {isConverted && <p className="text-[12.5px] text-[#9A9A9A]">This quote has already been converted to an order, so its status is locked.</p>}
            <button
              onClick={() => {
                if (newStatus === "CONVERTED") {
                  approveAndConvert();
                } else {
                  updateStatus({ id: quote.id, status: newStatus }, { onSuccess: () => setNewStatus("") });
                }
              }}
              disabled={isConverted || isPending || convertQuote.isPending || updateReview.isPending || !newStatus || newStatus === quote.status || !canUpdate}
              className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50 transition-all"
            >
              {isConverted ? "Status Locked" : !canUpdate ? "No Edit Permission" : (isPending || convertQuote.isPending || updateReview.isPending) ? "Saving..." : "Update Status"}
            </button>
          </div>

          {/* Approve & Convert Card */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111]">
              <CheckCircle size={15} /> Approval & Order Conversion
            </h3>
            <p className="text-[13px] text-[#6B6B6B]">
              Locks in review edits, generates an official customer order, and notifies the customer via email.
            </p>
            <button
              onClick={approveAndConvert}
              disabled={isConverted || updateReview.isPending || convertQuote.isPending || !canUpdate}
              className="w-full rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#B5151B] disabled:opacity-60 transition-all shadow-sm"
            >
              {isConverted ? "Already Converted" : !canUpdate ? "No Edit Permission" : convertQuote.isPending ? "Converting..." : "Approve & Convert to Order"}
            </button>
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
