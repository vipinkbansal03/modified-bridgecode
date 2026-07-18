import axios from "axios";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin|\/customer)?$/, "")
  : "";

const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api/customer` : "/api/customer";

export const customerApi = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const SHIPPING_API_BASE = API_ORIGIN
  ? `${API_ORIGIN}/api/shipping`
  : "/api/shipping";
const COUPON_API_BASE = API_ORIGIN
  ? `${API_ORIGIN}/api/coupons`
  : "/api/coupons";

export const shippingApi = axios.create({
  baseURL: SHIPPING_API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export const couponApi = axios.create({
  baseURL: COUPON_API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

customerApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("customer_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

couponApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("customer_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

customerApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("customer_token");
      localStorage.removeItem("customer_profile");
    }
    return Promise.reject(err);
  },
);

export function getCustomerErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
) {
  const message = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  if (message) return message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface CustomerOrderItemPayload {
  variantId: string;
  quantity: number;
}

export interface CustomerOrderAddressPayload {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode?: string;
}

export interface CustomerAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryId: string;
  isDefault: boolean;
  country: { id: string; name: string; code: string };
}

export interface CustomerOrderLineItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  product?: { id: string; title: string; slug: string } | null;
  variant?: { id: string; title: string; sku: string | null } | null;
}

export interface CreateCustomerOrderPayload {
  items: CustomerOrderItemPayload[];
  shippingAddress: CustomerOrderAddressPayload;
  couponCode?: string;
  notes?: string;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  subtotal: string | number;
  taxAmount?: string | number;
  discount?: string | number;
  couponCode?: string | null;
  couponDiscount?: string | number | null;
  shippingCharge?: string | number;
  shippingProvider?: string | null;
  shippingZoneId?: string | null;
  total: string | number;
  createdAt: string;
  currency?: { code: string; symbol: string };
  country?: { id: string; name: string; code: string };
  shippingAddress?: CustomerOrderAddressPayload;
  items: CustomerOrderLineItem[];
}

export interface CustomerQuoteItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  product?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  variant?: {
    id: string;
    title: string;
    sku: string | null;
  } | null;
}

export interface CustomerQuoteSummary {
  id: string;
  quoteNumber: string;
  status: string;
  subtotal: string | number;
  shippingCharge: string | number;
  discount: string | number;
  total: string | number;
  notes?: string | null;
  expiresAt?: string | null;
  createdAt: string;

  currency?: {
    code: string;
    symbol: string;
  };

  country?: {
    id: string;
    name: string;
    code: string;
  };

  items: CustomerQuoteItem[];
}

export interface CustomerQuote extends CustomerQuoteSummary {}

export interface CustomerOrderEstimate {
  subtotal: number;
  taxAmount: number;
  shippingCharge: number;
  shippingProvider?: string | null;
  shippingZoneId?: string | null;
  shippingEstimatedDays?: string | null;
  shippingIsFree?: boolean;
  discount: number;
  couponCode?: string | null;
  couponDiscount?: number;
  total: number;
  currency?: { code: string; symbol: string };
  taxBreakdown: {
    label: string;
    taxPercent?: number | null;
    taxAmount: number;
  }[];
  items?: {
    variantId: string;
    sku: string | null;
    title: string;
    quantity: number;
    unitPrice: number;
    lineSubtotal: number;
  }[];
}

export interface CouponValidationResult {
  valid: true;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  discountAmount: number;
  description?: string | null;
}

export interface ShippingEstimate {
  available: boolean;
  charge: number;
  isFree: boolean;
  provider: string | null;
  providerId: string | null;
  zoneId: string | null;
  estimatedDays: string | null;
  message?: string;
}

export async function createCustomerOrder(payload: CreateCustomerOrderPayload) {
  const res = await customerApi.post("/orders", payload);
  return res.data.data as CustomerOrderSummary;
}

export async function estimateCustomerOrder(
  payload: CreateCustomerOrderPayload,
) {
  const res = await customerApi.post("/orders/estimate", payload);
  return res.data.data as CustomerOrderEstimate;
}

export async function calculateShipping(payload: {
  countryCode: string;
  orderValue: number;
}) {
  const res = await shippingApi.post("/calculate", payload);
  return res.data.data as ShippingEstimate;
}

export async function validateCoupon(payload: {
  code: string;
  orderValue: number;
  countryCode?: string;
}) {
  const res = await couponApi.post("/validate", payload);
  return res.data.data as CouponValidationResult;
}

export async function listCustomerOrders() {
  const res = await customerApi.get("/orders");
  return res.data.data as CustomerOrderSummary[];
}

export async function listCustomerQuotes() {
  const res = await customerApi.get("/quotes");
  return res.data.data as CustomerQuoteSummary[];
}

export async function getCustomerQuote(id: string) {
  const res = await customerApi.get(`/quotes/${id}`);
  return res.data.data as CustomerQuote;
}

export async function downloadCustomerInvoice(orderId: string) {
  const res = await customerApi.get(`/orders/${orderId}/invoice`, {
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function listCustomerAddresses() {
  const res = await customerApi.get("/addresses");
  return res.data.data as CustomerAddress[];
}
