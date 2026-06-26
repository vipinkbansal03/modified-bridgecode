"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, unwrapData } from "@/lib/apiClient";
import type { LoginFormValues } from "@/validations/login.validation";

interface CustomerUser {
  id: string;
  name: string;
  email: string;
  role: { name: string };
}

async function loginCustomer(values: LoginFormValues) {
  const response = await apiClient.post("/auth/login", values);
  return unwrapData<CustomerUser>(response);
}

async function logoutCustomer() {
  const response = await apiClient.post("/auth/logout");
  return response.data;
}

async function getCustomerMe() {
  const response = await apiClient.get("/auth/me");
  return unwrapData<CustomerUser>(response);
}

export function useCustomerLogin() {
  return useMutation({ mutationFn: loginCustomer });
}

export function useCustomerLogout() {
  return useMutation({ mutationFn: logoutCustomer });
}

export function useCustomerMe() {
  return useQuery({
    queryKey: ["customer", "me"],
    queryFn: getCustomerMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export { getCustomerMe };
