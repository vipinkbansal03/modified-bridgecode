import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/adminApi";

// ─── Products ─────────────────────────────────────────────

export const useAdminProducts = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-products", params],
    queryFn: () => adminApi.get("/products", { params }).then((r) => r.data),
  });

export const useAdminProduct = (id: string) =>
  useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => adminApi.get(`/products/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useAdminProductCountries = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-countries", productId],
    queryFn: () =>
      adminApi.get(`/products/${productId}/countries`).then((r) => r.data.data),
    enabled: !!productId,
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/products", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.put(`/products/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/products/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
};

export const useDuplicateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/products/${id}/duplicate`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
};

export const useArchiveProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/products/${id}/archive`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
};

export const useRestoreProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/products/${id}/restore`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
};

export const useReorderProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      adminApi.put("/products/reorder", { items }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
};

export const useBulkUpdateProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      action: string;
      categoryId?: string;
      countryIds?: string[];
      collectionIds?: string[];
      warehouseId?: string;
    }) => adminApi.post("/products/bulk", data).then((r) => r.data),
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
      adminApi
        .put(`/products/${productId}/countries`, { items })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-product-countries", productId],
      });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useAdminVariantCountries = (
  productId?: string,
  variantId?: string,
) =>
  useQuery({
    queryKey: ["admin-variant-countries", productId, variantId],
    queryFn: () =>
      adminApi
        .get(`/products/${productId}/variants/${variantId}/countries`)
        .then((r) => r.data.data),
    enabled: !!productId && !!variantId,
  });

export const useUpdateVariantCountries = (
  productId?: string,
  variantId?: string,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) =>
      adminApi
        .put(`/products/${productId}/variants/${variantId}/countries`, {
          items,
        })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-variant-countries", productId, variantId],
      }),
  });
};

export const useAdminVariants = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  productId?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-variants", params],
    queryFn: () =>
      adminApi.get("/products/variants", { params }).then((r) => r.data),
  });

export const useArchiveVariant = (productId?: string, variantId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId: nextProductId,
      variantId: nextVariantId,
    }: {
      productId: string;
      variantId: string;
    }) =>
      adminApi
        .post(`/products/${nextProductId}/variants/${nextVariantId}/archive`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variants"] }),
  });
};

export const useRestoreVariant = (productId?: string, variantId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId: nextProductId,
      variantId: nextVariantId,
    }: {
      productId: string;
      variantId: string;
    }) =>
      adminApi
        .post(`/products/${nextProductId}/variants/${nextVariantId}/restore`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variants"] }),
  });
};

export const useDuplicateVariant = (productId?: string, variantId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId: nextProductId,
      variantId: nextVariantId,
    }: {
      productId: string;
      variantId: string;
    }) =>
      adminApi
        .post(`/products/${nextProductId}/variants/${nextVariantId}/clone`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variants"] }),
  });
};

export const useDeleteVariant = (productId?: string, variantId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId: nextProductId,
      variantId: nextVariantId,
    }: {
      productId: string;
      variantId: string;
    }) =>
      adminApi
        .delete(`/products/${nextProductId}/variants/${nextVariantId}`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variants"] }),
  });
};

export const useAdminProductAttributes = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-attributes", productId],
    queryFn: () =>
      adminApi
        .get(`/products/${productId}/attributes`)
        .then((r) => r.data.data),
    enabled: !!productId,
  });

export const useAdminProductTierPricing = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-tier-pricing", productId],
    queryFn: () =>
      adminApi
        .get(`/products/${productId}/tier-pricing`)
        .then((r) => r.data.data),
    enabled: !!productId,
  });

export const useCreateProductTierPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi
        .post(`/products/${productId}/tier-pricing`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-product-tier-pricing", productId],
      }),
  });
};

export const useUpdateProductTierPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi
        .put(`/products/${productId}/tier-pricing/${id}`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-product-tier-pricing", productId],
      }),
  });
};

export const useDeleteProductTierPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi
        .delete(`/products/${productId}/tier-pricing/${id}`)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-product-tier-pricing", productId],
      }),
  });
};

export const useAdminProductMoqPricing = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-moq-pricing", productId],
    queryFn: () =>
      adminApi
        .get(`/products/${productId}/moq-pricing`)
        .then((r) => r.data.data),
    enabled: !!productId,
  });

export const useCreateProductMoqPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi
        .post(`/products/${productId}/moq-pricing`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-product-moq-pricing", productId],
      }),
  });
};

export const useUpdateProductMoqPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi
        .put(`/products/${productId}/moq-pricing/${id}`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-product-moq-pricing", productId],
      }),
  });
};

export const useDeleteProductMoqPricing = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi
        .delete(`/products/${productId}/moq-pricing/${id}`)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-product-moq-pricing", productId],
      }),
  });
};

export const useAssignProductAttributes = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      attributes: {
        attributeId: string;
        required: boolean;
        gridAxis?: "ROW" | "COLUMN" | null;
        allowedValueIds: string[];
      }[],
    ) =>
      adminApi
        .post(`/products/${productId}/attributes`, { attributes })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-product-attributes", productId],
      });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
};

export const useRemoveProductAttribute = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attributeId: string) =>
      adminApi
        .delete(`/products/${productId}/attributes/${attributeId}`)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-product-attributes", productId],
      });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
    },
  });
};

export const useGenerateVariants = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      adminApi
        .post(`/products/${productId}/generate-variants`)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });
};

// ─── Categories ───────────────────────────────────────────

export const useAdminCategories = () =>
  useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminApi.get("/categories").then((r) => r.data.data),
  });

export const useAdminCategoryCountries = (categoryId?: string) =>
  useQuery({
    queryKey: ["admin-category-countries", categoryId],
    queryFn: () =>
      adminApi
        .get(`/categories/${categoryId}/countries`)
        .then((r) => r.data.data),
    enabled: !!categoryId,
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/categories", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/categories/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/categories/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
};

export const useDuplicateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/categories/${id}/duplicate`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
};

