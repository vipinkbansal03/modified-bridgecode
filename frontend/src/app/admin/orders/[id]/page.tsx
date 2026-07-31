"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Truck, Package, ExternalLink, RotateCw } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatusBadge, AdminSelect, AdminInput } from "@/components/admin/AdminComponents";
import {
  useAdminOrder,
  useUpdateOrderStatus,
  useShipOrder,
  useDeliverOrder,
  useAdminShippingProviders,
  useOrderShipments,
  useCreateShipment,
  useDeleteShipment,
  useTrackShipment,
  useCancelShipment,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SHIPMENT_STATUS_OPTIONS = [
  { value: "CREATED", label: "Created" },
  { value: "LABEL_GENERATED", label: "Label Generated" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED", label: "Failed" },
  { value: "RETURNED", label: "Returned" },
  { value: "CANCELLED", label: "Cancelled" },
];

const TABS = ["Overview", "Items", "Shipping"] as const;
type Tab = (typeof TABS)[number];

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

interface ShipmentEvent {
  id: string;
  status: string;
  location: string | null;
  description: string | null;
  timestamp: string;
}

interface Shipment {
  id: string;
  status: string;
  trackingNumber: string | null;
  awbNumber: string | null;
  labelUrl: string | null;
  estimatedDelivery: string | null;
  shippingCharge: number | null;
  notes: string | null;
  provider: { name: string; displayName: string } | null;
  events: ShipmentEvent[];
  createdAt: string;
  updatedAt: string;
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
  paymentMethod: string | null;
  paymentProvider: string | null;
  paymentId: string | null;
  shippingProvider: string | null;
  shippingZone: { estimatedDays: string | null; provider?: { name: string; displayName: string } | null; country?: { name: string; code: string } | null } | null;
  shippingBox: { id: string; name: string; length: number; width: number; height: number; maxWeight: number } | null;
  shippingBoxName: string | null;
  packageWeight: string | number | null;
  packageVolume: string | number | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const { data: order, isLoading } = useAdminOrder(id) as { data: OrderDetail | undefined; isLoading: boolean };

  const { mutate: updateStatus, isPending: statusPending } = useUpdateOrderStatus();
  const { mutate: ship, isPending: shipPending } = useShipOrder();
  const { mutate: deliver, isPending: deliverPending } = useDeliverOrder();

  const [newStatus, setNewStatus] = useState("");
  const [shipProvider, setShipProvider] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const { data: shippingProviders = [] } = useAdminShippingProviders();
  const providerOptions = (shippingProviders as { name: string; displayName: string; isEnabled: boolean }[])
    .filter((p) => p.isEnabled)
    .map((p) => ({ value: p.name, label: p.displayName }));

  const { data: shipments = [] } = useOrderShipments(id) as { data: Shipment[] };
  const { mutate: createShipment, isPending: creatingShipment } = useCreateShipment();
  const { mutate: deleteShipment, isPending: deletingShipment } = useDeleteShipment();
  const { mutate: trackShipment, isPending: tracking } = useTrackShipment();
  const { mutate: cancelShipment, isPending: cancelling } = useCancelShipment();

  const [showNewShipment, setShowNewShipment] = useState(false);
  const [newShipmentProvider, setNewShipmentProvider] = useState("");
  const [newShipmentTracking, setNewShipmentTracking] = useState("");
  const [newShipmentAwb, setNewShipmentAwb] = useState("");
  const [newShipmentCharge, setNewShipmentCharge] = useState("");
  const [newShipmentNotes, setNewShipmentNotes] = useState("");
  const [newShipmentCallProvider, setNewShipmentCallProvider] = useState(false);

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

  const sym = order.currency?.symbol ?? "$";

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

  function handleCreateShipment() {
    if (!order) return;
    createShipment(
      {
        orderId: order.id,
        providerId: newShipmentProvider || undefined,
        trackingNumber: newShipmentTracking || undefined,
        awbNumber: newShipmentAwb || undefined,
        shippingCharge: newShipmentCharge ? parseFloat(newShipmentCharge) : undefined,
        notes: newShipmentNotes || undefined,
        callProvider: newShipmentCallProvider,
      },
      {
        onSuccess: () => {
          setShowNewShipment(false);
          setNewShipmentProvider("");
          setNewShipmentTracking("");
          setNewShipmentAwb("");
          setNewShipmentCharge("");
          setNewShipmentNotes("");
          setNewShipmentCallProvider(false);
        },
      }
    );
  }

  function handleDeleteShipment(shipmentId: string) {
    if (!confirm("Delete this shipment?")) return;
    deleteShipment(shipmentId);
  }

  function handleTrackShipment(shipmentId: string) {
    trackShipment(shipmentId, {
      onSuccess: () => {
        alert("Tracking updated — refresh page to see latest events.");
      },
    });
  }

  function handleCancelShipment(shipmentId: string) {
    if (!confirm("Cancel this shipment with the provider?")) return;
    cancelShipment(shipmentId, {
      onSuccess: (result: { success?: boolean; message?: string }) => {
        if (result?.success === false) {
          alert(`Cancel failed: ${result.message ?? "Unknown error"}`);
        } else {
          alert("Shipment cancelled.");
        }
      },
      onError: (error: Error) => {
        alert(`Cancel failed: ${error.message}`);
      },
    });
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

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-[#E6E6E6]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-[#111] text-[#111]"
                : "border-transparent text-[#9A9A9A] hover:text-[#6B6B6B]"
            }`}
          >
            {tab}
            {tab === "Shipping" && shipments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#111] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {shipments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* ── OVERVIEW TAB ────────────────────────────── */}
          {activeTab === "Overview" && (
            <div className="space-y-5">
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

              {/* Quick ship (from order status endpoint) */}
              {order.status !== "SHIPPED" && order.status !== "DELIVERED" && (
                <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#111]"><Truck size={15} /> Mark as Shipped</h3>
                  <AdminSelect label="Provider" options={providerOptions.length ? providerOptions : [{ value: "", label: "No providers enabled" }]} value={shipProvider} onChange={(e) => setShipProvider(e.target.value)} />
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

              {/* Summary */}
              <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
                <div className="border-b border-[#E6E6E6] px-5 py-3.5">
                  <h3 className="text-[14px] font-semibold text-[#111]">Summary</h3>
                </div>
                <div className="px-5 py-4 space-y-1.5 text-[13.5px]">
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
            </div>
          )}

          {/* ── ITEMS TAB ───────────────────────────────── */}
          {activeTab === "Items" && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
              <div className="border-b border-[#E6E6E6] px-5 py-3.5">
                <h3 className="text-[14px] font-semibold text-[#111]">Items ({order.items.length})</h3>
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
            </div>
          )}

          {/* ── SHIPPING TAB ────────────────────────────── */}
          {activeTab === "Shipping" && (
            <div className="space-y-5">
              {/* Create shipment */}
              <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-[#111]">Shipments</h3>
                  {shipments.length > 0 && (
                    <button
                      onClick={() => setShowNewShipment(!showNewShipment)}
                      className="rounded-md bg-[#111] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#222]"
                    >
                      {showNewShipment ? "Cancel" : "Add Shipment"}
                    </button>
                  )}
                </div>

                {shipments.length === 0 && !showNewShipment && (
                  <div className="text-center py-6">
                    <Truck size={32} className="mx-auto mb-3 text-[#9A9A9A]" />
                    <p className="text-[13.5px] text-[#9A9A9A]">No shipments yet for this order.</p>
                    <button
                      onClick={() => setShowNewShipment(true)}
                      className="mt-3 rounded-md bg-[#111] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[#222]"
                    >
                      Create First Shipment
                    </button>
                  </div>
                )}

                {showNewShipment && (
                  <div className="rounded-md border border-[#E6E6E6] bg-[#F8F8F8] p-4 space-y-3">
                    <h4 className="text-[13.5px] font-semibold text-[#111]">New Shipment</h4>
                    <AdminSelect
                      label="Provider"
                      options={providerOptions.length ? providerOptions : [{ value: "", label: "No providers enabled" }]}
                      value={newShipmentProvider}
                      onChange={(e) => setNewShipmentProvider(e.target.value)}
                    />
                    <AdminInput label="Tracking Number" value={newShipmentTracking} onChange={(e) => setNewShipmentTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
                    <AdminInput label="AWB Number" value={newShipmentAwb} onChange={(e) => setNewShipmentAwb(e.target.value)} placeholder="e.g. 1234567890" />
                    <AdminInput
                      label="Shipping Charge"
                      type="text"
                      inputMode="decimal"
                      value={newShipmentCharge}
                      onChange={(e) => setNewShipmentCharge(e.target.value)}
                      placeholder="0.00"
                    />
                    <AdminInput label="Notes" value={newShipmentNotes} onChange={(e) => setNewShipmentNotes(e.target.value)} placeholder="Optional notes" />
                    <label className="flex items-center gap-2 text-[13px] text-[#111]">
                      <input
                        type="checkbox"
                        checked={newShipmentCallProvider}
                        onChange={(e) => setNewShipmentCallProvider(e.target.checked)}
                        className="h-4 w-4 rounded border-[#E6E6E6] text-[#111] focus:ring-[#111]"
                      />
                      Book shipment with provider API (generates AWB &amp; label)
                    </label>
                    <button
                      onClick={handleCreateShipment}
                      disabled={creatingShipment}
                      className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
                    >
                      {creatingShipment ? "Creating…" : "Create Shipment"}
                    </button>
                  </div>
                )}
              </div>

              {/* Shipment cards */}
              {shipments.map((s) => (
                <div key={s.id} className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#E6E6E6] px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Truck size={15} className="text-[#6B6B6B]" />
                      <span className="text-[14px] font-semibold text-[#111]">
                        {s.provider?.displayName ?? "Unknown Provider"}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTrackShipment(s.id)}
                        disabled={tracking}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#111] hover:bg-[#F8F8F8] disabled:opacity-50"
                      >
                        <RotateCw size={12} /> Refresh
                      </button>
                      {s.status !== "CANCELLED" && s.status !== "DELIVERED" && (
                        <button
                          onClick={() => handleCancelShipment(s.id)}
                          disabled={cancelling}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteShipment(s.id)}
                        disabled={deletingShipment}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-2">
                    {s.trackingNumber && <InfoRow label="Tracking #" value={<span className="font-mono">{s.trackingNumber}</span>} />}
                    {s.awbNumber && <InfoRow label="AWB #" value={<span className="font-mono">{s.awbNumber}</span>} />}
                    {s.estimatedDelivery && <InfoRow label="Est. Delivery" value={new Date(s.estimatedDelivery).toLocaleDateString()} />}
                    {s.shippingCharge != null && <InfoRow label="Charge" value={`${sym}${Number(s.shippingCharge).toFixed(2)}`} />}
                    {s.notes && <InfoRow label="Notes" value={s.notes} />}
                    {s.labelUrl && (
                      <InfoRow
                        label="Label"
                        value={
                          <a href={s.labelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                            View Label <ExternalLink size={11} />
                          </a>
                        }
                      />
                    )}
                    <InfoRow label="Created" value={new Date(s.createdAt).toLocaleDateString()} />
                  </div>

                  {/* Events timeline */}
                  {s.events.length > 0 && (
                    <div className="border-t border-[#E6E6E6] px-5 py-4">
                      <h4 className="text-[12.5px] font-semibold text-[#9A9A9A] uppercase tracking-wide mb-3">Tracking Events</h4>
                      <div className="space-y-3">
                        {[...s.events].reverse().map((ev) => (
                          <div key={ev.id} className="flex gap-3 text-[13px]">
                            <div className="flex flex-col items-center">
                              <div className="h-2 w-2 rounded-full bg-[#111]" />
                              <div className="h-full w-px bg-[#E6E6E6]" />
                            </div>
                            <div className="pb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[#111]">{ev.status}</span>
                                {ev.location && <span className="text-[#9A9A9A]">· {ev.location}</span>}
                              </div>
                              {ev.description && <p className="text-[#6B6B6B] mt-0.5">{ev.description}</p>}
                              <span className="text-[12px] text-[#9A9A9A]">{new Date(ev.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
            <InfoRow label="Payment Status" value={<StatusBadge status={order.paymentStatus} />} />
            <InfoRow label="Payment Mode" value={formatPaymentMethod(order.paymentMethod)} />
            {order.paymentProvider && <InfoRow label="Provider" value={order.paymentProvider} />}
            {order.paymentId && <InfoRow label="Payment ID" value={<span className="font-mono text-[12px]">{order.paymentId}</span>} />}
          </div>

          {/* Legacy shipping info */}
          {(order.shippingProvider || order.shippingZone || order.trackingNumber || Number(order.shippingCharge) > 0) && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
              <h3 className="text-[14px] font-semibold text-[#111]">Shipping Info</h3>
              <InfoRow label="Provider" value={order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "—"} />
              {order.shippingZone?.country && <InfoRow label="Zone" value={`${order.shippingZone.country.name} (${order.shippingZone.country.code})`} />}
              {order.shippingZone?.estimatedDays && <InfoRow label="Estimated" value={order.shippingZone.estimatedDays} />}
              <InfoRow label="Charge" value={`${sym}${Number(order.shippingCharge).toFixed(2)}`} />
              {(order.shippingBox || order.shippingBoxName || order.packageWeight != null) && (
                <InfoRow
                  label="Packaging"
                  value={
                    <>
                      {order.shippingBox?.name ?? order.shippingBoxName ?? "Standard box"} ·{" "}
                      {Number(order.packageWeight ?? 0).toFixed(3)} kg ·{" "}
                      {order.shippingBox
                        ? `${order.shippingBox.length}×${order.shippingBox.width}×${order.shippingBox.height} cm`
                        : `${Number(order.packageVolume ?? 0).toFixed(2)} cm³`}
                    </>
                  }
                />
              )}
              {order.trackingNumber && <InfoRow label="Tracking #" value={<span className="font-mono">{order.trackingNumber}</span>} />}
            </div>
          )}
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

function formatPaymentMethod(value?: string | null) {
  if (!value) return "-";
  if (value === "PAY_ON_DELIVERY") return "Pay on Delivery (COD)";
  if (value === "RAZORPAY") return "Razorpay";
  return value;
}
