"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

const getHeaders = (role: "admin" | "customer") => {
  if (typeof window === "undefined") return {};
  const token = role === "admin" ? localStorage.getItem("admin_token") : localStorage.getItem("customer_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  targetType: string;
  customer?: {
    firstName: string;
    lastName: string;
  };
}

export function useNotifications(role: "admin" | "customer") {
  return useQuery<Notification[]>({
    queryKey: ["notifications", role],
    queryFn: async () => {
      const headers = getHeaders(role);
      if (!headers.Authorization) return [];
      const res = await apiClient.get(`/notifications/${role}/mine`, { headers });
      return res.data?.data ?? [];
    },
    enabled: typeof window !== "undefined" && !!(role === "admin" ? localStorage.getItem("admin_token") : localStorage.getItem("customer_token")),
  });
}

export function useMarkNotificationRead(role: "admin" | "customer") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const headers = getHeaders(role);
      const res = await apiClient.patch(`/notifications/${role}/${id}/read`, {}, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", role] });
    },
  });
}

export function useRegisterNotificationToken(role: "admin" | "customer") {
  return useMutation({
    mutationFn: async (token: string) => {
      const headers = getHeaders(role);
      const res = await apiClient.post(`/notifications/${role}/register-token`, {
        token,
        deviceType: "web"
      }, { headers });
      return res.data;
    },
  });
}

export function useAdminNotificationsHistory() {
  return useQuery<Notification[]>({
    queryKey: ["admin-notifications-history"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/all", { headers });
      return res.data?.data ?? [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

export function useDeleteAdminNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.delete(`/notifications/admin/${id}`, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-history"] });
    },
  });
}
