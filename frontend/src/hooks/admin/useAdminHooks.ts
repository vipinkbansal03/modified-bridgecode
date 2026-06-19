import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/adminApi";

// ─── Products ─────────────────────────────────────────────

export const useAdminProducts = (params?: { page?: number; limit?: number; search?: string; categoryId?: string; status?: string }) =>
  useQuery({ queryKey: ["admin-products", params], queryFn: () => adminApi.get("/products", { params }).then((r) => r.data) });

export const useAdminProduct = (id: string) =>
  useQuery({ queryKey: ["admin-product", id], queryFn: () => adminApi.get(`/products/${id}`).then((r) => r.data.data), enabled: !!id });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/products", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }) });
};

export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.put(`/products/${id}`, data).then((r) => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); qc.invalidateQueries({ queryKey: ["admin-product", id] }); } });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/products/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }) });
};

export const useGenerateVariants = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => adminApi.post(`/products/${productId}/generate-variants`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }) });
};

// ─── Categories ───────────────────────────────────────────

export const useAdminCategories = () =>
  useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.get("/categories").then((r) => r.data.data) });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/categories", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }) });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/categories/${id}`, data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }) });
};

// ─── Attributes ───────────────────────────────────────────

export const useAdminAttributes = () =>
  useQuery({ queryKey: ["admin-attributes"], queryFn: () => adminApi.get("/attributes").then((r) => r.data.data) });

// ─── Inventory ────────────────────────────────────────────

export const useAdminInventory = (params?: { page?: number; search?: string }) =>
  useQuery({ queryKey: ["admin-inventory", params], queryFn: () => adminApi.get("/inventory", { params }).then((r) => r.data) });

export const useUpdateInventory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/inventory/${id}`, data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inventory"] }) });
};

// ─── Pricing ─────────────────────────────────────────────

export const useAdminPricing = (productId?: string) =>
  useQuery({ queryKey: ["admin-pricing", productId], queryFn: () => adminApi.get("/pricing", { params: { productId } }).then((r) => r.data.data) });

// ─── Currencies & Countries ───────────────────────────────

export const useAdminCurrencies = () =>
  useQuery({ queryKey: ["admin-currencies"], queryFn: () => adminApi.get("/currencies").then((r) => r.data.data) });

export const useAdminCountries = () =>
  useQuery({ queryKey: ["admin-countries"], queryFn: () => adminApi.get("/countries").then((r) => r.data.data) });

// ─── Coupons ─────────────────────────────────────────────

export const useAdminCoupons = (params?: { page?: number }) =>
  useQuery({ queryKey: ["admin-coupons", params], queryFn: () => adminApi.get("/coupons", { params }).then((r) => r.data) });

export const useCreateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/coupons", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }) });
};

// ─── Quotes ──────────────────────────────────────────────

export const useAdminQuotes = (params?: { page?: number; status?: string }) =>
  useQuery({ queryKey: ["admin-quotes", params], queryFn: () => adminApi.get("/quotes", { params }).then((r) => r.data) });

export const useAdminQuote = (id: string) =>
  useQuery({ queryKey: ["admin-quote", id], queryFn: () => adminApi.get(`/quotes/${id}`).then((r) => r.data.data), enabled: !!id });

export const useUpdateQuoteStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.put(`/quotes/${id}/status`, { status }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ["admin-quotes"] }); qc.invalidateQueries({ queryKey: ["admin-quote", id] }); },
  });
};

// ─── Orders ──────────────────────────────────────────────

export const useAdminOrders = (params?: { page?: number; status?: string; paymentStatus?: string }) =>
  useQuery({ queryKey: ["admin-orders", params], queryFn: () => adminApi.get("/orders", { params }).then((r) => r.data) });

export const useOrderAnalytics = () =>
  useQuery({ queryKey: ["admin-order-analytics"], queryFn: () => adminApi.get("/orders/analytics").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });

export const useAdminOrder = (id: string) =>
  useQuery({ queryKey: ["admin-order", id], queryFn: () => adminApi.get(`/orders/${id}`).then((r) => r.data.data), enabled: !!id });

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.put(`/orders/${id}/status`, { status }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-order", id] }); },
  });
};

export const useShipOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shippingProvider, trackingNumber }: { id: string; shippingProvider: string; trackingNumber: string }) =>
      adminApi.post(`/orders/${id}/ship`, { shippingProvider, trackingNumber }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-order", id] }); },
  });
};

export const useDeliverOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.post(`/orders/${id}/deliver`),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-order", id] }); },
  });
};

// ─── Media ───────────────────────────────────────────────

export const useAdminMedia = (params?: { page?: number }) =>
  useQuery({ queryKey: ["admin-media", params], queryFn: () => adminApi.get("/media", { params }).then((r) => r.data) });

// ─── Languages ───────────────────────────────────────────

export const useAdminLanguages = () =>
  useQuery({ queryKey: ["admin-languages"], queryFn: () => adminApi.get("/translations/languages").then((r) => r.data.data) });

// ─── Users & Roles ───────────────────────────────────────

export const useAdminUsers = () =>
  useQuery({ queryKey: ["admin-users"], queryFn: () => adminApi.get("/users").then((r) => r.data.data) });

export const useAdminRoles = () =>
  useQuery({ queryKey: ["admin-roles"], queryFn: () => adminApi.get("/roles").then((r) => r.data.data) });

// ─── Settings ────────────────────────────────────────────

export const useAdminSettings = (group?: string) =>
  useQuery({ queryKey: ["admin-settings", group], queryFn: () => adminApi.get("/settings", { params: { group } }).then((r) => r.data.data) });

// ─── Logs ────────────────────────────────────────────────

export const useAdminLogs = (params?: { page?: number; entityType?: string; action?: string }) =>
  useQuery({ queryKey: ["admin-logs", params], queryFn: () => adminApi.get("/logs", { params }).then((r) => r.data) });
