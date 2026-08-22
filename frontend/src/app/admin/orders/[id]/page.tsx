"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Truck, Package, ExternalLink, RotateCw, Eye, Pencil } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatusBadge, AdminSelect, AdminInput, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminOrder,
  useUpdateOrderStatus,
  useUpdatePaymentStatus,
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

const PAYMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const TABS = ["Overview", "Items", "Shipping", "Payments"] as const;
type Tab = (typeof TABS)[number];

interface PaymentTransactionDetail {
  id: string;
  attemptNumber: number;
  paymentMethod: string;
  provider: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  status: string;
  amount: number;
  currency: string;
  errorMessage: string | null;
  errorCode: string | null;
  createdAt: string;
}

interface OrderItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  product: { title: string };
  variant: { title: string } | null;
  warehouse: { name: string } | null;
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
  shippingZone: { estimatedDays: string | null; provider?: { name: string; displayName: string } | null; countries?: { country: { name: string; code: string } }[] } | null;
  shippingBox: { id: string; name: string; length: number; width: number; height: number; maxWeight: number } | null;
  shippingBoxName: string | null;
  packageWeight: string | number | null;
  packageVolume: string | number | null;
  trackingNumber: string | null;
  notes: string | null;
  taxIdSnapshot?: string | null;
  taxIdTypeSnapshot?: string | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  paymentTransactions?: PaymentTransactionDetail[];
}

