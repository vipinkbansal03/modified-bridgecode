import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/adminApi";

// ─── Products ─────────────────────────────────────────────

export const useAdminProducts = (params?: { page?: number; limit?: number; search?: string; categoryId?: string; status?: string }) =>
  useQuery({ queryKey: ["admin-products", params], queryFn: () => adminApi.get("/products", { params }).then((r) => r.data) });

export const useAdminProduct = (id: string) =>
  useQuery({ queryKey: ["admin-product", id], queryFn: () => adminApi.get(`/products/${id}`).then((r) => r.data.data), enabled: !!id });

export const useAdminProductCountries = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-countries", productId],
    queryFn: () => adminApi.get(`/products/${productId}/countries`).then((r) => r.data.data),
    enabled: !!productId,
  });

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

export const useReorderProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) => adminApi.put("/products/reorder", { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
};

export const useBulkUpdateProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string; categoryId?: string; countryIds?: string[] }) => adminApi.post("/products/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product-countries"] });
    },
  });
};

export const useUpdateProductCountries = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) =>
      adminApi.put(`/products/${productId}/countries`, { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-countries", productId] }),
  });
};

export const useAdminVariantCountries = (productId?: string, variantId?: string) =>
  useQuery({
    queryKey: ["admin-variant-countries", productId, variantId],
    queryFn: () => adminApi.get(`/products/${productId}/variants/${variantId}/countries`).then((r) => r.data.data),
    enabled: !!productId && !!variantId,
  });

export const useUpdateVariantCountries = (productId?: string, variantId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) =>
      adminApi.put(`/products/${productId}/variants/${variantId}/countries`, { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variant-countries", productId, variantId] }),
  });
};

export const useAdminProductAttributes = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-attributes", productId],
    queryFn: () => adminApi.get(`/products/${productId}/attributes`).then((r) => r.data.data),
    enabled: !!productId,
  });

export const useAdminProductTierPricing = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-tier-pricing", productId],
    queryFn: () => adminApi.get(`/products/${productId}/tier-pricing`).then((r) => r.data.data),
    enabled: !!productId,
  });

export const useCreateProductTierPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post(`/products/${productId}/tier-pricing`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-tier-pricing", productId] }),
  });
};

export const useUpdateProductTierPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/products/${productId}/tier-pricing/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-tier-pricing", productId] }),
  });
};

export const useDeleteProductTierPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/products/${productId}/tier-pricing/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-tier-pricing", productId] }),
  });
};

export const useAdminProductMoqPricing = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-moq-pricing", productId],
    queryFn: () => adminApi.get(`/products/${productId}/moq-pricing`).then((r) => r.data.data),
    enabled: !!productId,
  });

export const useCreateProductMoqPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post(`/products/${productId}/moq-pricing`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-moq-pricing", productId] }),
  });
};

export const useUpdateProductMoqPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/products/${productId}/moq-pricing/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-moq-pricing", productId] }),
  });
};

export const useDeleteProductMoqPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/products/${productId}/moq-pricing/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product-moq-pricing", productId] }),
  });
};

export const useAssignProductAttributes = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attributes: { attributeId: string; required: boolean; gridAxis?: "ROW" | "COLUMN" | null; allowedValueIds: string[] }[]) =>
      adminApi.post(`/products/${productId}/attributes`, { attributes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product-attributes", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
};

export const useRemoveProductAttribute = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attributeId: string) => adminApi.delete(`/products/${productId}/attributes/${attributeId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product-attributes", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
};

export const useGenerateVariants = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => adminApi.post(`/products/${productId}/generate-variants`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }) });
};

// ─── Categories ───────────────────────────────────────────

export const useAdminCategories = () =>
  useQuery({ queryKey: ["admin-categories"], queryFn: () => adminApi.get("/categories").then((r) => r.data.data) });

export const useAdminCategoryCountries = (categoryId?: string) =>
  useQuery({
    queryKey: ["admin-category-countries", categoryId],
    queryFn: () => adminApi.get(`/categories/${categoryId}/countries`).then((r) => r.data.data),
    enabled: !!categoryId,
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/categories", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }) });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/categories/${id}`, data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }) });
};

