"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Truck, Package } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatusBadge, AdminSelect, AdminInput } from "@/components/admin/AdminComponents";
import { useAdminOrder, useUpdateOrderStatus, useShipOrder, useDeliverOrder } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

interface OrderItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  product: { title: string };
  variant: { title: string } | null;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  companyName: string | null;
  shippingAddress: Record<string, string>;
  country: { name: string; code: string };
  currency: { code: string; symbol: string };
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponDiscount: number | null;
  shippingCharge: number;
  taxAmount: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentId: string | null;
  shippingProvider: string | null;
  shippingZone: { estimatedDays: string | null; provider?: { displayName: string } | null; country?: { name: string; code: string } | null } | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: order, isLoading } = useAdminOrder(id) as { data: OrderDetail | undefined; isLoading: boolean };

  const { mutate: updateStatus, isPending: statusPending } = useUpdateOrderStatus();
  const { mutate: ship, isPending: shipPending } = useShipOrder();
  const { mutate: deliver, isPending: deliverPending } = useDeliverOrder();

  const [newStatus, setNewStatus] = useState("");
  const [shipProvider, setShipProvider] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  if (isLoading) {
    return (
      <AdminLayout title="Order Detail" breadcrumb={[{ label: "Orders", href: "/admin/orders" }, { label: "Loading…" }]}>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#F0F0F0]" />)}
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout title="Order Detail" breadcrumb={[{ label: "Orders", href: "/admin/orders" }, { label: "Not found" }]}>
        <p className="text-[#9A9A9A]">Order not found.</p>
        <Link href="/admin/orders" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline">
          <ArrowLeft size={14} /> Back to orders
        </Link>
      </AdminLayout>
    );
  }

  const sym = order.currency.symbol;

  async function handleDownloadInvoice() {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      const res = await adminApi.get(`/orders/${order.id}/invoice`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(getAdminErrorMessage(error, "Invoice generation failed"));
    } finally {
      setIsDownloadingInvoice(false);
    }
  }

  return (
    <AdminLayout
      title={`Order ${order.orderNumber}`}
      breadcrumb={[{ label: "Orders", href: "/admin/orders" }, { label: order.orderNumber }]}
    >
      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111] hover:bg-[#F8F8F8] disabled:opacity-50"
          >
            <Download size={14} />
            {isDownloadingInvoice ? "Downloading..." : "Download Invoice"}
          </button>
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left — items + shipping */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
            <div className="border-b border-[#E6E6E6] px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-[#111]">Items</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
                <tr>
                  {["Product", "Variant", "SKU", "Qty", "Unit Price", "Total"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-[#111]">{item.product.title}</td>
                    <td className="px-4 py-3 text-[#6B6B6B]">{item.variant?.title ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6B6B6B]">{item.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-[#6B6B6B]">{item.quantity}</td>
                    <td className="px-4 py-3 text-[#6B6B6B]">{sym}{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold text-[#111]">{sym}{Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[#E6E6E6] px-5 py-4 space-y-1.5 text-[13.5px]">
              <div className="flex justify-between text-[#6B6B6B]"><span>Subtotal</span><span>{sym}{Number(order.subtotal).toFixed(2)}</span></div>
              {Number(order.discount ?? 0) > 0 && !order.couponCode && (
                <div className="flex justify-between text-[#6B6B6B]"><span>Discount</span><span>−{sym}{Number(order.discount).toFixed(2)}</span></div>
              )}
              {order.couponCode && Number(order.couponDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-[#2A6A40]"><span>Coupon ({order.couponCode})</span><span>−{sym}{Number(order.couponDiscount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-[#6B6B6B]"><span>Tax</span><span>{sym}{Number(order.taxAmount ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-[#6B6B6B]"><span>Shipping</span><span>{sym}{Number(order.shippingCharge).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-[#111] text-[15px]"><span>Total</span><span>{sym}{Number(order.total).toFixed(2)}</span></div>
            </div>
          </div>

          {/* Ship order */}
          {order.status !== "SHIPPED" && order.status !== "DELIVERED" && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111]"><Truck size={15} /> Mark as Shipped</h3>
              <AdminInput label="Shipping Provider" value={shipProvider} onChange={(e) => setShipProvider(e.target.value)} placeholder="e.g. DHL" />
              <AdminInput label="Tracking Number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="1Z999AA10123456784" />
              <button
                onClick={() => ship({ id: order.id, shippingProvider: shipProvider, trackingNumber })}
                disabled={shipPending || !shipProvider || !trackingNumber}
                className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
              >
                {shipPending ? "Saving…" : "Mark Shipped"}
              </button>
            </div>
          )}

          {order.status === "SHIPPED" && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111]"><Package size={15} /> Mark as Delivered</h3>
              <p className="text-[13px] text-[#6B6B6B]">This will set the order to DELIVERED and decrement inventory for all variant items.</p>
              <button
                onClick={() => deliver(order.id)}
                disabled={deliverPending}
                className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
              >
                {deliverPending ? "Saving…" : "Mark Delivered"}
              </button>
            </div>
          )}

          {/* Shipping info */}
          {(order.shippingProvider || order.shippingZone || order.trackingNumber) && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
              <h3 className="text-[14px] font-semibold text-[#111]">Shipping</h3>
              <InfoRow label="Provider" value={order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "—"} />
              {order.shippingZone?.country && <InfoRow label="Zone" value={`${order.shippingZone.country.name} (${order.shippingZone.country.code})`} />}
              {order.shippingZone?.estimatedDays && <InfoRow label="Estimated" value={order.shippingZone.estimatedDays} />}
              {order.trackingNumber && <InfoRow label="Tracking #" value={<span className="font-mono">{order.trackingNumber}</span>} />}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Customer</h3>
            <InfoRow label="Name" value={order.customerName} />
            <InfoRow label="Email" value={<a href={`mailto:${order.customerEmail}`} className="text-brand hover:underline">{order.customerEmail}</a>} />
            {order.customerPhone && <InfoRow label="Phone" value={order.customerPhone} />}
            {order.companyName && <InfoRow label="Company" value={order.companyName} />}
          </div>

          {/* Shipping address */}
          {order.shippingAddress && Object.keys(order.shippingAddress).length > 0 && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
              <h3 className="text-[14px] font-semibold text-[#111]">Shipping Address</h3>
              {Object.entries(order.shippingAddress).map(([k, v]) => (
                <InfoRow key={k} label={k} value={v} />
              ))}
            </div>
          )}

          {/* Order details */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Order Details</h3>
            <InfoRow label="Order #" value={<span className="font-mono font-semibold">{order.orderNumber}</span>} />
            <InfoRow label="Created" value={new Date(order.createdAt).toLocaleDateString()} />
            <InfoRow label="Payment" value={<StatusBadge status={order.paymentStatus} />} />
            {order.paymentProvider && <InfoRow label="Provider" value={order.paymentProvider} />}
            {order.paymentId && <InfoRow label="Payment ID" value={<span className="font-mono text-[12px]">{order.paymentId}</span>} />}
          </div>

          {/* Status update */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Update Status</h3>
            <AdminSelect
              label=""
              options={ORDER_STATUS_OPTIONS}
              value={newStatus || order.status}
              onChange={(e) => setNewStatus(e.target.value)}
            />
            <button
              onClick={() => updateStatus({ id: order.id, status: newStatus }, { onSuccess: () => setNewStatus("") })}
              disabled={statusPending || !newStatus || newStatus === order.status}
              className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
            >
              {statusPending ? "Saving…" : "Update Status"}
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