export const useArchiveCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/categories/${id}/archive`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
};

export const useRestoreCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/categories/${id}/restore`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
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
      adminApi
        .put(`/categories/${categoryId}/countries`, { items })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-category-countries", categoryId],
      }),
  });
};

export const useAdminCollections = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-collections", params],
    queryFn: () => adminApi.get("/collections", { params }).then((r) => r.data),
  });

export const useAdminCollection = (id?: string) =>
  useQuery({
    queryKey: ["admin-collection", id],
    queryFn: () => adminApi.get(`/collections/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useCreateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/collections", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }),
  });
};

export const useUpdateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/collections/${id}`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-collections"] });
      qc.invalidateQueries({ queryKey: ["admin-collection", vars.id] });
    },
  });
};

export const useDeleteCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/collections/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }),
  });
};

export const useArchiveCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/collections/${id}/archive`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }),
  });
};

export const useRestoreCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/collections/${id}/restore`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }),
  });
};

export const useDuplicateCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/collections/${id}/duplicate`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-collections"] }),
  });
};

export const useAdminCollectionCountries = (collectionId?: string) =>
  useQuery({
    queryKey: ["admin-collection-countries", collectionId],
    queryFn: () =>
      adminApi
        .get(`/collections/${collectionId}/countries`)
        .then((r) => r.data.data),
    enabled: !!collectionId,
  });

export const useUpdateCollectionCountries = (collectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) =>
      adminApi
        .put(`/collections/${collectionId}/countries`, { items })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin-collection-countries", collectionId],
      }),
  });
};

export const useAdminCollectionDiscounts = (collectionId?: string) =>
  useQuery({
    queryKey: ["admin-collection-discounts", collectionId],
    queryFn: () =>
      adminApi
        .get(`/collections/${collectionId}/discounts`)
        .then((r) => r.data.data),
    enabled: !!collectionId,
  });

export const useCreateCollectionDiscount = (collectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi
        .post(`/collections/${collectionId}/discounts`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-collection-discounts", collectionId],
      });
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
    },
  });
};

export const useDeleteCollectionDiscount = (collectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (discountId: string) =>
      adminApi
        .delete(`/collections/${collectionId}/discounts/${discountId}`)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-collection-discounts", collectionId],
      });
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
    mutationFn: (data: unknown) =>
      adminApi.post("/attributes", data).then((r) => r.data),
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
    mutationFn: (id: string) =>
      adminApi.delete(`/attributes/${id}`).then((r) => r.data),
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

// ─── Product Filters ────────────────────────────────────────

export interface ProductFilterConfig {
  id: string;
  featuredOnly: boolean;
  categoryFilterEnabled: boolean;
  attributeFilters: AttributeFilterConfig[];
}

export interface AttributeFilterConfig {
  attributeId: string;
  attributeName: string;
  enabled: boolean;
  displayType: "DROPDOWN" | "X_GRID" | "Y_GRID";
  sortOrder: number;
  allowedValueIds: string[];
}

export const useAdminProductFilters = () =>
  useQuery({
    queryKey: ["admin-product-filters"],
    queryFn: () => adminApi.get("/product-filters").then((r) => r.data.data),
  });

export const useUpdateProductFilters = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductFilterConfig) =>
      adminApi.put("/product-filters", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product-filters"] });
      qc.invalidateQueries({ queryKey: ["products", "filters-config"] });
    },
  });
};

export interface ProductFilterVisibilityItem {
  attributeId: string;
  attributeName: string;
  visibleOnStorefront: boolean;
}

export const useProductFilterVisibility = (productId?: string) =>
  useQuery({
    queryKey: ["admin-product-filter-visibility", productId],
    queryFn: () =>
      adminApi
        .get(`/product-filters/${productId}/visibility`)
        .then((r) => r.data.data as { productId: string; productTitle: string; items: ProductFilterVisibilityItem[] }),
    enabled: !!productId,
  });

export const useUpdateProductFilterVisibility = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ProductFilterVisibilityItem[]) =>
      adminApi
        .put(`/product-filters/${productId}/visibility`, { items })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-product-filter-visibility", productId] }),
  });
};

export const useCreateAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeId,
      ...data
    }: { attributeId: string } & Record<string, unknown>) =>
      adminApi
        .post(`/attributes/${attributeId}/values`, data)
        .then((r) => r.data),
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
      adminApi
        .put(`/attributes/${attributeId}/values/${valueId}`, data)
        .then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.attributeId] });
    },
  });
};

export const useDeleteAttributeValue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeId,
      valueId,
    }: {
      attributeId: string;
      valueId: string;
    }) =>
      adminApi
        .delete(`/attributes/${attributeId}/values/${valueId}`)
        .then((r) => r.data),
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
    }) =>
      adminApi
        .put(`/attributes/${attributeId}/values/reorder`, { items })
        .then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-attribute", vars.attributeId] });
      qc.invalidateQueries({ queryKey: ["admin-attributes"] });
    },
  });
};

// ─── Inventory ────────────────────────────────────────────

export const useAdminInventory = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-inventory", params],
    queryFn: () => adminApi.get("/inventory", { params }).then((r) => r.data),
  });

export const useAdminInventoryAdjustments = (params?: {
  page?: number;
  limit?: number;
  reason?: string;
  startDate?: string;
  endDate?: string;
}) =>
  useQuery({
    queryKey: ["admin-inventory-adjustments", params],
    queryFn: () =>
      adminApi.get("/inventory/adjustments", { params }).then((r) => r.data),
  });

export const useAdminVariantInventoryAdjustments = (
  variantId?: string,
  params?: { page?: number; limit?: number },
) =>
  useQuery({
    queryKey: ["admin-variant-inventory-adjustments", variantId, params],
    queryFn: () =>
      adminApi
        .get(`/inventory/${variantId}/adjustments`, { params })
        .then((r) => r.data),
    enabled: !!variantId,
  });

export const useAdminInventoryDashboard = () =>
  useQuery({
    queryKey: ["admin-inventory-dashboard"],
    queryFn: () =>
      adminApi.get("/inventory/dashboard").then((r) => r.data.data),
    staleTime: 60 * 1000,
  });

export const useAdminInventoryAlerts = () =>
  useQuery({
    queryKey: ["admin-inventory-alerts"],
    queryFn: () => adminApi.get("/inventory/alerts").then((r) => r.data.data),
    staleTime: 30 * 1000,
  });

export const useUpdateInventory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/inventory/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-adjustments"] });
      qc.invalidateQueries({
        queryKey: ["admin-variant-inventory-adjustments"],
      });
    },
  });
};

export const useBulkUpdateInventory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      stock?: number;
      lowStockThreshold?: number;
      adjustedBy?: string;
    }) => adminApi.post("/inventory/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory-adjustments"] });
      qc.invalidateQueries({
        queryKey: ["admin-variant-inventory-adjustments"],
      });
    },
  });
};

// ─── Pricing ─────────────────────────────────────────────

export const useAdminPricingDashboard = () =>
  useQuery({
    queryKey: ["admin-pricing-dashboard"],
    queryFn: () => adminApi.get("/pricing/dashboard").then((r) => r.data.data),
    staleTime: 60_000,
  });

export const useAdminPricing = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  ruleType?: string;
  productId?: string;
  variantId?: string;
  countryId?: string;
  tierId?: string;
  minQuantity?: string;
  sortBy?: string;
  sortDir?: string;
  ids?: string[];
}) =>
  useQuery({
    queryKey: ["admin-pricing", params],
    queryFn: () =>
      adminApi
        .get("/pricing", { params: { ...params, ids: params?.ids?.join(",") } })
        .then((r) => r.data),
  });

export const useCreatePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/pricing", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-dashboard"] });
    },
  });
};

export const useUpdatePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/pricing/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-dashboard"] });
    },
  });
};

export const useDeletePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/pricing/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-dashboard"] });
    },
  });
};

export const useDuplicatePricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/pricing/${id}/duplicate`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-dashboard"] });
    },
  });
};