export default function OrderDetailPage() {
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("mode") === "edit";

  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const { data: order, isLoading } = useAdminOrder(id) as { data: OrderDetail | undefined; isLoading: boolean };

  const { mutate: updateStatus, isPending: statusPending } = useUpdateOrderStatus();
  const { mutate: updatePaymentStatus, isPending: paymentStatusPending } = useUpdatePaymentStatus();
  const { mutate: ship, isPending: shipPending } = useShipOrder();
  const { mutate: deliver, isPending: deliverPending } = useDeliverOrder();

  const [newStatus, setNewStatus] = useState("");
  const [newPaymentStatus, setNewPaymentStatus] = useState("");
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
      const invNumber = order.orderNumber ? order.orderNumber : order.id.slice(-8);
      link.download = `Invoice-INV-${invNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Invoice generation failed"), "error");
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
        showToast("Tracking updated — refresh page to see latest events.", "info");
      },
    });
  }

  function handleCancelShipment(shipmentId: string) {
    if (!confirm("Cancel this shipment with the provider?")) return;
    cancelShipment(shipmentId, {
      onSuccess: (result: { success?: boolean; message?: string }) => {
        if (result?.success === false) {
          showToast(`Cancel failed: ${result.message ?? "Unknown error"}`, "error");
        } else {
          showToast("Shipment cancelled.", "success");
        }
      },
      onError: (error: Error) => {
        showToast(`Cancel failed: ${error.message}`, "error");
      },
    });
  }

  return (
    <AdminLayout
      title={`Order ${order.orderNumber} ${isEdit ? "(Edit Mode)" : "(View Only)"}`}
      breadcrumb={[
        { label: "Orders", href: "/admin/orders" },
        { label: order.orderNumber, href: `/admin/orders/${order.id}` },
        ...(isEdit ? [{ label: "Edit" }] : []),
      ]}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]">
          <ArrowLeft size={14} /> Back to orders
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111] hover:bg-[#F8F8F8] disabled:opacity-50"
          >
            <Download size={14} />
            {isDownloadingInvoice ? "Downloading..." : "Download Invoice"}
          </button>
          {isEdit ? (
            <Link
              href={`/admin/orders/${order.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111] hover:bg-[#F8F8F8]"
            >
              <Eye size={14} />
              View Details
            </Link>
          ) : (
            <Link
              href={`/admin/orders/${order.id}?mode=edit`}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#222]"
            >
              <Pencil size={14} />
              Edit Order
            </Link>
          )}
          <div className="inline-flex items-center gap-1.5 rounded border border-[#E6E6E6] bg-[#F8F8F8] px-2.5 py-1 text-[12px] font-semibold text-[#6B6B6B]">
            <span>Order Status:</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded border border-[#E6E6E6] bg-[#F8F8F8] px-2.5 py-1 text-[12px] font-semibold text-[#6B6B6B]">
            <span>Payment Status:</span>
            <StatusBadge status={order.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-[#E6E6E6] overflow-x-auto whitespace-nowrap pb-px">
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
          {activeTab === "Overview" && (
            <div className="space-y-5">
              {isEdit && (
                <>
                  <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
                    <h3 className="text-[14px] font-semibold text-[#111]">Order Status</h3>
                    <AdminSelect
                      label="Select Order Status"
                      options={ORDER_STATUS_OPTIONS}
                      value={newStatus || order.status}
                      onChange={(e) => setNewStatus(e.target.value)}
                    />
                    <button
                      onClick={() => updateStatus({ id: order.id, status: newStatus }, { onSuccess: () => setNewStatus("") })}
                      disabled={statusPending || !newStatus || newStatus === order.status}
                      className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
                    >
                      {statusPending ? "Saving…" : "Update Order Status"}
                    </button>
                  </div>
                  <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
                    <h3 className="text-[14px] font-semibold text-[#111]">Payment Status</h3>
                    <AdminSelect
                      label="Select Payment Status"
                      options={PAYMENT_STATUS_OPTIONS}
                      value={newPaymentStatus || order.paymentStatus}
                      onChange={(e) => setNewPaymentStatus(e.target.value)}
                    />
                    <button
                      onClick={() => updatePaymentStatus({ id: order.id, paymentStatus: newPaymentStatus }, { onSuccess: () => setNewPaymentStatus("") })}
                      disabled={paymentStatusPending || !newPaymentStatus || newPaymentStatus === order.paymentStatus}
                      className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
                    >
                      {paymentStatusPending ? "Saving…" : "Update Payment Status"}
                    </button>
                  </div>
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
                      <p className="text-[13px] text-[#6B6B6B]">This will set the order to DELIVERED.</p>
                      <button
                        onClick={() => deliver(order.id)}
                        disabled={deliverPending}
                        className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#222] disabled:opacity-50"
                      >
                        {deliverPending ? "Saving…" : "Mark Delivered"}
                      </button>
                    </div>
                  )}
                </>
              )}
              {!isEdit && (
                <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
                  <h3 className="text-[14px] font-semibold text-[#111]">Order Information</h3>
                  <InfoRow label="Order Number" value={<span className="font-mono font-semibold">{order.orderNumber}</span>} />
                  <InfoRow label="Date Placed" value={new Date(order.createdAt).toLocaleString()} />
                  <InfoRow label="Order Status" value={<StatusBadge status={order.status} />} />
                  <InfoRow label="Payment Status" value={<StatusBadge status={order.paymentStatus} />} />
                  <InfoRow label="Payment Method" value={formatPaymentMethod(order.paymentMethod)} />
                  {order.paymentProvider && <InfoRow label="Payment Provider" value={order.paymentProvider} />}
                  {order.paymentId && <InfoRow label="Payment ID" value={<span className="font-mono text-[12px] break-all">{order.paymentId}</span>} />}
                </div>
              )}
              <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
                <div className="border-b border-[#E6E6E6] px-5 py-3.5">
                  <h3 className="text-[14px] font-semibold text-[#111]">Pricing &amp; Summary</h3>
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
          {activeTab === "Items" && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
              <div className="border-b border-[#E6E6E6] px-5 py-3.5">
                <h3 className="text-[14px] font-semibold text-[#111]">Items ({order.items.length})</h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
                    <tr>
                      {["Product", "Variant", "SKU", "Qty", "Warehouse", "Unit Price", "Total"].map((h) => (
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
                        <td className="px-4 py-3 text-[#6B6B6B]">
                          {item.warehouse?.name ? (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                              {item.warehouse.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                              Default Seller
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#6B6B6B]">{sym}{Number(item.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-[#111]">{sym}{Number(item.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === "Shipping" && (
            <div className="space-y-5">
              {isEdit && (
                <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <h3 className="text-[14px] font-semibold text-[#111]">Shipments</h3>
                    <button
                      onClick={() => setShowNewShipment(!showNewShipment)}
                      className="rounded-md bg-[#111] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#222]"
                    >
                      {showNewShipment ? "Cancel" : "Add Shipment"}
                    </button>
                  </div>
                  {showNewShipment && (
                    <div className="rounded-md border border-[#E6E6E6] bg-[#F8F8F8] p-4 space-y-3">
                      <h4 className="text-[13.5px] font-semibold text-[#111]">New Shipment</h4>
                      <AdminSelect label="Provider" options={providerOptions.length ? providerOptions : [{ value: "", label: "No providers enabled" }]} value={newShipmentProvider} onChange={(e) => setNewShipmentProvider(e.target.value)} />
                      <AdminInput label="Tracking Number" value={newShipmentTracking} onChange={(e) => setNewShipmentTracking(e.target.value)} />
                      <button onClick={handleCreateShipment} disabled={creatingShipment} className="w-full rounded-md bg-[#111] px-4 py-2.5 text-[13.5px] font-medium text-white">Create</button>
                    </div>
                  )}
                </div>
              )}
              {shipments.map((s) => (
                <div key={s.id} className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
                  <div className="flex justify-between border-b border-[#E6E6E6] px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Truck size={15} />
                      <span className="text-[14px] font-semibold">{s.provider?.displayName ?? "Shipping"}</span>
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-2">
                    {s.trackingNumber && <InfoRow label="Tracking #" value={s.trackingNumber} />}
                    {s.labelUrl && <a href={s.labelUrl} target="_blank" className="text-brand text-[13px] hover:underline">View Label</a>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Payments" && (
            <div className="space-y-4">
              {order.paymentTransactions && order.paymentTransactions.length > 0 ? (
                <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
                  <div className="border-b border-[#E6E6E6] px-5 py-3.5 flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-[#111]">
                      Payment Attempt History ({order.paymentTransactions.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead className="border-b border-[#E6E6E6] bg-[#FAFAFA] text-[11.5px] uppercase font-semibold text-[#777]">
                        <tr>
                          <th className="px-4 py-3">Attempt</th>
                          <th className="px-4 py-3">Provider</th>
                          <th className="px-4 py-3">Gateway Order ID</th>
                          <th className="px-4 py-3">Gateway Payment ID</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Error / Reason</th>
                          <th className="px-4 py-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6E6E6]">
                        {order.paymentTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-[#F9F9F9]">
                            <td className="px-4 py-3 font-semibold text-[#111]">
                              #{tx.attemptNumber}
                            </td>
                            <td className="px-4 py-3 font-medium text-[#444]">
                              {tx.provider || tx.paymentMethod}
                            </td>
                            <td className="px-4 py-3 font-mono text-[12px] text-[#333]">
                              {tx.gatewayOrderId || "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[12px] text-brand">
                              {tx.gatewayPaymentId || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={tx.status} />
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#111]">
                              {tx.currency} {Number(tx.amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[#888] max-w-[200px] truncate">
                              {tx.errorMessage || tx.errorCode || "—"}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[#666]">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-8 text-center text-[14px] text-[#777]">
                  No payment attempts recorded for this order yet.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-5">
          {/* Customer Card */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Customer</h3>
            <InfoRow label="Name" value={order.customerName} />
            <InfoRow label="Email" value={<a href={`mailto:${order.customerEmail}`} className="text-brand hover:underline break-all">{order.customerEmail}</a>} />
            {order.customerPhone && <InfoRow label="Phone" value={order.customerPhone} />}
            {order.companyName && <InfoRow label="Company" value={order.companyName} />}
            {order.taxIdSnapshot && (
              <InfoRow
                label={order.taxIdTypeSnapshot || "Tax ID"}
                value={<span className="font-mono text-brand font-semibold break-all">{order.taxIdSnapshot}</span>}
              />
            )}
          </div>

          {/* Order Details Card */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-[#111]">Order Details</h3>
            <InfoRow label="Order #" value={<span className="font-mono font-semibold">{order.orderNumber}</span>} />
            <InfoRow label="Created" value={new Date(order.createdAt).toLocaleDateString()} />
            <InfoRow label="Order Status" value={<StatusBadge status={order.status} />} />
            <InfoRow label="Payment Status" value={<StatusBadge status={order.paymentStatus} />} />
            <InfoRow label="Payment Mode" value={formatPaymentMethod(order.paymentMethod)} />
            {order.paymentProvider && <InfoRow label="Provider" value={order.paymentProvider} />}
            {order.paymentId && <InfoRow label="Payment ID" value={<span className="font-mono text-[12px] break-all">{order.paymentId}</span>} />}
          </div>

          {/* Shipping Address Card */}
          {order.shippingAddress && Object.keys(order.shippingAddress).length > 0 && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
              <h3 className="text-[14px] font-semibold text-[#111]">Shipping Address</h3>
              {Object.entries(order.shippingAddress).map(([k, v]) => (
                <InfoRow key={k} label={k} value={v} />
              ))}
            </div>
          )}

          {/* Shipping Info Card */}
          {(order.shippingProvider || order.shippingZone || order.trackingNumber || Number(order.shippingCharge) > 0) && (
            <div className="rounded-lg border border-[#E6E6E6] bg-white px-5 py-4 space-y-2">
              <h3 className="text-[14px] font-semibold text-[#111]">Shipping Info</h3>
              <InfoRow label="Provider" value={order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "—"} />
              {order.shippingZone?.countries?.length ? <InfoRow label="Zone" value={order.shippingZone.countries.map((entry) => `${entry.country.name} (${entry.country.code})`).join(", ")} /> : null}
              {order.shippingZone?.estimatedDays && <InfoRow label="Estimated" value={order.shippingZone.estimatedDays} />}
              <InfoRow label="Charge" value={`${sym}${Number(order.shippingCharge).toFixed(2)}`} />
              {(order.shippingBox || order.shippingBoxName || order.packageWeight != null) && (
                <InfoRow
                  label="Packaging"
                  value={
                    <>
                      {getPackagingSummary(order)} ·{" "}
                      {Number(order.packageWeight ?? 0).toFixed(3)} kg ·{" "}
                      {order.shippingBox
                        ? `${order.shippingBox.length}×${order.shippingBox.width}×${order.shippingBox.height} cm`
                        : `${Number(order.packageVolume ?? 0).toFixed(2)} cm³`}
                    </>
                  }
                />
              )}
              {order.trackingNumber && <InfoRow label="Tracking #" value={<span className="font-mono break-all">{order.trackingNumber}</span>} />}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function getPackagingSummary(order: OrderDetail) {
  const orderBoxes = (order as any).orderBoxes;
  if (orderBoxes && orderBoxes.length > 0) {
    const counts: Record<string, number> = {};
    orderBoxes.forEach((b: any) => {
      const name = b.boxName || "Standard box";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => `${count}x ${name}`)
      .join(", ");
  }
  return order.shippingBox?.name ?? order.shippingBoxName ?? "Standard box";
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3 text-[13.5px]">
      <span className="text-[#9A9A9A] shrink-0">{label}</span>
      <span className="sm:text-right font-medium text-[#111] break-words">{value}</span>
    </div>
  );
}

function formatPaymentMethod(value?: string | null) {
  if (!value) return "-";
  if (value === "PAY_ON_DELIVERY") return "Pay on Delivery (COD)";
  if (value === "RAZORPAY") return "Razorpay";
  return value;
}