export const useReorderCategories = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      adminApi.put("/categories/reorder", { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
};

export const useUpdateCategoryCountries = (categoryId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) =>
      adminApi.put(`/categories/${categoryId}/countries`, { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-category-countries", categoryId] }),
  });
};

export const useAdminCollections = (params?: { page?: number; status?: string }) =>
  useQuery({ queryKey: ["admin-collections", params], queryFn: () => adminApi.get("/collections", { params }).then((r) => r.data) });

export const useAdminCollection = (id?: string) =>
  useQuery({ queryKey: ["admin-collection", id], queryFn: () => adminApi.get(`/collections/${id}`).then((r) => r.data.data), enabled: !!id });

export const useCreateCollection = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/collections", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }) });
};

export const useUpdateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/collections/${id}`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-collections"] });
      qc.invalidateQueries({ queryKey: ["admin-collection", vars.id] });
    },
  });
};

export const useDeleteCollection = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/collections/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }) });
};

export const useAdminCollectionCountries = (collectionId?: string) =>
  useQuery({
    queryKey: ["admin-collection-countries", collectionId],
    queryFn: () => adminApi.get(`/collections/${collectionId}/countries`).then((r) => r.data.data),
    enabled: !!collectionId,
  });

export const useUpdateCollectionCountries = (collectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) => adminApi.put(`/collections/${collectionId}/countries`, { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collection-countries", collectionId] }),
  });
};

export const useAdminCollectionDiscounts = (collectionId?: string) =>
  useQuery({
    queryKey: ["admin-collection-discounts", collectionId],
    queryFn: () => adminApi.get(`/collections/${collectionId}/discounts`).then((r) => r.data.data),
    enabled: !!collectionId,
  });

export const useCreateCollectionDiscount = (collectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post(`/collections/${collectionId}/discounts`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-collection-discounts", collectionId] });
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
    },
  });
};

export const useDeleteCollectionDiscount = (collectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (discountId: string) => adminApi.delete(`/collections/${collectionId}/discounts/${discountId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-collection-discounts", collectionId] });
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
    },
  });
};

// ─── Attributes ───────────────────────────────────────────

export const useAdminAttributes = () =>
  useQuery({
    queryKey: ["admin-attributes"],
    queryFn: () => adminApi.get("/attributes").then((r) => r.data.data),
  });

export const useAdminAttribute = (id: string) =>
  useQuery({
    queryKey: ["admin-attribute", id],
    queryFn: () => adminApi.get(`/attributes/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useCreateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post("/attributes", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-attributes"] }),
  });
};

export const useUpdateAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/attributes/${id}`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.id] });
    },
  });
};

export const useDeleteAttribute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/attributes/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-attributes"] }),
  });
};

export const useReorderAttributes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      adminApi.put("/attributes/reorder", { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-attributes"] }),
  });
};

export const useCreateAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeId, ...data }: { attributeId: string } & Record<string, unknown>) =>
      adminApi.post(`/attributes/${attributeId}/values`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.attributeId] });
    },
  });
};

export const useUpdateAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeId,
      valueId,
      ...data
    }: {
      attributeId: string;
      valueId: string;
    } & Record<string, unknown>) =>
      adminApi.put(`/attributes/${attributeId}/values/${valueId}`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.attributeId] });
    },
  });
};

export const useDeleteAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeId, valueId }: { attributeId: string; valueId: string }) =>
      adminApi.delete(`/attributes/${attributeId}/values/${valueId}`).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.attributeId] });
    },
  });
};

export const useReorderAttributeValues = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeId,
      items,
    }: {
      attributeId: string;
      items: { id: string; sortOrder: number }[];
    }) => adminApi.put(`/attributes/${attributeId}/values/reorder`, { items }).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.attributeId] });
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
    },
  });
};

// ─── Inventory ────────────────────────────────────────────

export const useAdminInventory = (params?: { page?: number; search?: string }) =>
  useQuery({ queryKey: ["admin-inventory", params], queryFn: () => adminApi.get("/inventory", { params }).then((r) => r.data) });