export const useBulkPricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      ruleType: string;
      action: string;
      countryId?: string | null;
      tierId?: string | null;
    }) => adminApi.post("/pricing/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-dashboard"] });
    },
  });
};

export const usePreviewPricing = (params?: {
  productId?: string;
  variantId?: string;
  countryId?: string;
  quantity?: number;
  customerId?: string;
  customerRoleKey?: string;
  tierId?: string;
}) =>
  useQuery({
    queryKey: ["admin-pricing-preview", params],
    queryFn: () =>
      adminApi.get("/pricing/preview", { params }).then((r) => r.data.data),
    enabled: !!params?.productId && !!params?.countryId && !!params?.quantity,
  });

export const useExportPricing = () =>
  useMutation({
    mutationFn: (params?: Record<string, unknown>) =>
      adminApi
        .get("/pricing/export", { params, responseType: "blob" })
        .then((r) => r.data),
  });

export const usePreviewPricingImport = () =>
  useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/pricing/import/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
  });

export const useImportPricing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/pricing/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-dashboard"] });
    },
  });
};

// ─── Currencies & Countries ───────────────────────────────

export const useAdminTaxDashboard = () =>
  useQuery({
    queryKey: ["admin-tax-dashboard"],
    queryFn: () =>
      adminApi.get("/tax-rules/dashboard").then((r) => r.data.data),
    staleTime: 60_000,
  });

