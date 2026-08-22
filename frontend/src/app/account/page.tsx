"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  Home,
  PackageCheck,
  Pencil,
  Plus,
  UserRound,
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
  const symbol = order.currency?.symbol ?? "";
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

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-pill border border-line bg-grey px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-steel">
      {value.replace(/_/g, " ")}
    </span>
  );
}

function canDownloadInvoice(order: CustomerOrderSummary) {
  return order.status !== "CANCELLED" && order.status !== "REJECTED";
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

export default function AccountPage() {
  const router = useRouter();
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

  const handleReorder = async (order: CustomerOrderSummary) => {
    setReorderingId(order.id);
    try {
      const cartItems = order.items
        .filter((item) => item.product?.id)
        .map((item) => ({
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

      if (cartItems.length === 0) {
        showToast("The items in this order are no longer available for purchase.", "warning");
        return;
      }

      clearCart();
      addItems(cartItems);
      router.push("/checkout");
    } catch (err) {
      console.error("Reorder failed", err);
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
        <div className="py-20 text-center text-steel">
          Loading your account...
        </div>
      </Container>
    );
  }

  if (!currentCustomer) return null;

  return (
    <Container>
      <section className="py-6 lg:py-[34px]">
        <div className="mb-8 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-steel-2">
              <UserRound size={14} />
              Customer account
            </p>
            <h1 className="text-[34px] font-normal tracking-tight text-ink">
              My Account
            </h1>
            <p className="mt-2 text-[14.5px] text-steel">
              Orders, saved addresses, and account details for {displayName}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
            <Button href="/account/notifications" variant="outline">
              Notifications
            </Button>
            <Button href="/products" variant="outline">
              Continue shopping
            </Button>
            <Button type="button" variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-[#F2D5C6] bg-[#FFF5F0] px-4 py-3 text-[14px] text-[#8A4D2A]">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-md border border-line bg-white p-5 shadow-[0_16px_50px_rgba(31,24,18,0.06)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-ink">
                  Profile
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline"
                >
                  <Pencil size={13} />
                  Edit Profile
                </button>
              </div>
              <div className="space-y-3 text-[14px]">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                    Name
                  </p>
                  <p className="mt-1 text-ink">{displayName}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                    Email
                  </p>
                  <p className="mt-1 break-all text-ink">
                    {currentCustomer.email}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                    Phone
                  </p>
                  <p className="mt-1 text-ink">
                    {formatPhone(currentCustomer.phone)}
                  </p>
                </div>
                {currentCustomer.companyName && (
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                      Company
                    </p>
                    <p className="mt-1 text-ink">
                      {currentCustomer.companyName}
                    </p>
                  </div>
                )}
                {currentCustomer.taxId && (
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                      {currentCustomer.taxIdType || "Tax ID"}
                    </p>
                    <p className="mt-1 font-mono text-[13.5px] text-ink">
                      {currentCustomer.taxId}
                      <span className={`ml-2 text-[10.5px] font-semibold px-2 py-0.5 rounded ${
                        currentCustomer.taxIdStatus === "VALID" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        currentCustomer.taxIdStatus === "INVALID" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {currentCustomer.taxIdStatus ?? "PENDING"}
                      </span>
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                    Status
                  </p>
                  <p className="mt-1 text-ink">
                    {currentCustomer.status ?? "ACTIVE"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-line bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Home size={17} className="text-brand" />
                  <h2 className="text-[18px] font-semibold text-ink">
                    Saved Addresses
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAddress(null);
                    setIsAddressModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline"
                >
                  <Plus size={14} />
                  Add Address
                </button>
              </div>
              {isFetching ? (
                <p className="text-[14px] text-steel">Loading addresses...</p>
              ) : addresses.length ? (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="rounded-md border border-line bg-offwhite p-4 text-[13.5px] text-steel break-all overflow-hidden"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-semibold text-ink">
                          {address.label ?? address.fullName}
                        </p>
                        {address.isDefault ? (
                          <span className="rounded-pill bg-white px-2 py-1 text-[10px] font-semibold uppercase text-brand border border-line">
                            Default
                          </span>
                        ) : (
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
                              } catch (err) {
                                setError(getCustomerErrorMessage(err, "Failed to set default address."));
                              }
                            }}
                            className="text-[11px] font-semibold text-steel-2 hover:text-brand hover:underline"
                          >
                            Set as default
                          </button>
                        )}
                      </div>
                      <p>{address.fullName}</p>
                      <p>{formatPhone(address.phone)}</p>
                      <p>{address.addressLine1}</p>
                      {address.addressLine2 && <p>{address.addressLine2}</p>}
                      <p>
                        {address.city}, {address.state} {address.postalCode}
                      </p>
                      <p>
                        {address.country.name} ({address.country.code})
                      </p>

                      <div className="mt-3 flex items-center justify-end gap-3 border-t border-line/60 pt-2 text-[12px]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAddress(address);
                            setIsAddressModalOpen(true);
                          }}
                          className="font-semibold text-ink hover:text-brand"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Are you sure you want to delete this address?")) return;
                            try {
                              await deleteCustomerAddress(address.id);
                              setAddresses((prev) => prev.filter((a) => a.id !== address.id));
                            } catch (err) {
                              setError(getCustomerErrorMessage(err, "Failed to delete address."));
                            }
                          }}
                          className="font-semibold text-[#E31E24] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-steel">
                  No saved addresses yet.
                </p>
              )}
            </div>
          </aside>
          <div className="space-y-8">
            <section className="rounded-md border border-line bg-white p-5 shadow-[0_16px_50px_rgba(31,24,18,0.06)]">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <PackageCheck size={18} className="text-brand" />
                  <h2 className="text-[20px] font-semibold text-ink">
                    Order History
                  </h2>
                </div>
                <span className="text-[13px] text-steel">
                  {orders.length} {orders.length === 1 ? "order" : "orders"}
                </span>
              </div>

              {isFetching ? (
                <div className="rounded-md bg-grey p-8 text-center text-[14px] text-steel">
                  Loading orders...
                </div>
              ) : orders.length ? (
                <div className="divide-y divide-line">
                  {orders.map((order) => {
                    const expanded = expandedOrderId === order.id;
                    return (
                      <article
                        key={order.id}
                        className="py-4 first:pt-0 last:pb-0"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOrderId(expanded ? null : order.id)
                          }
                          className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-ink">
                                {order.orderNumber}
                              </p>
                              <StatusBadge value={order.status} />
                              <StatusBadge
                                value={paymentMethodLabel(order.paymentMethod)}
                              />
                              <StatusBadge
                                value={`Payment ${order.paymentStatus}`}
                              />
                            </div>
                            <p className="mt-1 text-[13px] text-steel">
                              {formatDate(order.createdAt)} ·{" "}
                              {order.items.length}{" "}
                              {order.items.length === 1 ? "item" : "items"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[15px] font-semibold text-ink">
                              {money(order, order.total)}
                            </p>
                            <ChevronDown
                              size={16}
                              className={cn(
                                "text-steel transition-transform",
                                expanded && "rotate-180",
                              )}
                            />
                          </div>
                        </button>

                        {expanded && (
                          <div className="mt-4 rounded-md border border-line bg-offwhite p-4">
                            <div className="space-y-3">
                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-col gap-2 border-b border-line pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                                >
                                  <div>
                                    <p className="text-[14px] font-semibold text-ink">
                                      {item.title}
                                    </p>
                                    <p className="mt-1 text-[12.5px] text-steel">
                                      {item.variant?.title ??
                                        item.sku ??
                                        "Variant"}
                                    </p>
                                    {item.sku && (
                                      <p className="mt-0.5 text-[12px] text-steel-2">
                                        SKU: {item.sku}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-[13px] text-steel sm:text-right">
                                    <p>
                                      Qty {item.quantity} ×{" "}
                                      {money(order, item.unitPrice)}
                                    </p>
                                    <p className="mt-1 font-semibold text-ink">
                                      {money(order, item.total)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13.5px]">
                              <div className="flex justify-between">
                                <span className="text-steel">Subtotal</span>
                                <strong className="text-ink">
                                  {money(order, order.subtotal)}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-steel">Shipping</span>
                                <strong className="text-ink">
                                  {money(order, order.shippingCharge)}
                                </strong>
                              </div>
                              {(order.shippingBox || order.shippingBoxName || order.packageWeight != null) && (
                                <div className="flex justify-between">
                                  <span className="text-steel">Packaging</span>
                                  <strong className="text-ink">
                                    {getPackagingSummary(order)} ·{" "}
                                    {Number(order.packageWeight ?? 0).toFixed(3)} kg
                                  </strong>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-steel">
                                  Payment method
                                </span>
                                <strong className="text-ink">
                                  {paymentMethodLabel(order.paymentMethod)}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-steel">Discount</span>
                                <strong className="text-ink">
                                  {money(order, order.discount)}
                                </strong>
                              </div>
                              <div className="flex justify-between border-t border-line pt-2 text-[15px]">
                                <span className="font-semibold text-ink">
                                  Total
                                </span>
                                <strong className="text-ink">
                                  {money(order, order.total)}
                                </strong>
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                              {canDownloadInvoice(order) ? (
                                <button
                                  type="button"
                                  onClick={() => handleInvoiceDownload(order)}
                                  disabled={downloadingInvoiceId === order.id}
                                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-grey disabled:opacity-60"
                                >
                                  <Download size={14} />
                                  {downloadingInvoiceId === order.id
                                    ? "Downloading..."
                                    : "Download invoice"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void handleReorder(order)}
                                disabled={reorderingId === order.id}
                                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
                              >
                                {reorderingId === order.id ? "Processing..." : "Reorder"}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md bg-grey p-8 text-center">
                  <p className="text-[15px] font-medium text-ink">
                    No orders yet
                  </p>
                  <p className="mt-1 text-[13.5px] text-steel">
                    Orders placed through checkout will appear here.
                  </p>
                  <Link
                    href="/products"
                    className="mt-4 inline-flex text-[13.5px] font-medium text-brand hover:underline"
                  >
                    Browse products
                  </Link>
                </div>
              )}
            </section>
            <QuoteHistory quotes={quotes} isFetching={isFetching} />
          </div>
        </div>
      </section>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSuccess={(updated) => setCustomer(updated)}
      />

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
    </Container>
  );
}
