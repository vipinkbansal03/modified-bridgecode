import axios, { AxiosError, AxiosRequestConfig } from "axios";

// ─── Base URL ─────────────────────────────────────────────
// Public site reads from /api/* by default (Next.js rewrites → backend).
// Set NEXT_PUBLIC_API_URL to call the backend directly from the browser, or
// set NEXT_PUBLIC_USE_STATIC_DATA=true to force the bundled JSON fallback.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "")
  : "";

export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

export const HAS_LIVE_API = process.env.NEXT_PUBLIC_USE_STATIC_DATA !== "true";

// ─── Axios instance ───────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 12000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("customer_token");

    if (token && !config.headers.Authorization && !config.headers.authorization) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

// ─── Response interceptor — normalise errors ──────────────
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string; errors?: unknown[] }>) => {
    const message =
      err.response?.data?.message ||
      err.message ||
      "Something went wrong. Please try again.";
    return Promise.reject(new Error(message));
  },
);

// ─── Helper — unwrap .data from paginated response ────────
export function unwrapData<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export function unwrapPaginated<T>(res: {
  data: { data: T[]; pagination: ApiPagination };
}): ApiPaginatedResult<T> {
  return { data: res.data.data, pagination: res.data.pagination };
}

// ─── Shared types ─────────────────────────────────────────
export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaginatedResult<T> {
  data: T[];
  pagination: ApiPagination;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