export const useAdminTaxPreview = (params?: {
  countryId?: string;
  subtotal?: number;
}) =>
  useQuery({
    queryKey: ["admin-tax-preview", params],
    queryFn: () =>
      adminApi.get("/tax-rules/preview", { params }).then((r) => r.data.data),
    enabled: !!params?.countryId && params.subtotal !== undefined,
  });

export const useAdminTaxRules = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  countryId?: string;
  status?: string;
  type?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-tax-rules", params],
    queryFn: () => adminApi.get("/tax-rules", { params }).then((r) => r.data),
  });

export const useCreateTaxRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/tax-rules", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tax-rules"] }),
  });
};

export const useUpdateTaxRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/tax-rules/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tax-rules"] }),
  });
};

export const useDeleteTaxRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/tax-rules/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tax-rules"] }),
  });
};

export const useBulkTaxRules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string }) =>
      adminApi.post("/tax-rules/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tax-rules"] });
      qc.invalidateQueries({ queryKey: ["admin-tax-dashboard"] });
    },
  });
};

export const useExportTaxRules = () =>
  useMutation({
    mutationFn: (params?: Record<string, unknown>) =>
      adminApi
        .get("/tax-rules/export", { params, responseType: "blob" })
        .then((r) => r.data),
  });

export const usePreviewTaxImport = () =>
  useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/tax-rules/import/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
  });

export const useImportTaxRules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/tax-rules/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tax-rules"] });
      qc.invalidateQueries({ queryKey: ["admin-tax-dashboard"] });
    },
  });
};

export const useAdminCurrencies = () =>
  useQuery({
    queryKey: ["admin-currencies"],
    queryFn: () => adminApi.get("/currencies/simple").then((r) => r.data.data),
  });

export const useAdminCurrenciesPaged = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-currencies-paged", params],
    queryFn: () => adminApi.get("/currencies", { params }).then((r) => r.data),
  });

export const useAdminCurrencyDashboard = () =>
  useQuery({
    queryKey: ["admin-currency-dashboard"],
    queryFn: () =>
      adminApi.get("/currencies/dashboard").then((r) => r.data.data),
    staleTime: 60_000,
  });

export const useCreateCurrency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/currencies", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
      qc.invalidateQueries({ queryKey: ["admin-currencies-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-currency-dashboard"] });
    },
  });
};

export const useUpdateCurrency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/currencies/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
      qc.invalidateQueries({ queryKey: ["admin-currencies-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-currency-dashboard"] });
    },
  });
};

export const useDeleteCurrency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/currencies/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
      qc.invalidateQueries({ queryKey: ["admin-currencies-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-currency-dashboard"] });
    },
  });
};

export const useBulkCurrencies = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      action: "ENABLE" | "DISABLE" | "DELETE";
    }) => adminApi.post("/currencies/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
      qc.invalidateQueries({ queryKey: ["admin-currencies-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-currency-dashboard"] });
    },
  });
};

export const useExportCurrencies = () =>
  useMutation({
    mutationFn: (params?: Record<string, unknown>) =>
      adminApi
        .get("/currencies/export", { params, responseType: "blob" })
        .then((r) => r.data),
  });

export const usePreviewCurrencyImport = () =>
  useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/currencies/import/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
  });

export const useImportCurrencies = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/currencies/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
      qc.invalidateQueries({ queryKey: ["admin-currencies-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-currency-dashboard"] });
    },
  });
};

