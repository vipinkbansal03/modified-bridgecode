"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import type { CustomerAddress } from "@/types/delivery.types";

async function fetchCustomerAddresses(): Promise<CustomerAddress[]> {
  const res = await apiClient.get("/customer-addresses");
  return unwrapData<CustomerAddress[]>(res);
}

export function useCustomerAddresses() {
  return useQuery({
    queryKey: qk.customerAddresses.all,
    queryFn: fetchCustomerAddresses,
    staleTime: STALE.short,
  });
}