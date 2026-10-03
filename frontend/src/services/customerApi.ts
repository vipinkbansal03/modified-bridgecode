import axios from "axios";
import { apiClient } from "@/lib/apiClient";

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
    const isLoginEndpoint = err.config?.url?.includes("/auth/login");
    if (err.response?.status === 401 && !isLoginEndpoint && typeof window !== "undefined") {
      localStorage.removeItem("customer_token");
      localStorage.removeItem("customer_profile");
      window.dispatchEvent(new CustomEvent("customer:unauthorized"));
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
  productId: string;
  variantId?: string;
  quantity: number;
  warehouseId?: string;
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
  product?: {
    id: string;
    title: string;
    slug: string;
    media?: Array<{ id?: string; url: string; altText?: string | null; type?: string }>;
  } | null;
  variant?: { id: string; title: string; sku: string | null } | null;
}

export interface CreateCustomerOrderPayload {
  items: CustomerOrderItemPayload[];
  shippingAddress: CustomerOrderAddressPayload;
  couponCode?: string;
  notes?: string;
  shippingZoneId?: string;
  paymentMethod?: string;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentId?: string | null;
  paymentExpiresAt?: string | null;
  secondsRemaining?: number;
  subtotal: string | number;
  taxAmount?: string | number;
  discount?: string | number;
  couponCode?: string | null;
  couponDiscount?: string | number | null;
  shippingCharge?: string | number;
  shippingProvider?: string | null;
  shippingZoneId?: string | null;
  shipmentsCount?: number;
  shippingBox?: ShippingBoxSummary | null;
  shippingBoxName?: string | null;
  packageWeight?: string | number;
  packageVolume?: string | number;
  total: string | number;
  createdAt: string;
  currency?: { code: string; symbol: string };
  country?: { id: string; name: string; code: string };
  shippingAddress?: CustomerOrderAddressPayload;
  items: CustomerOrderLineItem[];
  orderBoxes?: any[];
  isInvoiceGenerated?: boolean;
  invoiceType?: string | null;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  invoiceDate?: string | null;
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
  originalBaseSubtotal?: number;
  subtotal: number;
  taxAmount: number;
  taxMode?: "INCLUSIVE" | "EXCLUSIVE" | "EXEMPT";
  shippingCharge: number;
  shippingProvider?: string | null;
  shippingZoneId?: string | null;
  shippingEstimatedDays?: string | null;
  shippingIsFree?: boolean;
  shippingBox?: ShippingBoxSummary | null;
  packageWeight?: number;
  packageVolume?: number;
  discount: number;
  automaticDiscount?: number;
  automaticDiscounts?: {
    label: string;
    discountRuleType?: string;
    discountAmount: number;
    variantId?: string;
  }[];
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
    basePrice?: number;
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

export interface ShippingBoxSummary {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
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

export interface AvailableShippingOption {
  provider: string;
  providerId: string;
  zoneId: string;
  charge: number;
  isFree: boolean;
  estimatedDays: string | null;
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

export async function fetchAvailableProviders(payload: {
  countryCode: string;
  orderValue: number;
}) {
  const res = await shippingApi.post("/available-providers", payload);
  return res.data.data as AvailableShippingOption[];
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

export async function acceptCustomerQuote(id: string) {
  const res = await customerApi.put(`/quotes/${id}/accept`);
  return res.data.data as CustomerQuoteSummary;
}

export async function declineCustomerQuote(id: string) {
  const res = await customerApi.put(`/quotes/${id}/decline`);
  return res.data.data as CustomerQuoteSummary;
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

export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  orderNumber: string;
  sdkPayload?: Record<string, unknown>;
}

export interface AvailablePaymentMethod {
  id: string;
  code: string;
  name: string;
  description?: string;
  iconUrl?: string;
  type: "OFFLINE" | "SDK_MODAL" | "HOSTED_REDIRECT" | "DIRECT_FORM";
  clientScriptUrl?: string;
  sortOrder: number;
  isDefault: boolean;
  minOrderAmount?: number | null;
  maxOrderAmount?: number | null;
  publicKey?: string | null;
}

export async function fetchPublicPaymentMethods(
  countryCode?: string,
  cartItems?: { productId: string; variantId: string }[]
) {
  try {
    const res = await apiClient.post("/public/payment-methods/resolve", {
      countryCode: countryCode || "IN",
      cartItems: cartItems || [],
    });
    const data = res.data.data;
    if (Array.isArray(data)) {
      return {
        methods: data as AvailablePaymentMethod[],
        hasConflict: false,
        conflictingVariantIds: [] as string[],
      };
    }
    return {
      methods: (data?.methods ?? []) as AvailablePaymentMethod[],
      hasConflict: Boolean(data?.hasConflict),
      conflictingVariantIds: (data?.conflictingVariantIds ?? []) as string[],
    };
  } catch {
    return {
      methods: [] as AvailablePaymentMethod[],
      hasConflict: false,
      conflictingVariantIds: [] as string[],
    };
  }
}

export async function initiateCustomerPayment(orderId: string, paymentMethodCode: string) {
  const res = await customerApi.post(`/orders/${orderId}/payment/initiate`, {
    paymentMethodCode,
  });
  return res.data.data as {
    paymentId: string;
    type: "OFFLINE" | "SDK_MODAL" | "HOSTED_REDIRECT" | "DIRECT_FORM";
    redirectUrl?: string;
    clientScriptUrl?: string;
    sdkPayload?: Record<string, unknown>;
  };
}

export async function verifyCustomerPayment(
  orderId: string,
  paymentMethodCode: string,
  payload: Record<string, unknown>,
) {
  const res = await customerApi.post(`/orders/${orderId}/payment/verify`, {
    paymentMethodCode,
    payload,
  });
  return res.data.data as CustomerOrderSummary;
}

export async function createRazorpayOrder(orderId: string) {
  const res = await customerApi.post(`/orders/${orderId}/razorpay-order`);
  return res.data.data as RazorpayOrderResponse;
}

export async function verifyRazorpayPayment(
  orderId: string,
  payload: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  },
) {
  const res = await customerApi.post(`/orders/${orderId}/verify-razorpay`, payload);
  return res.data.data as CustomerOrderSummary;
}

export interface CustomerPaymentSession {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  subtotal: number;
  shippingCharge: number;
  discount: number;
  taxAmount: number;
  total: number;
  currency: string;
  currencySymbol: string;
  paymentExpiresAt?: string | null;
  secondsRemaining: number;
  isRetryable: boolean;
  isExpired: boolean;
  latestTransaction?: {
    id: string;
    attemptNumber: number;
    gatewayOrderId?: string | null;
    gatewayPaymentId?: string | null;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    createdAt: string;
  } | null;
  items: Array<{
    id: string;
    title: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
    warehouseId?: string | null;
  }>;
}

export async function fetchCustomerPaymentSession(orderId: string): Promise<CustomerPaymentSession> {
  const res = await customerApi.get(`/orders/${orderId}/payment-session`);
  return res.data.data as CustomerPaymentSession;
}

export async function recordCustomerPaymentFailure(
  orderId: string,
  payload: {
    gatewayOrderId?: string;
    errorCode?: string;
    errorMessage?: string;
  },
) {
  const res = await customerApi.post(`/orders/${orderId}/payment/failure`, payload);
  return res.data.data;
}

export async function updateCustomerProfile(data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  website?: string;
  preferredPrescription?: string | null;
  preferredPrescriptionOther?: string;
  preferredSlot?: string | null;
  currentPractice?: string | null;
  currentPracticeOther?: string;
  usingModernProducts?: boolean;
  taxId?: string | null;
  taxIdType?: string | null;
}) {
  const res = await customerApi.put("/auth/profile", data);
  return res.data.data;
}

export async function createCustomerAddress(data: {
  label?: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  countryId?: string;
  isDefault?: boolean;
}) {
  const res = await customerApi.post("/addresses", data);
  return res.data.data as CustomerAddress;
}

export async function validateCustomerAddress(data: {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}) {
  const res = await customerApi.post("/addresses/validate", data);
  return res.data.data;
}

export async function updateCustomerAddress(
  addressId: string,
  data: Partial<{
    label: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    countryId: string;
    isDefault: boolean;
  }>,
) {
  const res = await customerApi.put(`/addresses/${addressId}`, data);
  return res.data.data as CustomerAddress;
}

export async function deleteCustomerAddress(addressId: string) {
  const res = await customerApi.delete(`/addresses/${addressId}`);
  return res.data;
}

export async function setDefaultCustomerAddress(addressId: string) {
  const res = await customerApi.put(`/addresses/${addressId}/default`);
  return res.data.data as CustomerAddress;
}

// ─── Wishlist API ──────────────────────────────────────────
export interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: {
    id: string;
    title: string;
    slug: string;
    shortDescription?: string | null;
    category?: string;
    categorySlug?: string;
    image?: string | null;
    price?: string;
    rawPrice?: {
      sellingPrice: number;
      mrp?: number | null;
      currencySymbol?: string;
    } | null;
  };
}

export async function getCustomerWishlist(): Promise<WishlistItem[]> {
  const res = await customerApi.get("/wishlist");
  return res.data.data;
}

export async function addToWishlist(productId: string) {
  const res = await customerApi.post("/wishlist", { productId });
  return res.data.data;
}

export async function removeFromWishlist(productId: string) {
  const res = await customerApi.delete(`/wishlist/${productId}`);
  return res.data.data;
}

export async function toggleWishlist(productId: string): Promise<{ inWishlist: boolean }> {
  const res = await customerApi.post("/wishlist/toggle", { productId });
  return res.data.data;
}

export async function getWishlistCount(): Promise<{ count: number }> {
  const res = await customerApi.get("/wishlist/count");
  return res.data.data;
}

export async function syncWishlist(productIds: string[]): Promise<WishlistItem[]> {
  const res = await customerApi.post("/wishlist/sync", { productIds });
  return res.data.data;
}

// ─── Tracking API ──────────────────────────────────────────
export interface CustomerTrackingItem {
  orderItemId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
}

export interface CustomerTrackingEvent {
  id: string;
  status: string;
  statusLabel: string;
  location: string | null;
  description: string | null;
  timestamp: string;
}

export interface CustomerTrackingShipment {
  shipmentId: string;
  status: string;
  statusLabel: string;
  provider: {
    name: string;
    displayName: string;
  };
  trackingNumber: string | null;
  awbNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  estimatedDelivery: string | null;
  lastUpdatedAt: string;
  items: CustomerTrackingItem[];
  events: CustomerTrackingEvent[];
}

export interface CustomerOrderTrackingResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus?: string;
  createdAt: string;
  isMultiShipment: boolean;
  shipments: CustomerTrackingShipment[];
  returns?: {
    id: string;
    status: string;
    reason: string;
    notes: string | null;
    adminNotes: string | null;
    refundDetails: string | null;
    transactionReference: string | null;
    refundAmount: number | string;
    createdAt: string;
    attachmentUrls: string[];
    items: {
      id: string;
      orderItemId: string;
      quantity: number;
      orderItem: {
        title: string;
        sku: string | null;
      };
    }[];
  }[];
  isReturnable?: boolean;
  returnWindowDays?: number;
  deliveryDate?: string | null;
  cancelReason?: string | null;
  cancelRefundDetails?: string | null;
  cancelTransactionReference?: string | null;
}