export const useAdminCountries = () =>
  useQuery({
    queryKey: ["admin-countries"],
    queryFn: () => adminApi.get("/countries").then((r) => r.data.data),
  });

export const useBulkCountries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      action: "ENABLE" | "DISABLE" | "DELETE";
    }) => adminApi.post("/countries/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-countries"] });
    },
  });
};

export const useAdminTierDashboard = () =>
  useQuery({
    queryKey: ["admin-tier-dashboard"],
    queryFn: () => adminApi.get("/tiers/dashboard").then((r) => r.data.data),
    staleTime: 60_000,
  });

export const useAdminTiers = () =>
  useQuery({
    queryKey: ["admin-tiers"],
    queryFn: () => adminApi.get("/tiers/simple").then((r) => r.data.data),
  });

export const useAdminTiersPaged = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  countryId?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-tiers-paged", params],
    queryFn: () => adminApi.get("/tiers", { params }).then((r) => r.data),
  });

export const useCreateTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/tiers", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tiers"] });
      qc.invalidateQueries({ queryKey: ["admin-tiers-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-tier-dashboard"] });
    },
  });
};

export const useUpdateTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/tiers/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tiers"] });
      qc.invalidateQueries({ queryKey: ["admin-tiers-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-tier-dashboard"] });
    },
  });
};

export const useDeleteTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/tiers/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tiers"] });
      qc.invalidateQueries({ queryKey: ["admin-tiers-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-tier-dashboard"] });
    },
  });
};

export const useBulkTiers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      action: "ENABLE" | "DISABLE" | "DELETE";
    }) => adminApi.post("/tiers/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tiers"] });
      qc.invalidateQueries({ queryKey: ["admin-tiers-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-tier-dashboard"] });
    },
  });
};

export const useReorderTiers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      adminApi.put("/tiers/reorder", { items }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tiers"] });
      qc.invalidateQueries({ queryKey: ["admin-tiers-paged"] });
    },
  });
};

export const useExportTiers = () =>
  useMutation({
    mutationFn: (params?: Record<string, unknown>) =>
      adminApi
        .get("/tiers/export", { params, responseType: "blob" })
        .then((r) => r.data),
  });

export const usePreviewTierImport = () =>
  useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/tiers/import/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
  });

export const useImportTiers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/tiers/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tiers"] });
      qc.invalidateQueries({ queryKey: ["admin-tiers-paged"] });
      qc.invalidateQueries({ queryKey: ["admin-tier-dashboard"] });
    },
  });
};

export const useAdminTierCountries = (tierId?: string) =>
  useQuery({
    queryKey: ["admin-tier-countries", tierId],
    queryFn: () =>
      adminApi.get(`/tiers/${tierId}/countries`).then((r) => r.data.data),
    enabled: !!tierId,
  });

export const useUpdateTierCountries = (tierId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { countryId: string; enabled: boolean }[]) =>
      adminApi.put(`/tiers/${tierId}/countries`, { items }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tier-countries", tierId] });
      qc.invalidateQueries({ queryKey: ["admin-tier-dashboard"] });
    },
  });
};

export const useAdminCustomers = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerType?: string;
  approvalStatus?: string;
  customerRoleId?: string;
  tierId?: string;
  countryId?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-customers", params],
    queryFn: () => adminApi.get("/customers", { params }).then((r) => r.data),
  });

export const useAdminCustomerRoles = () =>
  useQuery({
    queryKey: ["admin-customer-roles"],
    queryFn: () => adminApi.get("/customer-roles").then((r) => r.data.data),
  });

export const useAdminCustomer = (id?: string) =>
  useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => adminApi.get(`/customers/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useAdminCustomerOrders = (id?: string) =>
  useQuery({
    queryKey: ["admin-customer-orders", id],
    queryFn: () =>
      adminApi.get(`/customers/${id}/orders`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useAdminCustomerAddresses = (id?: string) =>
  useQuery({
    queryKey: ["admin-customer-addresses", id],
    queryFn: () =>
      adminApi.get(`/customers/${id}/addresses`).then((r) => r.data.data),
    enabled: !!id,
  });

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
    mutationFn: ({
      id,
      customerRoleId,
    }: {
      id: string;
      customerRoleId: string;
    }) =>
      adminApi
        .put(`/customers/${id}/role`, { customerRoleId })
        .then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", vars.id] });
    },
  });
};

export const useApproveCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/customers/${id}/approve`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
    },
  });
};