export const useAdminInventoryAdjustments = (params?: { page?: number; limit?: number; reason?: string; startDate?: string; endDate?: string }) =>
  useQuery({ queryKey: ["admin-inventory-adjustments", params], queryFn: () => adminApi.get("/inventory/adjustments", { params }).then((r) => r.data) });

export const useAdminVariantInventoryAdjustments = (variantId?: string, params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ["admin-variant-inventory-adjustments", variantId, params],
    queryFn: () => adminApi.get(`/inventory/${variantId}/adjustments`, { params }).then((r) => r.data),
    enabled: !!variantId,
  });

export const useUpdateInventory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/inventory/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-adjustments"] });
      qc.invalidateQueries({ queryKey: ["admin-variant-inventory-adjustments"] });
    },
  });
};

// ─── Pricing ─────────────────────────────────────────────

export const useAdminPricing = (productId?: string) =>
  useQuery({ queryKey: ["admin-pricing", productId], queryFn: () => adminApi.get("/pricing", { params: { productId } }).then((r) => r.data.data) });

export const useCreatePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post("/pricing", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing"] }),
  });
};

export const useUpdatePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/pricing/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing"] }),
  });
};

// ─── Currencies & Countries ───────────────────────────────

export const useAdminTaxRules = (params?: { page?: number; limit?: number; countryId?: string; status?: string }) =>
  useQuery({ queryKey: ["admin-tax-rules", params], queryFn: () => adminApi.get("/tax-rules", { params }).then((r) => r.data) });

export const useCreateTaxRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post("/tax-rules", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tax-rules"] }),
  });
};

export const useUpdateTaxRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/tax-rules/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tax-rules"] }),
  });
};

export const useDeleteTaxRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/tax-rules/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tax-rules"] }),
  });
};

export const useAdminCurrencies = () =>
  useQuery({ queryKey: ["admin-currencies"], queryFn: () => adminApi.get("/currencies").then((r) => r.data.data) });

export const useAdminCountries = () =>
  useQuery({ queryKey: ["admin-countries"], queryFn: () => adminApi.get("/countries").then((r) => r.data.data) });

export const useAdminTiers = () =>
  useQuery({ queryKey: ["admin-tiers"], queryFn: () => adminApi.get("/tiers").then((r) => r.data.data) });

export const useCreateTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post("/tiers", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tiers"] }),
  });
};

export const useUpdateTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/tiers/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tiers"] }),
  });
};

export const useDeleteTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/tiers/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tiers"] }),
  });
};

export const useReorderTiers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) => adminApi.put("/tiers/reorder", { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tiers"] }),
  });
};

export const useAdminTierCountries = (tierId?: string) =>
  useQuery({
    queryKey: ["admin-tier-countries", tierId],
    queryFn: () => adminApi.get(`/tiers/${tierId}/countries`).then((r) => r.data.data),
    enabled: !!tierId,
  });

export const useUpdateTierCountries = (tierId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) => adminApi.put(`/tiers/${tierId}/countries`, { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tier-countries", tierId] }),
  });
};

export const useAdminCustomers = (params?: { page?: number; limit?: number; search?: string; customerType?: string; approvalStatus?: string }) =>
  useQuery({ queryKey: ["admin-customers", params], queryFn: () => adminApi.get("/customers", { params }).then((r) => r.data) });

export const useAdminCustomerRoles = () =>
  useQuery({ queryKey: ["admin-customer-roles"], queryFn: () => adminApi.get("/customer-roles").then((r) => r.data.data) });

export const useAdminCustomer = (id?: string) =>
  useQuery({ queryKey: ["admin-customer", id], queryFn: () => adminApi.get(`/customers/${id}`).then((r) => r.data.data), enabled: !!id });

export const useAdminCustomerOrders = (id?: string) =>
  useQuery({ queryKey: ["admin-customer-orders", id], queryFn: () => adminApi.get(`/customers/${id}/orders`).then((r) => r.data.data), enabled: !!id });