export async function fetchCustomerOrderTracking(orderId: string): Promise<CustomerOrderTrackingResponse> {
  const res = await customerApi.get(`/orders/${orderId}/tracking`);
  return res.data.data;
}

export interface CustomerReturnRequestPayload {
  orderId: string;
  reason: string;
  notes?: string;
  refundDetails?: string;
  attachments?: File[];
  items: { orderItemId: string; quantity: number }[];
}

export async function submitCustomerReturnRequest(payload: CustomerReturnRequestPayload) {
  const formData = new FormData();
  formData.append("orderId", payload.orderId);
  formData.append("reason", payload.reason);
  if (payload.notes) formData.append("notes", payload.notes);
  if (payload.refundDetails) formData.append("refundDetails", payload.refundDetails);
  if (payload.attachments && payload.attachments.length > 0) {
    payload.attachments.forEach((file) => {
      formData.append("attachments", file);
    });
  }
  formData.append("items", JSON.stringify(payload.items));

  const res = await customerApi.post("/order-returns", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

export async function listCustomerReturns() {
  const res = await customerApi.get("/order-returns");
  return res.data.data;
}

export async function cancelCustomerReturnRequest(returnId: string) {
  const res = await customerApi.post(`/order-returns/${returnId}/cancel`);
  return res.data.data;
}

export async function cancelCustomerOrder(orderId: string, payload: { reason: string; refundDetails?: string }) {
  const res = await customerApi.post(`/orders/${orderId}/cancel`, payload);
  return res.data.data;
}