export const useRejectCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/customers/${id}/reject`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
    },
  });
};

// ─── Coupons ─────────────────────────────────────────────

export const useAdminCoupons = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-coupons", params],
    queryFn: () => adminApi.get("/coupons", { params }).then((r) => r.data),
  });

export const useCreateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/coupons", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
};

export const useUpdateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/coupons/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
};

export const useDeleteCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/coupons/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
};

// ─── Quotes ──────────────────────────────────────────────

export const useAdminDiscountDashboard = () =>
  useQuery({
    queryKey: ["admin-discount-dashboard"],
    queryFn: () =>
      adminApi.get("/discounts/dashboard").then((r) => r.data.data),
    staleTime: 60_000,
  });

export const useAdminDiscounts = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  scope?: string;
  countryId?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-discounts", params],
    queryFn: () => adminApi.get("/discounts", { params }).then((r) => r.data),
  });

export const useCreateDiscount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/discounts", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      qc.invalidateQueries({ queryKey: ["admin-discount-dashboard"] });
    },
  });
};

export const useUpdateDiscount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/discounts/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      qc.invalidateQueries({ queryKey: ["admin-discount-dashboard"] });
    },
  });
};

export const useDeleteDiscount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/discounts/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      qc.invalidateQueries({ queryKey: ["admin-discount-dashboard"] });
    },
  });
};

export const useBulkDiscounts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: string[];
      action: "ENABLE" | "DISABLE" | "DELETE";
    }) => adminApi.post("/discounts/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      qc.invalidateQueries({ queryKey: ["admin-discount-dashboard"] });
    },
  });
};

export const useExportDiscounts = () =>
  useMutation({
    mutationFn: (params?: Record<string, unknown>) =>
      adminApi
        .get("/discounts/export", { params, responseType: "blob" })
        .then((r) => r.data),
  });

export const usePreviewDiscountImport = () =>
  useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/discounts/import/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
  });

export const useImportDiscounts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      adminApi
        .post("/discounts/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
      qc.invalidateQueries({ queryKey: ["admin-discount-dashboard"] });
    },
  });
};

// ─── Blogs ────────────────────────────────────────────────

export const useAdminBlogs = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  categoryId?: string;
  authorId?: string;
  search?: string;
}) =>
  useQuery({
    queryKey: ["admin-blogs", params],
    queryFn: () => adminApi.get("/blogs", { params }).then((r) => r.data),
  });

export const useAdminBlog = (id?: string) =>
  useQuery({
    queryKey: ["admin-blog", id],
    queryFn: () => adminApi.get(`/blogs/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useCreateBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/blogs", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }),
  });
};

export const useUpdateBlog = (id?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.put(`/blogs/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] });
      qc.invalidateQueries({ queryKey: ["admin-blog", id] });
    },
  });
};

export const useDeleteBlog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/blogs/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }),
  });
};

export const useBulkBlogs = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string }) =>
      adminApi.post("/blogs/bulk", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }),
  });
};

export const useAdminBlogCategories = () =>
  useQuery({
    queryKey: ["admin-blog-categories"],
    queryFn: () => adminApi.get("/blogs/categories").then((r) => r.data.data),
  });

export const useCreateBlogCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/blogs/categories", data).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-blog-categories"] }),
  });
};

export const useUpdateBlogCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/blogs/categories/${id}`, data).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-blog-categories"] }),
  });
};

export const useDeleteBlogCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/blogs/categories/${id}`).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-blog-categories"] }),
  });
};

export const useAdminBlogAuthors = () =>
  useQuery({
    queryKey: ["admin-blog-authors"],
    queryFn: () => adminApi.get("/blogs/authors").then((r) => r.data.data),
  });

export const useCreateBlogAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/blogs/authors", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-authors"] }),
  });
};

export const useUpdateBlogAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/blogs/authors/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-authors"] }),
  });
};

export const useDeleteBlogAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/blogs/authors/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-authors"] }),
  });
};

// ─── Banners ──────────────────────────────────────────────

export const useAdminBanners = (params?: {
  placement?: string;
  countryId?: string;
  status?: string;
}) =>
  useQuery({
    queryKey: ["admin-banners", params],
    queryFn: () =>
      adminApi.get("/banners", { params }).then((r) => r.data.data),
  });

export const useCreateBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/banners", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
};

export const useUpdateBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/banners/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
};

export const useDeleteBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/banners/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
};

export const useReorderBanners = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      adminApi.put("/banners/reorder", { ids }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
};

export const useBulkBanners = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string }) =>
      adminApi.post("/banners/bulk", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
};

export const useAdminQuotes = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-quotes", params],
    queryFn: () => adminApi.get("/quotes", { params }).then((r) => r.data),
  });

export const useDeleteAdminQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/quotes/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-quotes"] }),
  });
};

export const useAdminContactSubmissions = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-contact-submissions", params],
    queryFn: () =>
      adminApi.get("/contact-submissions", { params }).then((r) => r.data),
  });

export const useAdminContactSubmission = (id?: string) =>
  useQuery({
    queryKey: ["admin-contact-submission", id],
    queryFn: () =>
      adminApi.get(`/contact-submissions/${id}`).then((res) => res.data.data),
    enabled: !!id,
  });

export const useCreateQuote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/quotes", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-quotes"] }),
  });
};

export const useAdminQuote = (id: string) =>
  useQuery({
    queryKey: ["admin-quote", id],
    queryFn: () => adminApi.get(`/quotes/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useUpdateQuoteStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.put(`/quotes/${id}/status`, { status }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote", id] });
    },
  });
};