export const useAdminCustomerAddresses = (id?: string) =>
  useQuery({ queryKey: ["admin-customer-addresses", id], queryFn: () => adminApi.get(`/customers/${id}/addresses`).then((r) => r.data.data), enabled: !!id });

export const useUpdateAdminCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/customers/${id}`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", vars.id] });
    },
  });
};

export const useUpdateCustomerTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tierId }: { id: string; tierId: string | null }) =>
      adminApi.put(`/customers/${id}/tier`, { tierId }).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", vars.id] });
    },
  });
};

export const useUpdateCustomerRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, customerRoleId }: { id: string; customerRoleId: string }) =>
      adminApi.put(`/customers/${id}/role`, { customerRoleId }).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", vars.id] });
    },
  });
};

export const useApproveCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.post(`/customers/${id}/approve`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
    },
  });
};

export const useRejectCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.post(`/customers/${id}/reject`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
    },
  });
};

// ─── Coupons ─────────────────────────────────────────────

export const useAdminCoupons = (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  useQuery({ queryKey: ["admin-coupons", params], queryFn: () => adminApi.get("/coupons", { params }).then((r) => r.data) });

export const useCreateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/coupons", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }) });
};

export const useUpdateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/coupons/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
};

export const useDeleteCoupon = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/coupons/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }) });
};

// ─── Quotes ──────────────────────────────────────────────

export const useAdminDiscounts = (params?: { page?: number; limit?: number; search?: string; type?: string; status?: string; scope?: string; countryId?: string }) =>
  useQuery({ queryKey: ["admin-discounts", params], queryFn: () => adminApi.get("/discounts", { params }).then((r) => r.data) });

export const useCreateDiscount = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/discounts", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-discounts"] }) });
};

export const useUpdateDiscount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/discounts/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-discounts"] }),
  });
};

export const useDeleteDiscount = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/discounts/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-discounts"] }) });
};

export const useBulkDiscounts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: "ENABLE" | "DISABLE" | "DELETE" }) => adminApi.post("/discounts/bulk", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-discounts"] }),
  });
};

// ─── Blogs ────────────────────────────────────────────────

export const useAdminBlogs = (params?: { page?: number; limit?: number; status?: string; categoryId?: string; authorId?: string; search?: string }) =>
  useQuery({ queryKey: ["admin-blogs", params], queryFn: () => adminApi.get("/blogs", { params }).then((r) => r.data) });

export const useAdminBlog = (id?: string) =>
  useQuery({ queryKey: ["admin-blog", id], queryFn: () => adminApi.get(`/blogs/${id}`).then((r) => r.data.data), enabled: !!id });

export const useCreateBlog = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/blogs", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }) });
};

export const useUpdateBlog = (id?: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.put(`/blogs/${id}`, data).then((r) => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blogs"] }); qc.invalidateQueries({ queryKey: ["admin-blog", id] }); } });
};

export const useDeleteBlog = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/blogs/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }) });
};

export const useBulkBlogs = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { ids: string[]; action: string }) => adminApi.post("/blogs/bulk", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }) });
};

export const useAdminBlogCategories = () =>
  useQuery({ queryKey: ["admin-blog-categories"], queryFn: () => adminApi.get("/blogs/categories").then((r) => r.data.data) });

export const useCreateBlogCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/blogs/categories", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-categories"] }) });
};

export const useUpdateBlogCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/blogs/categories/${id}`, data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-categories"] }) });
};

export const useDeleteBlogCategory = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/blogs/categories/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-categories"] }) });
};

export const useAdminBlogAuthors = () =>
  useQuery({ queryKey: ["admin-blog-authors"], queryFn: () => adminApi.get("/blogs/authors").then((r) => r.data.data) });

export const useCreateBlogAuthor = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/blogs/authors", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-authors"] }) });
};

export const useUpdateBlogAuthor = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/blogs/authors/${id}`, data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-authors"] }) });
};

export const useDeleteBlogAuthor = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/blogs/authors/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-authors"] }) });
};

// ─── Banners ──────────────────────────────────────────────

export const useAdminBanners = (params?: { placement?: string; countryId?: string; status?: string }) =>
  useQuery({ queryKey: ["admin-banners", params], queryFn: () => adminApi.get("/banners", { params }).then((r) => r.data.data) });

export const useCreateBanner = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/banners", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
};

export const useUpdateBanner = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/banners/${id}`, data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
};

