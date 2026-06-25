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

customerApi.interceptors.request.use((config) => {
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
  }
);

export function getCustomerErrorMessage(error: unknown, fallback = "Something went wrong.") {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
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
  notes?: string;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  subtotal: string | number;
  discount?: string | number;
  shippingCharge?: string | number;
  total: string | number;
  createdAt: string;
  currency?: { code: string; symbol: string };
  country?: { id: string; name: string; code: string };
  shippingAddress?: CustomerOrderAddressPayload;
  items: CustomerOrderLineItem[];
}

export async function createCustomerOrder(payload: CreateCustomerOrderPayload) {
  const res = await customerApi.post("/orders", payload);
  return res.data.data as CustomerOrderSummary;
}

export async function listCustomerOrders() {
  const res = await customerApi.get("/orders");
  return res.data.data as CustomerOrderSummary[];
}

export async function listCustomerAddresses() {
  const res = await customerApi.get("/addresses");
  return res.data.data as CustomerAddress[];
}