export const useUpdateQuoteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/quotes/${id}/review`, data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote", vars.id] });
    },
  });
};

export const useConvertQuoteToOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/quotes/${id}/convert-to-order`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
};

// ─── Orders ──────────────────────────────────────────────

export const useAdminOrders = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  search?: string;
  countryId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
}) =>
  useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => adminApi.get("/orders", { params }).then((r) => r.data),
  });

export const useCreateAdminOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/orders", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });
};

export const useOrderAnalytics = () =>
  useQuery({
    queryKey: ["admin-order-analytics"],
    queryFn: () => adminApi.get("/orders/analytics").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

export const useAdminOrder = (id: string) =>
  useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => adminApi.get(`/orders/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useDeleteAdminOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/orders/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order-analytics"] });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.put(`/orders/${id}/status`, { status }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    },
  });
};

export const useShipOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      shippingProvider,
      trackingNumber,
    }: {
      id: string;
      shippingProvider: string;
      trackingNumber: string;
    }) =>
      adminApi.post(`/orders/${id}/ship`, { shippingProvider, trackingNumber }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    },
  });
};

export const useDeliverOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.post(`/orders/${id}/deliver`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    },
  });
};

// ─── Shipping Providers ──────────────────────────────────

export const useAdminShippingProviders = () =>
  useQuery({
    queryKey: ["admin-shipping-providers"],
    queryFn: () => adminApi.get("/shipping/providers").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

export const useAdminShippingProvider = (id: string) =>
  useQuery({
    queryKey: ["admin-shipping-provider", id],
    queryFn: () => adminApi.get(`/shipping/providers/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useUpsertShippingProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminApi.post("/shipping/providers", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipping-providers"] }),
  });
};

export const useToggleShippingProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/shipping/providers/${id}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipping-providers"] }),
  });
};

export const useTestShippingConnection = () =>
  useMutation({
    mutationFn: (id: string) =>
      adminApi.post(`/shipping/providers/${id}/test-connection`).then((r) => r.data.data),
  });

// ─── Shipping Zones ──────────────────────────────────────

export const useAdminShippingZones = (params?: { providerId?: string; countryId?: string; status?: string }) =>
  useQuery({
    queryKey: ["admin-shipping-zones", params],
    queryFn: () => adminApi.get("/shipping/zones", { params }).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

export const useCreateShippingZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminApi.post("/shipping/zones", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] }),
  });
};

export const useUpdateShippingZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/shipping/zones/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] }),
  });
};

export const useDeleteShippingZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/shipping/zones/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] }),
  });
};

// ─── Shipments ──────────────────────────────────────────

export const useAdminShipments = (params?: { orderId?: string; status?: string; providerId?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: ["admin-shipments", params],
    queryFn: () => adminApi.get("/shipping/shipments", { params }).then((r) => r.data),
    staleTime: 30_000,
  });

export const useAdminShipment = (id: string) =>
  useQuery({
    queryKey: ["admin-shipment", id],
    queryFn: () => adminApi.get(`/shipping/shipments/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useOrderShipments = (orderId: string) =>
  useQuery({
    queryKey: ["admin-order-shipments", orderId],
    queryFn: () => adminApi.get(`/shipping/order/${orderId}`).then((r) => r.data.data),
    enabled: !!orderId,
  });

export const useCreateShipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.post("/shipping/shipments", data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
      if ((vars as { orderId?: string }).orderId) qc.invalidateQueries({ queryKey: ["admin-order-shipments", (vars as { orderId?: string }).orderId] });
    },
  });
};

export const useUpdateShipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => adminApi.put(`/shipping/shipments/${id}`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
      qc.invalidateQueries({ queryKey: ["admin-shipment", vars.id] });
    },
  });
};

export const useUpdateShipmentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; location?: string; description?: string }) =>
      adminApi.post(`/shipping/shipments/${id}/status`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
      qc.invalidateQueries({ queryKey: ["admin-shipment", vars.id] });
    },
  });
};

export const useTrackShipment = () =>
  useMutation({
    mutationFn: (id: string) => adminApi.post(`/shipping/shipments/${id}/track`).then((r) => r.data.data),
  });

export const useDeleteShipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/shipping/shipments/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipments"] }),
  });
};

export const useCancelShipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.post(`/shipping/shipments/${id}/cancel`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
    },
  });
};

// ─── Media ───────────────────────────────────────────────

export const useAdminMedia = (params?: { page?: number }) =>
  useQuery({
    queryKey: ["admin-media", params],
    queryFn: () => adminApi.get("/media", { params }).then((r) => r.data),
  });

// ─── Languages ───────────────────────────────────────────

export const useAdminLanguages = () =>
  useQuery({
    queryKey: ["admin-languages"],
    queryFn: () =>
      adminApi.get("/translations/languages").then((r) => r.data.data),
  });

// ─── Users & Roles ───────────────────────────────────────

export const useAdminUsers = () =>
  useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.get("/users").then((r) => r.data.data),
  });

export const useAdminRoles = () =>
  useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => adminApi.get("/roles").then((r) => r.data.data),
  });

export const useCreateCustomerRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/customer-roles", data).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-customer-roles"] }),
  });
};

export const useUpdateCustomerRoleAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/customer-roles/${id}`, data).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-customer-roles"] }),
  });
};

