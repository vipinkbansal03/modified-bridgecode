"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
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
  useCreateAdminOrder,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Line = {
  productId: string;
  variantId: string;
  quantity: string;
  overridePrice: string;
};
const emptyLine: Line = {
  productId: "",
  variantId: "",
  quantity: "1",
  overridePrice: "",
};

export default function CreateOrderPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const [customerMode, setCustomerMode] = useState<"ACCOUNT" | "OFFLINE">(
    "OFFLINE",
  );
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [countryId, setCountryId] = useState("");
  const [shippingCharge, setShippingCharge] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
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

  const { data: countries = [] } = useAdminCountries();
  const createOrder = useCreateAdminOrder();

  const products = useMemo(() => {
    return infiniteProductsData?.pages.flatMap((page: any) => page.data ?? []) ?? [];
  }, [infiniteProductsData?.pages]);

  const customers = useMemo(() => {
    return infiniteCustomersData?.pages.flatMap((page: any) => page.data ?? []) ?? [];
  }, [infiniteCustomersData?.pages]);

  const setLine = (index: number, patch: Partial<Line>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await createOrder.mutateAsync({
        customerId: customerMode === "ACCOUNT" ? customerId || null : null,
        customerName: customerMode === "OFFLINE" ? customerName : undefined,
        customerEmail: customerMode === "OFFLINE" ? customerEmail : undefined,
        customerPhone,
        countryId: countryId || null,
        shippingAddress: {},
        shippingCharge,
        discount,
        notes,
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: line.quantity,
          overridePrice: line.overridePrice || null,
        })),
      });
      showToast("Order created.");
      if (result.data?.id) router.push(`/admin/orders/${result.data.id}`);
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to create order."),
        "error",
      );
    }
  };

  return (
    <AdminLayout
      title="Create Order"
      breadcrumb={[
        { label: "Orders", href: "/admin/orders" },
        { label: "Create" },
      ]}
    >
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <h3 className="mb-4 text-[14px] font-semibold text-[#111]">
            Customer
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminSelect
              label="Customer Type"
              value={customerMode}
              onChange={(event) =>
                setCustomerMode(event.target.value as "ACCOUNT" | "OFFLINE")
              }
              options={[
                { value: "OFFLINE", label: "Offline customer" },
                { value: "ACCOUNT", label: "Customer account" },
              ]}
            />
            {customerMode === "ACCOUNT" ? (
              <AdminSearchableSelect
                label="Customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                options={[
                  { value: "", label: "Select customer" },
                  ...customers.map(
                    (customer: {
                      id: string;
                      email: string;
                      firstName: string;
                      lastName: string;
                    }) => ({
                      value: customer.id,
                      label: `${customer.firstName} ${customer.lastName} - ${customer.email}`,
                    }),
                  ),
                ]}
                onSearchChange={setCustomerSearch}
                onMenuScrollToBottom={() => {
                  if (hasNextCustomersPage && !isFetchingNextCustomersPage) {
                    fetchNextCustomersPage();
                  }
                }}
                isLoadingMore={isFetchingNextCustomersPage}
              />
            ) : (
              <>
                <AdminInput
                  label="Name *"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
                <AdminInput
                  label="Email *"
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                />
              </>
            )}
            <AdminInput
              label="Phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
            <AdminSearchableSelect
              label="Country"
              value={countryId}
              onChange={(event) => setCountryId(event.target.value)}
              options={[
                { value: "", label: "Use default country" },
                ...(countries as any[]).map((country) => ({
                  value: country.id,
                  label: `${country.name} (${country.code})`,
                })),
              ]}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#111]">
              Line Items
            </h3>
            <button
              type="button"
              onClick={() => setLines([...lines, { ...emptyLine }])}
              className="flex items-center gap-1 rounded border border-[#E6E6E6] px-3 py-1.5 text-[13px] hover:bg-[#F2F2F2]"
            >
              <Plus size={13} /> Add line
            </button>
          </div>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <OrderLineEditor
                key={index}
                line={line}
                products={products}
                onChange={(patch) => setLine(index, patch)}
                onRemove={() => setLines(lines.filter((_, i) => i !== index))}
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

        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput
              label="Shipping Charge"
              type="number"
              min="0"
              step="0.01"
              value={shippingCharge}
              onChange={(event) => setShippingCharge(event.target.value)}
            />
            <AdminInput
              label="Discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
            <AdminInput
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={createOrder.isPending}
            className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
          >
            {createOrder.isPending ? "Creating..." : "Create Manual Order"}
          </button>
        </div>
      </form>
      {ToastComponent}
    </AdminLayout>
  );
}

function OrderLineEditor({
  line,
  products,
  onChange,
  onRemove,
  onProductSearch,
  onProductScrollToBottom,
  isProductsLoadingMore,
}: {
  line: Line;
  products: { id: string; title: string }[];
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
  onProductSearch: (query: string) => void;
  onProductScrollToBottom: () => void;
  isProductsLoadingMore: boolean;
}) {
  const { data: productDetail } = useAdminProduct(line.productId);
  const variants = productDetail?.variants ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 rounded border border-[#E6E6E6] p-3 md:grid-cols-[1.4fr_1.4fr_0.6fr_0.8fr_auto]">
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
        placeholder="Resolver price"
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-6 flex h-10 w-10 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
