"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Send,
  Trash2,
  UserCheck,
  UserX,
  MapPin,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  useToast,
} from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import {
  useAdminCountries,
  useAdminCustomers,
  useAdminCustomersInfinite,
  useAdminProduct,
  useAdminProducts,
  useAdminProductsInfinite,
  useCreateQuote,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type QuoteLine = {
  productId: string;
  variantId: string;
  quantity: string;
  overridePrice: string;
};

const emptyLine: QuoteLine = {
  productId: "",
  variantId: "",
  quantity: "1",
  overridePrice: "",
};

export default function CreateQuotePage() {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("quotes.create");

  useEffect(() => {
    if (!canCreate) {
      router.push("/admin/quotes");
    }
  }, [canCreate, router]);

  const { showToast, ToastComponent } = useToast();
  const [productSearch, setProductSearch] = useState("");
  const {
    data: infiniteProductsData,
    fetchNextPage: fetchNextProductsPage,
    hasNextPage: hasNextProductsPage,
    isFetchingNextPage: isFetchingNextProductsPage,
  } = useAdminProductsInfinite({
    search: productSearch || undefined,
    limit: 20,
  });

  const [customerSearch, setCustomerSearch] = useState("");
  const {
    data: infiniteCustomersData,
    fetchNextPage: fetchNextCustomersPage,
    hasNextPage: hasNextCustomersPage,
    isFetchingNextPage: isFetchingNextCustomersPage,
  } = useAdminCustomersInfinite({
    search: customerSearch || undefined,
    limit: 20,
  });

  const createQuote = useCreateQuote();

  // Customer Mode State
  const [isRegistered, setIsRegistered] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: countries = [] } = useAdminCountries();

  // Customer Mode State
  const [shipStreet, setShipStreet] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [shipPostalCode, setShipPostalCode] = useState("");

  // Financial & Line Items State
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [shippingCharge, setShippingCharge] = useState("0");
  const [lines, setLines] = useState<QuoteLine[]>([{ ...emptyLine }]);

  // EARLY RETURN PLACED AFTER ALL HOOK DEFINITIONS (React Rules of Hooks)
  if (!canCreate) return null;

  const customers = useMemo(() => {
    return infiniteCustomersData?.pages.flatMap((page: any) => page.data ?? []) ?? [];
  }, [infiniteCustomersData?.pages]);

  const products = useMemo(() => {
    return infiniteProductsData?.pages.flatMap((page: any) => page.data ?? []) ?? [];
  }, [infiniteProductsData?.pages]);

  // Handle Registered Customer Selection
  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find((c: { id: string }) => c.id === id);
    if (found) {
      setCustomerName(
        `${found.firstName ?? ""} ${found.lastName ?? ""}`.trim() ||
          found.email,
      );
      setCustomerEmail(found.email ?? "");
      setCustomerPhone(found.phone ?? "");
      setCompanyName(found.companyName ?? "");
      if (found.defaultCountryId) setCountryId(found.defaultCountryId);
    }
  };

  const setLine = (index: number, patch: Partial<QuoteLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const handleCreateQuote = async (sendEmail: boolean) => {
    const items = lines.filter((line) => line.productId.trim());
    if (!items.length) {
      showToast("Add at least one quote item.", "error");
      return;
    }

    if (!customerName.trim() || !customerEmail.trim()) {
      showToast("Customer name and email are required.", "error");
      return;
    }

    const shippingAddress = shipStreet.trim()
      ? {
          street: shipStreet,
          city: shipCity,
          state: shipState,
          postalCode: shipPostalCode,
        }
      : null;

    try {
      const result = await createQuote.mutateAsync({
        customerId:
          isRegistered && selectedCustomerId ? selectedCustomerId : null,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        companyName: companyName || null,
        countryId: countryId || null,
        notes: notes || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        shippingAddress,
        discount,
        shippingCharge,
        sendEmail,
        status: sendEmail ? "SENT" : "PENDING",
        items: items.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: line.quantity,
          overridePrice: line.overridePrice || null,
        })),
      });

      showToast(
        sendEmail
          ? "Quote created & sent to customer!"
          : "Draft quote created successfully.",
      );
      if (result.data?.id) {
        router.push(`/admin/quotes/${result.data.id}`);
      }
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to create quote."),
        "error",
      );
    }
  };

  return (
    <AdminLayout
      title="Create Quote"
      breadcrumb={[
        { label: "Quotes", href: "/admin/quotes" },
        { label: "Create" },
      ]}
    >
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]"
      >
        <ArrowLeft size={14} />
        Back to Quotes
      </button>

      <div className="space-y-6">
        {/* Customer Section */}
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
            <h3 className="text-[14px] font-semibold text-[#111]">
              Customer Details
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegistered(true);
                  setSelectedCustomerId("");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                  isRegistered
                    ? "bg-[#111] text-white"
                    : "border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]"
                }`}
              >
                <UserCheck size={14} /> Registered Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegistered(false);
                  setSelectedCustomerId("");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                  !isRegistered
                    ? "bg-[#111] text-white"
                    : "border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]"
                }`}
              >
                <UserX size={14} /> Guest / Offline
              </button>
            </div>
          </div>

          {isRegistered && (
            <div className="max-w-xl">
              <AdminSearchableSelect
                label="Search Registered Customer"
                placeholder="Search by name or email..."
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                options={customers.map(
                  (c: {
                    id: string;
                    firstName?: string;
                    lastName?: string;
                    email: string;
                    companyName?: string;
                  }) => ({
                    value: c.id,
                    label:
                      `${c.firstName ?? ""} ${c.lastName ?? ""} (${c.email})${c.companyName ? ` — ${c.companyName}` : ""}`.trim(),
                  }),
                )}
                onSearchChange={setCustomerSearch}
                onMenuScrollToBottom={() => {
                  if (hasNextCustomersPage && !isFetchingNextCustomersPage) {
                    fetchNextCustomersPage();
                  }
                }}
                isLoadingMore={isFetchingNextCustomersPage}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AdminInput
              label="Customer Name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Full Name"
            />
            <AdminInput
              label="Customer Email"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="email@example.com"
            />
            <AdminInput
              label="Phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="+1 234 567 890"
            />
            <AdminInput
              label="Company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Clinic / Company Name"
            />
            <AdminSearchableSelect
              label="Country"
              value={countryId}
              onChange={(event) => setCountryId(event.target.value)}
              options={[
                { value: "", label: "Select Country" },
                ...(countries as any[]).map((country) => ({
                  value: country.id,
                  label: `${country.name} (${country.code})`,
                })),
              ]}
            />
            <AdminInput
              label="Quote Expiry Date"
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
        </div>

        {/* Shipping Address Section */}
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E6E6E6] pb-3">
            <MapPin size={16} className="text-brand" />
            <h3 className="text-[14px] font-semibold text-[#111]">
              Shipping Address (Optional)
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInput
              label="Street Address"
              value={shipStreet}
              onChange={(e) => setShipStreet(e.target.value)}
              placeholder="123 Main St"
            />
            <AdminInput
              label="City"
              value={shipCity}
              onChange={(e) => setShipCity(e.target.value)}
              placeholder="City"
            />
            <AdminInput
              label="State / Province"
              value={shipState}
              onChange={(e) => setShipState(e.target.value)}
              placeholder="State"
            />
            <AdminInput
              label="Postal Code"
              value={shipPostalCode}
              onChange={(e) => setShipPostalCode(e.target.value)}
              placeholder="Postal / Zip Code"
            />
          </div>
        </div>

        {/* Line Items Section */}
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#111]">
              Line Items
            </h3>
            <button
              type="button"
              onClick={() =>
                setLines((current) => [...current, { ...emptyLine }])
              }
              className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111] hover:bg-[#F2F2F2]"
            >
              <Plus size={13} />
              Add Product Line
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <QuoteLineEditor
                key={index}
                line={line}
                products={products}
                onChange={(patch) => setLine(index, patch)}
                onRemove={() =>
                  setLines((current) => current.filter((_, i) => i !== index))
                }
                onProductSearch={setProductSearch}
                onProductScrollToBottom={() => {
                  if (hasNextProductsPage && !isFetchingNextProductsPage) {
                    fetchNextProductsPage();
                  }
                }}
                isProductsLoadingMore={isFetchingNextProductsPage}
              />
            ))}
          </div>
        </div>

        {/* Financial Adjustments & Action Buttons Section */}
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 space-y-4">
          <h3 className="text-[14px] font-semibold text-[#111]">
            Financial Adjustments & Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput
              label="Overall Discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
            <AdminInput
              label="Shipping Charge"
              type="number"
              min="0"
              step="0.01"
              value={shippingCharge}
              onChange={(event) => setShippingCharge(event.target.value)}
            />
            <AdminInput
              label="Internal Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes for admin team..."
            />
          </div>

          <p className="text-[12.5px] text-[#6B6B6B]">
            Product unit prices will be automatically calculated by the pricing
            engine based on customer type, tier, and selected country unless an
            explicit price override is provided.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3 border-t border-[#E6E6E6]">
            <button
              type="button"
              disabled={createQuote.isPending}
              onClick={() => handleCreateQuote(false)}
              className="rounded-md border border-[#E6E6E6] bg-white px-5 py-2.5 text-[13.5px] font-semibold text-[#111] hover:bg-[#F5F5F5] disabled:opacity-60 transition-all shadow-sm"
            >
              {createQuote.isPending
                ? "Creating Draft..."
                : "Create Draft Quote"}
            </button>
            <button
              type="button"
              disabled={createQuote.isPending}
              onClick={() => handleCreateQuote(true)}
              className="flex items-center gap-2 rounded-md bg-[#E31E24] px-6 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60 transition-all shadow-sm"
            >
              <Send size={15} />
              {createQuote.isPending
                ? "Creating & Sending..."
                : "Create & Send Quote"}
            </button>
          </div>
        </div>
      </div>

      {ToastComponent}
    </AdminLayout>
  );
}