export const useDeleteCustomerRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete(`/customer-roles/${id}`).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-customer-roles"] }),
  });
};

// ─── Settings ────────────────────────────────────────────

export const useAdminSettings = (group?: string) =>
  useQuery({
    queryKey: ["admin-settings", group],
    queryFn: () =>
      adminApi.get("/settings", { params: { group } }).then((r) => r.data.data),
  });

// ─── Logs ────────────────────────────────────────────────

export const useAdminLogs = (params?: {
  page?: number;
  entityType?: string;
  action?: string;
}) =>
  useQuery({
    queryKey: ["admin-logs", params],
    queryFn: () => adminApi.get("/logs", { params }).then((r) => r.data),
  });

// ─── CMS ─────────────────────────────────────────────────

export const useAdminCmsPages = (params?: { page?: number; status?: string }) =>
  useQuery({
    queryKey: ["admin-cms-pages", params],
    queryFn: () => adminApi.get("/cms/pages", { params }).then((r) => r.data),
  });

export const useAdminCmsPage = (id: string) =>
  useQuery({
    queryKey: ["admin-cms-page", id],
    queryFn: () => adminApi.get(`/cms/pages/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

export const useCreateCmsPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.post("/cms/pages", data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }),
  });
};

export const useUpdateCmsPage = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.put(`/cms/pages/${id}`, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      qc.invalidateQueries({ queryKey: ["admin-cms-page", id] });
    },
  });
};

export const useDeleteCmsPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/cms/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }),
  });
};

export const useCreateCmsSection = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi
        .post(`/cms/pages/${pageId}/sections`, data)
        .then((r) => r.data.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useUpdateCmsSection = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/cms/sections/${id}`, data).then((r) => r.data.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useDeleteCmsSection = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/cms/sections/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useReorderCmsSections = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      adminApi.put(`/cms/pages/${pageId}/sections/reorder`, { orderedIds }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useCreateCmsBlock = (pageId: string, sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi
        .post(`/cms/sections/${sectionId}/blocks`, data)
        .then((r) => r.data.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useUpdateCmsBlock = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      adminApi.put(`/cms/blocks/${id}`, data).then((r) => r.data.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useDeleteCmsBlock = (pageId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/cms/blocks/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-cms-page", pageId] }),
  });
};

export const useAdminCmsFooter = () =>
  useQuery({
    queryKey: ["admin-cms-footer"],
    queryFn: () => adminApi.get("/cms/footer").then((r) => r.data.data),
  });

export const useUpsertCmsFooter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      adminApi.put("/cms/footer", data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-footer"] }),
  });
};

export const useAdminCmsMenus = () =>
  useQuery({
    queryKey: ["admin-cms-menus"],
    queryFn: () => adminApi.get("/cms/menus").then((r) => r.data.data),
  });

export const useAddQuoteNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminApi.post(`/quotes/${id}/notes`, { note }).then((r) => r.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-quote", id] });
    },
  });
};

// ─── Warehouses ───────────────────────────────────────────

export const useAdminWarehouses = (params?: { page?: number; limit?: number; search?: string }) =>
  useQuery({
    queryKey: ["admin-warehouses", params],
    queryFn: () => adminApi.get("/warehouses", { params }).then((r) => r.data),
  });

export const useCreateWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.post("/warehouses", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-warehouses"] }),
  });
};

export const useUpdateWarehouse = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.put(`/warehouses/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-warehouses"] }),
  });
};

export const useDeleteWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.delete(`/warehouses/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-warehouses"] }),
  });
};

