"use client";

import { useState } from "react";
import {
  Truck,
  Package,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { type CustomerTrackingShipment } from "@/services/customerApi";
import { cn } from "@/utils/cn";

interface OrderTrackingTimelineProps {
  shipment: CustomerTrackingShipment;
  index: number;
  totalShipments: number;
}

const MILESTONES = [
  { key: "CREATED", label: "Confirmed" },
  { key: "LABEL_GENERATED", label: "Prepared" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

function getMilestoneIndex(status: string): number {
  switch (status) {
    case "CREATED":
      return 0;
    case "LABEL_GENERATED":
      return 1;
    case "PICKED_UP":
    case "IN_TRANSIT":
      return 2;
    case "OUT_FOR_DELIVERY":
      return 3;
    case "DELIVERED":
      return 4;
    case "FAILED":
    case "RETURNED":
    case "CANCELLED":
      return -1;
    default:
      return 0;
  }
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "OUT_FOR_DELIVERY":
    case "IN_TRANSIT":
    case "PICKED_UP":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "LABEL_GENERATED":
    case "CREATED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "FAILED":
    case "RETURNED":
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-grey text-steel border-line";
  }
}

function formatEventDate(timestamp: string) {
  try {
    const d = new Date(timestamp);
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return timestamp;
  }
}

export function OrderTrackingTimeline({
  shipment,
  index,
  totalShipments,
}: OrderTrackingTimelineProps) {
  const [copied, setCopied] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);

  const trackingCode = shipment.trackingNumber || shipment.awbNumber;
  const currentStep = getMilestoneIndex(shipment.status);
  const isFailedOrCancelled = ["FAILED", "RETURNED", "CANCELLED"].includes(shipment.status);

  const handleCopy = () => {
    if (!trackingCode) return;
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-line bg-white shadow-sm overflow-hidden">
      {/* Shipment Card Header */}
      <div className="border-b border-line bg-offwhite px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white border border-line text-brand">
            <Truck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-ink">
                {totalShipments > 1 ? `Shipment ${index + 1} of ${totalShipments}` : "Shipment Details"}
              </h3>
              <span className="text-[12px] font-medium text-steel">· {shipment.provider.displayName}</span>
            </div>
            {trackingCode ? (
              <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-steel">
                <span>AWB / Tracking: <strong className="font-mono text-ink">{trackingCode}</strong></span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy tracking number"
                  className="inline-flex items-center text-steel hover:text-ink transition-colors"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            ) : (
              <p className="mt-0.5 text-[12px] text-amber-600">Tracking number not available yet</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-pill border px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide",
              getStatusBadgeStyle(shipment.status)
            )}
          >
            {shipment.statusLabel}
          </span>

          {shipment.trackingUrl && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[12.5px] font-medium text-ink hover:bg-grey hover:text-brand transition-colors"
            >
              <span>View on {shipment.provider.name}</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Shipment Body */}
      <div className="p-5 space-y-6">
        {/* Estimated Delivery / Exception Notice */}
        {shipment.estimatedDelivery && !isFailedOrCancelled && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50/60 border border-blue-100 px-4 py-2.5 text-[13px] text-blue-900">
            <Calendar size={15} className="text-blue-600 shrink-0" />
            <span>Estimated Delivery: <strong>{shipment.estimatedDelivery}</strong></span>
          </div>
        )}

        {isFailedOrCancelled && (
          <div className="flex items-center gap-2 rounded-md bg-rose-50 border border-rose-100 px-4 py-2.5 text-[13px] text-rose-900">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>
              This shipment status is <strong>{shipment.statusLabel}</strong>. If you have questions, please contact customer support.
            </span>
          </div>
        )}

        {/* Visual Stepper Progression */}
        {!isFailedOrCancelled && (
          <div className="pt-2 pb-4">
            <div className="relative flex items-center justify-between">
              {/* Background connecting line */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-line" />
              {/* Active filled connecting line */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand transition-all duration-500"
                style={{
                  width: `${Math.max(0, Math.min(100, (currentStep / (MILESTONES.length - 1)) * 100))}%`,
                }}
              />

              {MILESTONES.map((step, sIdx) => {
                const isCompleted = currentStep >= sIdx;
                const isCurrent = currentStep === sIdx;

                return (
                  <div key={step.key} className="relative z-10 flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                        isCompleted
                          ? "bg-brand border-brand text-white"
                          : "bg-white border-line text-steel",
                        isCurrent && "ring-4 ring-brand/20"
                      )}
                    >
                      {isCompleted ? <Check size={14} /> : sIdx + 1}
                    </div>
                    <span
                      className={cn(
                        "mt-2 text-[11px] font-medium hidden sm:block text-center",
                        isCompleted ? "text-ink font-semibold" : "text-steel"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Mobile label display */}
            <div className="mt-3 text-center sm:hidden text-[12px] font-semibold text-ink">
              Current Stage: {MILESTONES[Math.max(0, currentStep)]?.label}
            </div>
          </div>
        )}

        {/* Checkpoint Events Timeline */}
        <div className="space-y-3">
          <h4 className="text-[13px] font-semibold uppercase tracking-wider text-steel">
            Tracking History
          </h4>

          {shipment.events && shipment.events.length > 0 ? (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              {shipment.events.map((evt, eIdx) => {
                const isLatest = eIdx === shipment.events.length - 1;

                return (
                  <div key={evt.id} className="relative group">
                    {/* Timeline bullet */}
                    <div
                      className={cn(
                        "absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 transition-colors",
                        isLatest
                          ? "border-brand bg-brand ring-4 ring-brand/20"
                          : "border-steel bg-white"
                      )}
                    />
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">
                          {evt.statusLabel}
                        </span>
                        {evt.location && (
                          <span className="inline-flex items-center gap-1 text-[12px] text-steel">
                            <MapPin size={12} className="text-steel-2" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                      {evt.description && (
                        <p className="text-[13px] text-steel">{evt.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-[11.5px] text-steel-2">
                        <Clock size={11} />
                        <span>{formatEventDate(evt.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-line bg-offwhite p-4 text-center text-[13px] text-steel">
              Shipment prepared. Courier tracking checkpoints will appear once the package is scanned.
            </div>
          )}
        </div>

        {/* Package Contents Accordion */}
        {shipment.items && shipment.items.length > 0 && (
          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setItemsExpanded(!itemsExpanded)}
              className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-ink hover:text-brand transition-colors"
            >
              <span className="flex items-center gap-2">
                <Package size={15} />
                <span>Items in this shipment ({shipment.items.reduce((sum, i) => sum + i.quantity, 0)} units)</span>
              </span>
              <ChevronDown
                size={16}
                className={cn("text-steel transition-transform", itemsExpanded && "rotate-180")}
              />
            </button>

            {itemsExpanded && (
              <div className="mt-3 divide-y divide-line rounded-md border border-line bg-offwhite p-3 space-y-2">
                {shipment.items.map((item) => (
                  <div key={item.orderItemId} className="flex items-center justify-between pt-2 first:pt-0">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{item.title}</p>
                      {item.variantTitle && (
                        <p className="text-[12px] text-steel">{item.variantTitle}</p>
                      )}
                      {item.sku && (
                        <p className="text-[11px] font-mono text-steel-2">SKU: {item.sku}</p>
                      )}
                    </div>
                    <div className="text-right text-[12.5px] font-semibold text-ink">
                      Qty: {item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
