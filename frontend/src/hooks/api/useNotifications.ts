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

export function useDeleteCustomerNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.delete(`/notifications/customer/${id}`, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "customer"] });
    },
  });
}

export function useBulkDeleteCustomerNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.post("/notifications/customer/bulk-delete", { ids }, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "customer"] });
    },
  });
}

export function useNotificationConfigs() {
  return useQuery({
    queryKey: ["notification-configs"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/configs", { headers });
      return res.data?.data ?? [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

export function useUpdateNotificationConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.patch(`/notifications/admin/configs/${id}`, data, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-configs"] });
    },
  });
}

export function useNotificationManagerSettings() {
  return useQuery({
    queryKey: ["notification-manager-settings"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/manager-settings", { headers });
      return res.data?.data ?? null;
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

export function useUpdateNotificationManagerSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.patch("/notifications/admin/manager-settings", data, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-manager-settings"] });
    },
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/templates", { headers });
      return res.data?.data ?? [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

export function useApprovedWhatsAppTemplates() {
  return useQuery({
    queryKey: ["approved-whatsapp-templates"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/templates/whatsapp-approved", { headers });
      return res.data?.data ?? [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

export function useUpdateNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, channel, data }: { type: string; channel: string; data: any }) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.put(`/notifications/admin/templates/${type}/${channel}`, data, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    },
  });
}

export function useNotificationLogs(params: { page: number; limit: number; search: string; status: string; channel: string }) {
  return useQuery({
    queryKey: ["notification-logs", params],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/logs", {
        headers,
        params,
      });
      return res.data?.data ?? { total: 0, items: [] };
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

export function useDeleteNotificationLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.delete(`/notifications/admin/logs/${id}`, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "admin"] });
    },
  });
}

export function useBulkDeleteNotificationLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.post("/notifications/admin/logs/bulk-delete", { ids }, { headers });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "admin"] });
    },
  });
}

export function useNotificationRolesList() {
  return useQuery({
    queryKey: ["notification-roles-list"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/roles-list", { headers });
      return res.data?.data ?? [];
    },
    enabled: typeof window !== "undefined" && !!localStorage.getItem("admin_token"),
  });
}