export const useDeleteBanner = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/banners/${id}`).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
};

export const useReorderBanners = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids: string[]) => adminApi.put("/banners/reorder", { ids }).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
};

export const useBulkBanners = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { ids: string[]; action: string }) => adminApi.post("/banners/bulk", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }) });
};

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

export const useUpdateQuoteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/quotes/${id}/review`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote", vars.id] });
    },
  });
};

export const useConvertQuoteToOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.post(`/quotes/${id}/convert-to-order`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
};

// ─── Orders ──────────────────────────────────────────────

export const useAdminOrders = (params?: { page?: number; status?: string; paymentStatus?: string; search?: string; countryId?: string; dateFrom?: string; dateTo?: string }) =>
  useQuery({ queryKey: ["admin-orders", params], queryFn: () => adminApi.get("/orders", { params }).then((r) => r.data) });

export const useCreateAdminOrder = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/orders", data).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }) });
};

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

export const useCreateCustomerRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post("/customer-roles", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer-roles"] }),
  });
};

export const useUpdateCustomerRoleAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/customer-roles/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer-roles"] }),
  });
};

export const useDeleteCustomerRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/customer-roles/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer-roles"] }),
  });
};

// ─── Settings ────────────────────────────────────────────

export const useAdminSettings = (group?: string) =>
  useQuery({ queryKey: ["admin-settings", group], queryFn: () => adminApi.get("/settings", { params: { group } }).then((r) => r.data.data) });

// ─── Logs ────────────────────────────────────────────────

export const useAdminLogs = (params?: { page?: number; entityType?: string; action?: string }) =>
  useQuery({ queryKey: ["admin-logs", params], queryFn: () => adminApi.get("/logs", { params }).then((r) => r.data) });

// ─── CMS ─────────────────────────────────────────────────

export const useAdminCmsPages = (params?: { page?: number; status?: string }) =>
  useQuery({ queryKey: ["admin-cms-pages", params], queryFn: () => adminApi.get("/cms/pages", { params }).then((r) => r.data) });

export const useAdminCmsPage = (id: string) =>
  useQuery({ queryKey: ["admin-cms-page", id], queryFn: () => adminApi.get(`/cms/pages/${id}`).then((r) => r.data.data), enabled: !!id });

export const useCreateCmsPage = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post("/cms/pages", data).then((r) => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }) });
};

export const useUpdateCmsPage = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.put(`/cms/pages/${id}`, data).then((r) => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }); qc.invalidateQueries({ queryKey: ["admin-cms-page", id] }); } });
};

export const useDeleteCmsPage = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/cms/pages/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }) });
};

export const useCreateCmsSection = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post(`/cms/pages/${pageId}/sections`, data).then((r) => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useUpdateCmsSection = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/cms/sections/${id}`, data).then((r) => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useDeleteCmsSection = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/cms/sections/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useReorderCmsSections = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (orderedIds: string[]) => adminApi.put(`/cms/pages/${pageId}/sections/reorder`, { orderedIds }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useCreateCmsBlock = (pageId: string, sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.post(`/cms/sections/${sectionId}/blocks`, data).then((r) => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useUpdateCmsBlock = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/cms/blocks/${id}`, data).then((r) => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useDeleteCmsBlock = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => adminApi.delete(`/cms/blocks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }) });
};

export const useAdminCmsFooter = () =>
  useQuery({ queryKey: ["admin-cms-footer"], queryFn: () => adminApi.get("/cms/footer").then((r) => r.data.data) });

export const useUpsertCmsFooter = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: unknown) => adminApi.put("/cms/footer", data).then((r) => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-footer"] }) });
};

export const useAdminCmsMenus = () =>
  useQuery({ queryKey: ["admin-cms-menus"], queryFn: () => adminApi.get("/cms/menus").then((r) => r.data.data) });
