"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RotateCw,
  Truck,
  Package,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import {
  fetchCustomerOrderTracking,
  getCustomerErrorMessage,
  type CustomerOrderTrackingResponse,
} from "@/services/customerApi";
import { OrderTrackingTimeline } from "@/components/account/OrderTrackingTimeline";
import { cn } from "@/utils/cn";

function formatOrderDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-IN");
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-pill border border-line bg-grey px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-steel">
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { currentCustomer, isLoading: authLoading } = useCustomerAuth();

  const orderId = typeof params?.id === "string" ? params.id : "";

  const [tracking, setTracking] = useState<CustomerOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  // Update relative time display every 30s
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadTracking = useCallback(async (isRefresh = false) => {
    if (!orderId) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchCustomerOrderTracking(orderId);
      setTracking(data);
      setLastFetchedAt(new Date());
    } catch (err: unknown) {
      setError(getCustomerErrorMessage(err, "Failed to load order tracking."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!authLoading && !currentCustomer) {
      router.push("/auth/login?next=/account");
      return;
    }
    if (currentCustomer && orderId) {
      loadTracking(false);
    }
  }, [authLoading, currentCustomer, orderId, loadTracking, router]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-8 sm:py-12">
      <Container className="max-w-4xl space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-steel hover:text-ink transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Back to Orders</span>
          </Link>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-line bg-white p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <div className="rounded-lg border border-line bg-white p-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center space-y-4">
            <AlertCircle className="mx-auto text-rose-600" size={32} />
            <div>
              <h2 className="text-[16px] font-semibold text-rose-900">Unable to Load Tracking</h2>
              <p className="mt-1 text-[13.5px] text-rose-700">{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => loadTracking(false)}
              className="bg-white hover:bg-rose-100"
            >
              Try Again
            </Button>
          </div>
        ) : tracking ? (
          /* Main Tracking Content */
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-lg border border-line bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[18px] sm:text-[20px] font-bold text-ink">
                      Order #{tracking.orderNumber}
                    </h1>
                    <StatusBadge value={tracking.orderStatus} />
                  </div>
                  <p className="mt-1 text-[13px] text-steel">
                    Placed on {formatOrderDate(tracking.createdAt)}
                  </p>
                </div>

                {/* Refresh Action */}
                <div className="flex flex-col sm:items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadTracking(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:bg-grey transition-colors disabled:opacity-60"
                  >
                    <RotateCw
                      size={13}
                      className={cn(refreshing && "animate-spin text-brand")}
                    />
                    <span>{refreshing ? "Refreshing..." : "Refresh Tracking"}</span>
                  </button>
                  {lastFetchedAt && (
                    <span className="text-[11px] text-steel flex items-center gap-1">
                      <Clock size={11} />
                      Last synced {timeAgo(lastFetchedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Split Shipment Notice */}
            {tracking.isMultiShipment && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-[13px] text-blue-900">
                <Layers className="text-blue-600 mt-0.5 shrink-0" size={17} />
                <div>
                  <strong className="font-semibold">Multiple Shipments:</strong> This order is divided into{" "}
                  <strong>{tracking.shipments.length} shipments</strong> fulfilled from different warehouse facilities to optimize delivery speed.
                </div>
              </div>
            )}

            {/* Shipments List */}
            {tracking.shipments.length > 0 ? (
              <div className="space-y-6">
                {tracking.shipments.map((shipment, idx) => (
                  <OrderTrackingTimeline
                    key={shipment.shipmentId}
                    shipment={shipment}
                    index={idx}
                    totalShipments={tracking.shipments.length}
                  />
                ))}
              </div>
            ) : (
              /* No Shipments Yet State */
              <div className="rounded-lg border border-line bg-white p-8 text-center space-y-4 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grey text-steel">
                  <Package size={26} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-[16px] font-semibold text-ink">Order is Processing</h3>
                  <p className="text-[13.5px] text-steel max-w-md mx-auto">
                    Your order is being prepared by our fulfillment team. Shipment tracking and courier details will appear here as soon as the package is dispatched.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Container>
    </div>
  );
}
