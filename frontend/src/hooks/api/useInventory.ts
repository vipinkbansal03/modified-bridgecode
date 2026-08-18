"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import type { ApiInventoryCheck } from "@/types/api.types";

async function fetchInventory(variantIds: string[]): Promise<ApiInventoryCheck[]> {
  if (!HAS_LIVE_API || !variantIds.length) return [];
  const res = await apiClient.get("/inventory", { params: { variantIds: variantIds.join(",") } });
  return unwrapData<ApiInventoryCheck[]>(res);
}

/** Check real-time inventory for one or more variant IDs. */
export function useInventoryCheck(variantIds: string[]) {
  return useQuery({
    queryKey: qk.inventory.check(variantIds),
    queryFn: () => fetchInventory(variantIds),
    enabled: variantIds.length > 0 && HAS_LIVE_API,
    staleTime: STALE.short,
  });
}
