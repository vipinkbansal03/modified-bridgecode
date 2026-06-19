"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API } from "@/lib/apiClient";
import type { DealerFormValues } from "@/validations/dealer.validation";

async function submitDealerInquiry(data: DealerFormValues): Promise<{ success: boolean; message: string }> {
  if (!HAS_LIVE_API) {
    await new Promise((r) => setTimeout(r, 600));
    return { success: true, message: "Dealer inquiry received. We will respond within 24 hours." };
  }
  // Map DealerFormValues → backend contact payload
  const payload = {
    name: data.contactPerson,
    email: data.email,
    phone: data.phone,
    company: data.companyName,
    message: `[${data.businessType.toUpperCase()}] ${data.city}, ${data.state}${data.gstNumber ? " | GST: " + data.gstNumber : ""}\n\n${data.message}`,
    type: "dealer" as const,
  };
  const res = await apiClient.post("/dealer-inquiry", payload);
  return res.data;
}

/** Dealer / distributor inquiry form. Accepts the form's own DealerFormValues shape. */
export function useDealerInquiry() {
  return useMutation({ mutationFn: submitDealerInquiry });
}
