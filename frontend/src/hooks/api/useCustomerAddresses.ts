"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import type { CustomerAddress } from "@/types/delivery.types";

async function fetchCustomerAddresses(): Promise<CustomerAddress[]> {
  const res = await apiClient.get("/customer/addresses");
  return unwrapData<CustomerAddress[]>(res);
}

export function useCustomerAddresses() {
  const { currentCustomer, isLoading: isAuthLoading } = useCustomerAuth();
  const isAuthenticated = Boolean(currentCustomer);

  return useQuery({
    queryKey: qk.customerAddresses.all,
    queryFn: fetchCustomerAddresses,
    enabled: !isAuthLoading && isAuthenticated,
    staleTime: STALE.medium,
  });
}