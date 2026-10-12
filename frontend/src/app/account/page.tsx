"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Download,
  Home,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Truck,
  UserRound,
  RotateCcw,
  X,
  Bell,
  Info,
  FileText,
  ShieldCheck,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Building2,
  Receipt,
  Check,
  ShoppingBag,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import {
  deleteCustomerAddress,
  downloadCustomerInvoice,
  getCustomerErrorMessage,
  listCustomerAddresses,
  listCustomerOrders,
  listCustomerQuotes,
  setDefaultCustomerAddress,
  type CustomerAddress,
  type CustomerOrderSummary,
  type CustomerQuoteSummary,
} from "@/services/customerApi";
import { cn } from "@/utils/cn";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import QuoteHistory from "./QuoteHistory";
import { useCart } from "@/contexts/CartContext";
import EditProfileModal from "./EditProfileModal";
import AddressModal from "./AddressModal";
import { useToast } from "@/components/ui/ToastProvider";
import { apiClient } from "@/lib/apiClient";

function formatPhone(phone?: string | null) {
  if (!phone) return "Not added";
  try {
    const formatted = formatPhoneNumberIntl(phone);
    return formatted || phone;
  } catch {
    return phone;
  }
}

function money(
  order: CustomerOrderSummary,
  amount: string | number | undefined,
) {
  const value = Number(amount ?? 0);
  const symbol = order.currency?.symbol ?? "₹";
  return `${symbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function paymentMethodLabel(value?: string | null) {
  if (value === "PAY_ON_DELIVERY") return "Pay on Delivery";
  return value ? value.replace(/_/g, " ") : "Payment method not set";
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case "DELIVERED":
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CANCELLED":
    case "REJECTED":
    case "FAILED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "PROCESSING":
    case "CONFIRMED":
    case "SHIPPED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "PENDING":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        getStatusBadgeStyle(value)
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

function canDownloadInvoice(order: CustomerOrderSummary) {
  if (order.status === "CANCELLED" || order.status === "REJECTED") return false;
  if (order.isInvoiceGenerated === false && !order.invoiceUrl) return false;
  return true;
}

function getPackagingSummary(order: CustomerOrderSummary) {
  if (order.orderBoxes && order.orderBoxes.length > 0) {
    const counts: Record<string, number> = {};
    order.orderBoxes.forEach((b: any) => {
      const name = b.boxName || "Standard box";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => `${count}x ${name}`)
      .join(", ");
  }
  return order.shippingBox?.name ?? order.shippingBoxName ?? "Standard box";
}

type TabType = "all" | "orders" | "addresses" | "profile" | "quotes";

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { currentCustomer, isLoading, logout, setCustomer } = useCustomerAuth();
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [quotes, setQuotes] = useState<CustomerQuoteSummary[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<
    string | null
  >(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { clearCart, addItems } = useCart();
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [catalogUpdates, setCatalogUpdates] = useState<string[]>([]);
  const [isExpandedUpdates, setIsExpandedUpdates] = useState(false);
  const [isDismissedUpdates, setIsDismissedUpdates] = useState(false);

  // Tab management (defaults to 'all' or read from query param)
  const [activeTab, setActiveTab] = useState<TabType>("all");

  useEffect(() => {
    apiClient
      .get<{ data: string[] }>("/catalog-updates")
      .then((res) => {
        if (Array.isArray(res.data?.data)) {
          setCatalogUpdates(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tab = searchParams?.get("tab") as TabType;
    if (tab && ["all", "orders", "addresses", "profile", "quotes"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleReorder = async (order: CustomerOrderSummary) => {
    setReorderingId(order.id);
    try {
      const validItems = order.items.filter((item) => item.product?.id);
      if (validItems.length === 0) {
        showToast("The products in this order are no longer available.", "warning");
        return;
      }

      // Check if any variant is inactive or deleted
      const hasInactiveVariant = validItems.some(
        (item) => item.variant && (item.variant.status === "INACTIVE" || (item.variant as any).deletedAt)
      );

      if (hasInactiveVariant) {
        const firstUpdatedProduct = validItems.find(
          (item) => item.variant && (item.variant.status === "INACTIVE" || (item.variant as any).deletedAt)
        )?.product;

        showToast(
          "Packaging and product options for this item have been updated. Redirecting you to the product page to choose available options.",
          "info"
        );
        if (firstUpdatedProduct?.slug) {
          router.push(`/products/${firstUpdatedProduct.slug}`);
          return;
        }
      }

      const cartItems = validItems.map((item) => ({
        variantId: item.variant?.id ?? item.product!.id,
        productId: item.product!.id,
        productSlug: item.product!.slug,
        productTitle: item.product!.title,
        variantTitle: item.variant?.title ?? "",
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        currencyCode: order.currency?.code ?? "INR",
        currencySymbol: order.currency?.symbol ?? "Rs ",
        selectedAttributes: {},
      }));

      clearCart();
      addItems(cartItems);
      showToast("Order items added to cart with latest specifications!", "success");
      router.push("/cart");
    } catch (err) {
      console.error("Reorder failed", err);
      showToast("Failed to reorder items.", "error");
    } finally {
      setReorderingId(null);
    }
  };

  useEffect(() => {
    if (!isLoading && !currentCustomer) {
      router.replace("/login?returnTo=/account");
    }
  }, [currentCustomer, isLoading, router]);

  useEffect(() => {
    if (!currentCustomer) return;
    let mounted = true;
    setIsFetching(true);
    setError(null);

    Promise.all([
      listCustomerOrders(),
      listCustomerAddresses(),
      listCustomerQuotes(),
    ])
      .then(([orderRows, addressRows, quoteRows]) => {
        if (!mounted) return;
        setOrders(orderRows);
        setAddresses(addressRows);
        setQuotes(quoteRows);
      })
      .catch((err) => {
        if (mounted)
          setError(
            getCustomerErrorMessage(err, "Could not load account details."),
          );
      })
      .finally(() => {
        if (mounted) setIsFetching(false);
      });

    return () => {
      mounted = false;
    };
  }, [currentCustomer]);

  const displayName = useMemo(() => {
    if (!currentCustomer) return "";
    return (
      `${currentCustomer.firstName} ${currentCustomer.lastName}`.trim() ||
      currentCustomer.email
    );
  }, [currentCustomer]);

  async function handleInvoiceDownload(order: CustomerOrderSummary) {
    setError(null);
    setDownloadingInvoiceId(order.id);
    try {
      const blob = await downloadCustomerInvoice(order.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const invNumber = order.orderNumber ? order.orderNumber : order.id.slice(-8);
      anchor.download = `Invoice-INV-${invNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getCustomerErrorMessage(err, "Invoice download failed."));
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  if (isLoading || (!currentCustomer && isFetching)) {
    return (
      <Container>
        <div className="py-24 text-center text-steel flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-[15px] font-medium">Loading your account...</p>
        </div>
      </Container>
    );
  }

  if (!currentCustomer) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <Container>
        {/* Top Header & Greeting */}
        <div className="pt-6 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E7EB] pb-5">
            <div>
              <div className="mb-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] shadow-2xs transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
                >
                  <ArrowLeft size={14} className="text-[#E31E24]" />
                  <span>Back to Home</span>
                </Link>
              </div>
              <nav className="mb-1 text-[13px] text-steel-2">
                <Link href="/" className="hover:text-brand transition-colors">Home</Link>
                <span className="mx-1.5">/</span>
                <span className="text-[#111827] font-semibold">Your Account</span>
              </nav>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#111827] mt-1">
                Your Account
              </h1>
              <p className="text-[14px] text-[#4B5563] mt-0.5">
                Hello, <strong className="text-ink font-semibold">{displayName}</strong> — manage your orders, delivery addresses, and profile settings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button href="/products" variant="outline" className="h-9 text-[13px] font-semibold border-[#D1D5DB] hover:bg-white">
                <ShoppingBag size={14} className="mr-1.5 text-brand" />
                Continue Shopping
              </Button>
              <Button type="button" variant="ghost" onClick={logout} className="h-9 text-[13px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                Log Out
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-[#F2D5C6] bg-[#FFF5F0] px-4 py-3 text-[14px] text-[#8A4D2A] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-sm font-bold text-[#8A4D2A] hover:opacity-75">✕</button>
          </div>
        )}

        {/* Amazon-Style Hub Cards Grid */}
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: Your Orders */}
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={cn(
                "group flex items-start gap-4 rounded-xl border p-5 text-left transition-all shadow-2xs hover:shadow-md cursor-pointer",
                activeTab === "orders"
                  ? "border-[#E31E24] bg-red-50/20 ring-2 ring-[#E31E24]/10"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#E31E24] group-hover:scale-105 transition-transform">
                <Package size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                    Your Orders
                  </h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700">
                    {orders.length}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#6B7280] line-clamp-2">
                  Track packages, cancel items, pay pending orders, download invoices, or reorder products.
                </p>
              </div>
            </button>

            {/* Card 2: Your Addresses */}
            <button
              type="button"
              onClick={() => setActiveTab("addresses")}
              className={cn(
                "group flex items-start gap-4 rounded-xl border p-5 text-left transition-all shadow-2xs hover:shadow-md cursor-pointer",
                activeTab === "addresses"
                  ? "border-[#E31E24] bg-red-50/20 ring-2 ring-[#E31E24]/10"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                <MapPin size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                    Your Addresses
                  </h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700">
                    {addresses.length}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#6B7280] line-clamp-2">
                  Edit default shipping addresses and preferences for quick and secure checkout.
                </p>
              </div>
            </button>

            {/* Card 3: Login & Profile */}
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={cn(
                "group flex items-start gap-4 rounded-xl border p-5 text-left transition-all shadow-2xs hover:shadow-md cursor-pointer",
                activeTab === "profile"
                  ? "border-[#E31E24] bg-red-50/20 ring-2 ring-[#E31E24]/10"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
                <UserRound size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                    Login & Profile
                  </h3>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                    {currentCustomer.status ?? "ACTIVE"}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#6B7280] line-clamp-2">
                  Edit name, email, phone number, company information, and Tax/GST details.
                </p>
              </div>
            </button>

            {/* Card 4: Quote Requests */}
            <button
              type="button"
              onClick={() => setActiveTab("quotes")}
              className={cn(
                "group flex items-start gap-4 rounded-xl border p-5 text-left transition-all shadow-2xs hover:shadow-md cursor-pointer",
                activeTab === "quotes"
                  ? "border-[#E31E24] bg-red-50/20 ring-2 ring-[#E31E24]/10"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform">
                <FileText size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                    Quote Requests
                  </h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700">
                    {quotes.length}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#6B7280] line-clamp-2">
                  Review custom B2B quotes, price estimates, and convert approved quotes to orders.
                </p>
              </div>
            </button>

            {/* Card 5: Returns & Refunds */}
            <Link
              href="/account/returns"
              className="group flex items-start gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5 text-left transition-all shadow-2xs hover:shadow-md hover:border-[#D1D5DB]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
                <RotateCcw size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                    Returns & Refunds
                  </h3>
                  <ExternalLink size={14} className="text-gray-400 group-hover:text-brand" />
                </div>
                <p className="mt-1 text-[13px] text-[#6B7280] line-clamp-2">
                  Track return requests, status of returned items, and refund processing.
                </p>
              </div>
            </Link>

            {/* Card 6: Notifications */}
            <Link
              href="/account/notifications"
              className="group flex items-start gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5 text-left transition-all shadow-2xs hover:shadow-md hover:border-[#D1D5DB]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 group-hover:scale-105 transition-transform">
                <Bell size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                    Notifications & Alerts
                  </h3>
                  <ExternalLink size={14} className="text-gray-400 group-hover:text-brand" />
                </div>
                <p className="mt-1 text-[13px] text-[#6B7280] line-clamp-2">
                  Stay updated on order status changes, quote approvals, and promotional announcements.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Tab Navigation Pill Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors cursor-pointer",
              activeTab === "all"
                ? "bg-[#111827] text-white shadow-xs"
                : "bg-white text-[#4B5563] hover:bg-gray-100 hover:text-black border border-[#E5E7EB]"
            )}
          >
            All Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={cn(
              "rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors cursor-pointer",
              activeTab === "orders"
                ? "bg-[#E31E24] text-white shadow-xs"
                : "bg-white text-[#4B5563] hover:bg-gray-100 hover:text-black border border-[#E5E7EB]"
            )}
          >
            Your Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("addresses")}
            className={cn(
              "rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors cursor-pointer",
              activeTab === "addresses"
                ? "bg-[#E31E24] text-white shadow-xs"
                : "bg-white text-[#4B5563] hover:bg-gray-100 hover:text-black border border-[#E5E7EB]"
            )}
          >
            Your Addresses ({addresses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors cursor-pointer",
              activeTab === "profile"
                ? "bg-[#E31E24] text-white shadow-xs"
                : "bg-white text-[#4B5563] hover:bg-gray-100 hover:text-black border border-[#E5E7EB]"
            )}
          >
            Profile & Security
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quotes")}
            className={cn(
              "rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors cursor-pointer",
              activeTab === "quotes"
                ? "bg-[#E31E24] text-white shadow-xs"
                : "bg-white text-[#4B5563] hover:bg-gray-100 hover:text-black border border-[#E5E7EB]"
            )}
          >
            Quotes ({quotes.length})
          </button>
        </div>

        {/* SECTION: ORDERS */}
        {(activeTab === "all" || activeTab === "orders") && (
          <section className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-[#111827] flex items-center gap-2">
                  <PackageCheck size={22} className="text-[#E31E24]" />
                  Your Orders
                </h2>
                <p className="text-[13px] text-[#6B7280]">
                  Check order details, live package tracking, invoices, or repeat a previous order.
                </p>
              </div>
              <span className="text-[13px] font-semibold text-[#4B5563]">
                {orders.length} {orders.length === 1 ? "order" : "orders"} placed
              </span>
            </div>

            {/* Dynamic Attribute & Reorder Transparency Notice */}
            {catalogUpdates.length > 0 && !isDismissedUpdates && (
              <div className="mb-6 rounded-xl border border-[#E31E24]/30 bg-[#FFF5F5] p-3 sm:px-4 sm:py-3 text-[13px] text-[#111827] shadow-2xs transition-all">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <Info size={16} className="shrink-0 text-[#E31E24] mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug text-[#111827]">
                        <span className="font-bold text-[#E31E24]">Catalog Updates:</span>{" "}
                        When you reorder, older attributes are automatically mapped to current specifications:{" "}
                        {catalogUpdates.length <= 2 ? (
                          <span className="font-medium text-[#111827]">{catalogUpdates.join("; ")}</span>
                        ) : (
                          <span>
                            <span className="font-medium text-[#111827]">{catalogUpdates.slice(0, 2).join("; ")}</span>
                            <button
                              type="button"
                              onClick={() => setIsExpandedUpdates(!isExpandedUpdates)}
                              className="ml-1.5 inline-flex items-center gap-0.5 font-bold text-[#E31E24] underline hover:text-[#C8171D] cursor-pointer"
                            >
                              {isExpandedUpdates
                                ? "Show less"
                                : `+${catalogUpdates.length - 2} more updates`}
                              <ChevronDown
                                size={13}
                                className={`transition-transform duration-200 ${isExpandedUpdates ? "rotate-180" : ""}`}
                              />
                            </button>
                          </span>
                        )}
                        {" — "}
                        <span className="text-[#4B5563]">all with 100% identical dimensions and quality.</span>
                      </p>

                      {/* Expandable list when multiple attributes/values are updated */}
                      {isExpandedUpdates && catalogUpdates.length > 2 && (
                        <div className="mt-3 pt-3 border-t border-[#E31E24]/20 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
                          {catalogUpdates.map((infoText, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 rounded-lg bg-white/80 border border-[#E31E24]/15 px-2.5 py-1.5 text-[12px] font-medium text-[#111827]"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-[#E31E24] shrink-0" />
                              <span className="truncate">{infoText}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDismissedUpdates(true)}
                    className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-red-100/50 transition-colors cursor-pointer"
                    title="Dismiss notice"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {isFetching ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div key={n} className="h-44 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : orders.length ? (
              <div className="space-y-5">
                {orders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  const canCancel = ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status);
                  const canReturn = order.status === "DELIVERED" || order.status === "RETURNED";
                  const needsPayment = order.status !== "CANCELLED" && order.status !== "DELIVERED" && order.paymentStatus !== "PAID";
                  const canTrack = order.status !== "CANCELLED";

                  return (
                    <div
                      key={order.id}
                      className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xs transition-shadow hover:shadow-md"
                    >
                      {/* Amazon-style Order Card Header */}
                      <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          {/* Left Column: Metadata */}
                          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-[13px]">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                                Order Placed
                              </p>
                              <p className="font-semibold text-[#111827] mt-0.5">
                                {formatDate(order.createdAt)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                                Total Amount
                              </p>
                              <p className="font-bold text-[#111827] mt-0.5 text-[14px]">
                                {money(order, order.total)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                                Ship To
                              </p>
                              <p className="font-semibold text-[#111827] mt-0.5 truncate max-w-[140px]" title={order.shippingAddress?.fullName || displayName}>
                                {order.shippingAddress?.fullName || displayName}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                                Order #
                              </p>
                              <p className="font-mono font-semibold text-[#111827] mt-0.5">
                                {order.orderNumber}
                              </p>
                            </div>
                          </div>

                          {/* Right Status Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge value={order.status} />
                            <StatusBadge value={`Payment ${order.paymentStatus}`} />
                          </div>
                        </div>
                      </div>

                      {/* Card Body with Items & Action Bar */}
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                          {/* Left: Product Line Items List */}
                          <div className="flex-1 space-y-3.5">
                            {order.items.map((item) => {
                              const mediaUrl = item.product?.media?.[0]?.url;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3.5 pb-3 border-b border-[#F3F4F6] last:border-0 last:pb-0"
                                >
                                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
                                    {mediaUrl ? (
                                      <img
                                        src={mediaUrl}
                                        alt={item.product?.media?.[0]?.altText || item.title}
                                        className="h-full w-full object-contain p-1"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <Package size={24} className="text-gray-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <Link
                                      href={item.product?.slug ? `/products/${item.product.slug}` : "#"}
                                      className="font-bold text-[13.5px] text-[#111827] hover:text-[#E31E24] transition-colors line-clamp-1"
                                    >
                                      {item.product?.title || item.title}
                                    </Link>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#6B7280]">
                                      {(item.variant?.title || (item.product?.title && item.title !== item.product.title ? item.title : null)) && (
                                        <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                                          {item.variant?.title || item.title}
                                        </span>
                                      )}
                                      {item.sku && <span>SKU: {item.sku}</span>}
                                      <span>Qty: <strong className="text-ink">{item.quantity}</strong></span>
                                      <span>·</span>
                                      <span className="font-semibold text-ink">{money(order, item.total)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Right: Direct Action Buttons (Compact Amazon-Style Action Cluster) */}
                          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2 pt-2 lg:pt-0 lg:border-l lg:border-[#F3F4F6] lg:pl-5">
                            {/* Track Order CTA */}
                            {canTrack && (
                              <Link
                                href={`/account/orders/${order.id}`}
                                className="inline-flex h-8.5 w-full items-center justify-center gap-1.5 rounded-lg bg-white border border-[#D1D5DB] px-3 text-[12.5px] font-bold text-[#111827] shadow-2xs hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all"
                              >
                                <Truck size={14} className="text-[#E31E24]" />
                                Track Order
                              </Link>
                            )}

                            {/* Pay Now / Retry Payment CTA */}
                            {needsPayment && (
                              <Link
                                href={`/orders/${order.id}/pay`}
                                className={cn(
                                  "inline-flex h-8.5 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white shadow-xs transition-all",
                                  order.paymentStatus === "FAILED"
                                    ? "bg-amber-600 hover:bg-amber-700"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                                )}
                              >
                                <CreditCard size={14} />
                                {order.paymentStatus === "FAILED" ? "Retry Payment" : "Pay Now"}
                              </Link>
                            )}

                            {/* Reorder CTA */}
                            <button
                              type="button"
                              onClick={() => void handleReorder(order)}
                              disabled={reorderingId === order.id}
                              className="inline-flex h-8.5 w-full items-center justify-center gap-1.5 rounded-lg bg-[#E31E24] px-3 text-[12.5px] font-bold text-white shadow-xs hover:bg-[#C8171D] disabled:opacity-60 transition-colors cursor-pointer"
                            >
                              <ShoppingBag size={14} />
                              {reorderingId === order.id ? "Adding to Cart..." : "Buy It Again / Reorder"}
                            </button>

                            {/* Secondary Action Row: Invoice & Details */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {canDownloadInvoice(order) && (
                                <button
                                  type="button"
                                  onClick={() => handleInvoiceDownload(order)}
                                  disabled={downloadingInvoiceId === order.id}
                                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2 text-[11.5px] font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60 transition-colors cursor-pointer"
                                >
                                  <Download size={13} className="text-gray-500" />
                                  {downloadingInvoiceId === order.id ? "..." : "Invoice"}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                                className={cn(
                                  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2 text-[11.5px] font-semibold text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer",
                                  !canDownloadInvoice(order) && "col-span-2"
                                )}
                              >
                                {expanded ? "Less" : "Breakdown"}
                                <ChevronDown size={13} className={cn("transition-transform", expanded && "rotate-180")} />
                              </button>
                            </div>

                            {/* Cancel or Return Links */}
                            {canCancel && (
                              <Link
                                href={`/account/orders/${order.id}?cancel=true`}
                                className="inline-flex h-7.5 w-full items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50/40 px-2.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                              >
                                <X size={12} />
                                Cancel Order
                              </Link>
                            )}

                            {canReturn && (
                              <Link
                                href={`/account/orders/${order.id}?return=true`}
                                className="inline-flex h-7.5 w-full items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <RotateCcw size={12} />
                                Return or Replace
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Order Breakdown Details */}
                        {expanded && (
                          <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-[13px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Summary Breakdown */}
                              <div className="space-y-2">
                                <h4 className="font-bold text-ink text-[13.5px] border-b border-gray-200 pb-1">Payment & Charges</h4>
                                <div className="flex justify-between text-steel">
                                  <span>Subtotal</span>
                                  <strong className="text-ink">{money(order, order.subtotal)}</strong>
                                </div>
                                <div className="flex justify-between text-steel">
                                  <span>Shipping Fee</span>
                                  <strong className="text-ink">{money(order, order.shippingCharge)}</strong>
                                </div>
                                {order.discount && Number(order.discount) > 0 && (
                                  <div className="flex justify-between text-emerald-700">
                                    <span>Discount</span>
                                    <strong>-{money(order, order.discount)}</strong>
                                  </div>
                                )}
                                <div className="flex justify-between border-t border-gray-200 pt-2 text-[14.5px] font-bold text-ink">
                                  <span>Order Total</span>
                                  <span className="text-[#E31E24]">{money(order, order.total)}</span>
                                </div>
                              </div>

                              {/* Shipping & Delivery Box Details */}
                              <div className="space-y-2">
                                <h4 className="font-bold text-ink text-[13.5px] border-b border-gray-200 pb-1">Shipping Details</h4>
                                <div className="text-steel">
                                  <p className="font-medium text-ink">
                                    {paymentMethodLabel(order.paymentMethod)}
                                  </p>
                                  {(order.shippingBox || order.shippingBoxName || order.packageWeight != null) && (
                                    <p className="mt-1">
                                      Packaging: <strong className="text-ink">{getPackagingSummary(order)}</strong> · {Number(order.packageWeight ?? 0).toFixed(3)} kg
                                    </p>
                                  )}
                                  {order.shippingAddress && (
                                    <p className="mt-1 text-[12.5px] text-steel">
                                      <span className="font-semibold text-ink">Ship to: </span>
                                      {order.shippingAddress.addressLine1}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                                    </p>
                                  )}
                                  {order.billingAddress && (
                                    <p className="mt-1 text-[12.5px] text-steel">
                                      <span className="font-semibold text-ink">Bill to: </span>
                                      {order.billingAddress.addressLine1}, {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Package size={28} />
                </div>
                <h3 className="mt-3 text-[16px] font-bold text-[#111827]">No orders placed yet</h3>
                <p className="mt-1 text-[13.5px] text-[#6B7280]">
                  When you place an order, it will appear here with full tracking and invoice downloads.
                </p>
                <div className="mt-5">
                  <Button href="/products" className="bg-[#E31E24] hover:bg-[#C8171D] text-white font-bold text-[13.5px] px-6">
                    Start Shopping
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION: SAVED ADDRESSES */}
        {(activeTab === "all" || activeTab === "addresses") && (
          <section className="mb-12">
            <div className="mb-4">
              <h2 className="text-[20px] font-bold text-[#111827] flex items-center gap-2">
                <MapPin size={22} className="text-[#E31E24]" />
                Your Addresses
              </h2>
              <p className="text-[13px] text-[#6B7280]">
                Manage delivery addresses for faster and effortless checkout.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Add Address Dashed Card */}
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setIsAddressModalOpen(true);
                }}
                className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D1D5DB] bg-white p-6 text-center hover:border-[#E31E24] hover:bg-red-50/20 transition-all cursor-pointer group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 group-hover:bg-[#E31E24] group-hover:text-white transition-colors">
                  <Plus size={24} />
                </div>
                <h3 className="mt-3 text-[16px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                  Add New Address
                </h3>
                <p className="mt-1 text-[12.5px] text-[#6B7280]">
                  Add a new delivery location or billing address.
                </p>
              </button>

              {/* Address Cards */}
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-5 bg-white shadow-2xs transition-all relative",
                    address.isDefault ? "border-[#E31E24] ring-1 ring-[#E31E24]" : "border-[#E5E7EB] hover:border-gray-300"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-[15px] text-[#111827] flex items-center gap-1.5">
                        {address.label || address.fullName}
                      </h4>
                      {address.isDefault && (
                        <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#E31E24]">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-[13.5px] text-[#4B5563]">
                      <p className="font-semibold text-[#111827]">{address.fullName}</p>
                      <p>{address.addressLine1}</p>
                      {address.addressLine2 && <p>{address.addressLine2}</p>}
                      <p>
                        {address.city}, {address.state} {address.postalCode}
                      </p>
                      <p>{address.country.name} ({address.country.code})</p>
                      <p className="pt-1 text-[12.5px] text-gray-500 flex items-center gap-1">
                        <Phone size={13} className="text-gray-400" />
                        Phone: <span className="font-medium text-ink">{formatPhone(address.phone)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAddress(address);
                          setIsAddressModalOpen(true);
                        }}
                        className="font-bold text-[#111827] hover:text-[#E31E24] transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Are you sure you want to delete this address?")) return;
                          try {
                            await deleteCustomerAddress(address.id);
                            setAddresses((prev) => prev.filter((a) => a.id !== address.id));
                            showToast("Address deleted successfully.", "success");
                          } catch (err) {
                            setError(getCustomerErrorMessage(err, "Failed to delete address."));
                          }
                        }}
                        className="font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>

                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const updated = await setDefaultCustomerAddress(address.id);
                            setAddresses((prev) =>
                              prev.map((a) => ({
                                ...a,
                                isDefault: a.id === updated.id,
                              }))
                            );
                            showToast("Default address updated.", "success");
                          } catch (err) {
                            setError(getCustomerErrorMessage(err, "Failed to set default address."));
                          }
                        }}
                        className="text-[12px] font-semibold text-[#4B5563] hover:text-[#E31E24] hover:underline cursor-pointer"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: LOGIN & PROFILE */}
        {(activeTab === "all" || activeTab === "profile") && (
          <section className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-[#111827] flex items-center gap-2">
                  <UserRound size={22} className="text-[#E31E24]" />
                  Login & Profile Settings
                </h2>
                <p className="text-[13px] text-[#6B7280]">
                  Manage your personal identity, login email, business details, and Tax/GST credentials.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                className="bg-white border border-[#D1D5DB] text-[#111827] hover:bg-gray-50 font-bold text-[13px] h-9"
              >
                <Pencil size={14} className="mr-1.5 text-brand" />
                Edit Profile
              </Button>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Full Name */}
                <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-steel-2">
                    Full Name
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[#111827]">
                    {displayName}
                  </p>
                </div>

                {/* Email Address */}
                <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-steel-2 flex items-center gap-1.5">
                    <Mail size={12} />
                    Email Address
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[#111827] break-all">
                    {currentCustomer.email}
                  </p>
                </div>

                {/* Phone Number */}
                <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-steel-2 flex items-center gap-1.5">
                    <Phone size={12} />
                    Phone Number
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[#111827]">
                    {formatPhone(currentCustomer.phone)}
                  </p>
                </div>

                {/* Company Name */}
                <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-steel-2 flex items-center gap-1.5">
                    <Building2 size={12} />
                    Company / Clinic
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[#111827]">
                    {currentCustomer.companyName || "Not provided"}
                  </p>
                </div>

                {/* Tax ID / GST */}
                <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-steel-2 flex items-center gap-1.5">
                    <Receipt size={12} />
                    {currentCustomer.taxIdType || "Tax ID / GST"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-[14px] font-bold text-[#111827]">
                      {currentCustomer.taxId || "Not added"}
                    </span>
                    {currentCustomer.taxId && (
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase border",
                          currentCustomer.taxIdStatus === "VALID"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : currentCustomer.taxIdStatus === "INVALID"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {currentCustomer.taxIdStatus ?? "PENDING"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Account Status */}
                <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-steel-2 flex items-center gap-1.5">
                    <ShieldCheck size={12} />
                    Account Status
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-emerald-700 flex items-center gap-1.5">
                    <Check size={16} />
                    {currentCustomer.status ?? "ACTIVE"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION: QUOTES */}
        {(activeTab === "all" || activeTab === "quotes") && (
          <section className="mb-12">
            <QuoteHistory quotes={quotes} isFetching={isFetching} />
          </section>
        )}
      </Container>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSuccess={(updated) => setCustomer(updated)}
      />

      {/* Address Management Modal */}
      <AddressModal
        isOpen={isAddressModalOpen}
        editingAddress={editingAddress}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
        }}
        onSuccess={(address) => {
          setAddresses((prev) => {
            const idx = prev.findIndex((a) => a.id === address.id);
            if (idx >= 0) {
              const clone = [...prev];
              clone[idx] = address;
              return clone;
            }
            return address.isDefault ? [address, ...prev.map((a) => ({ ...a, isDefault: false }))] : [...prev, address];
          });
        }}
      />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FBFBFB] py-8">
          <Container>
            <div className="flex h-64 items-center justify-center text-[14px] text-[#6B7280]">
              Loading account...
            </div>
          </Container>
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
