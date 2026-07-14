import axios from "axios";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "")
  : "";

const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api/admin` : "/api/admin";

export const adminApi = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token from localStorage
adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  }
);

export function getAdminErrorMessage(error: unknown, fallback = "Something went wrong.") {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (message) return message;
  if (error instanceof Error && error.message) return error.message;
  return message || fallback;
}

// Typed response helpers
export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