function QuoteLineEditor({
  line,
  products,
  onChange,
  onRemove,
  onProductSearch,
  onProductScrollToBottom,
  isProductsLoadingMore,
}: {
  line: QuoteLine;
  products: { id: string; title: string }[];
  onChange: (patch: Partial<QuoteLine>) => void;
  onRemove: () => void;
  onProductSearch: (query: string) => void;
  onProductScrollToBottom: () => void;
  isProductsLoadingMore: boolean;
}) {
  const { data: productDetail } = useAdminProduct(line.productId);
  const variants = productDetail?.variants ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 md:grid-cols-[1.4fr_1.4fr_0.6fr_0.8fr_auto]">
      <AdminSearchableSelect
        label="Product"
        value={line.productId}
        onChange={(event) =>
          onChange({ productId: event.target.value, variantId: "" })
        }
        options={[
          { value: "", label: "Select product" },
          ...products.map((product) => ({
            value: product.id,
            label: product.title,
          })),
        ]}
        onSearchChange={onProductSearch}
        onMenuScrollToBottom={onProductScrollToBottom}
        isLoadingMore={isProductsLoadingMore}
      />
      <AdminSelect
        label="Variant"
        value={line.variantId}
        onChange={(event) => onChange({ variantId: event.target.value })}
        options={[
          { value: "", label: "Product-level price" },
          ...variants.map(
            (variant: { id: string; title: string; sku?: string }) => ({
              value: variant.id,
              label: `${variant.title}${variant.sku ? ` (${variant.sku})` : ""}`,
            }),
          ),
        ]}
      />
      <AdminInput
        label="Qty"
        type="number"
        min="1"
        value={line.quantity}
        onChange={(event) => onChange({ quantity: event.target.value })}
      />
      <AdminInput
        label="Override Price"
        type="number"
        min="0"
        step="0.01"
        value={line.overridePrice}
        onChange={(event) => onChange({ overridePrice: event.target.value })}
        placeholder="Auto-calculated"
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-6 flex h-10 w-10 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
