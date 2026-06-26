"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, unwrapData } from "@/lib/apiClient";
import type { RegisterFormValues } from "@/validations/register.validation";

interface RegisterPayload {
  accountType: "DEALER" | "DOCTOR_RETAILER";
  name: string;
  email: string;
  phone: string;
  password: string;
  companyName?: string;
  website?: string;
  preferredPrescription?: "MBT" | "ROTH" | "OTHER";
  address: {
    countryCode: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

interface RegisteredCustomer {
  id: string;
  name: string;
  email: string;
  role: { name: string };
}

async function registerCustomer(values: RegisterFormValues) {
  const { confirmPassword: _confirmPassword, ...payload } = values;

  const cleanPayload: RegisterPayload = {
    ...payload,
    accountType: payload.accountType as RegisterPayload["accountType"],
    companyName: payload.companyName || undefined,
    website: payload.website || undefined,
    preferredPrescription: payload.preferredPrescription || undefined,
    address: {
      ...payload.address,
      addressLine2: payload.address.addressLine2 || undefined,
    },
  };

  const response = await apiClient.post("/auth/register", cleanPayload);
  return unwrapData<RegisteredCustomer>(response);
}

export function useCustomerRegister() {
  return useMutation({ mutationFn: registerCustomer });
}
