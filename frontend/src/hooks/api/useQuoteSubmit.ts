"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API } from "@/lib/apiClient";
import type { ApiQuoteSubmit } from "@/types/api.types";

export interface QuoteResult {
  quoteNumber: string;
}

async function submitQuote(data: ApiQuoteSubmit): Promise<QuoteResult> {
  if (!HAS_LIVE_API) {
    await new Promise((r) => setTimeout(r, 700));
    return { quoteNumber: `QUO-DEMO-${Date.now()}` };
  }
  const customerToken = typeof window !== "undefined" ? window.localStorage.getItem("customer_token") : null;
  const res = await apiClient.post("/quotes", data, {
    headers: customerToken ? { Authorization: `Bearer ${customerToken}` } : undefined,
  });
  return res.data.data as QuoteResult;
}

/** Submit a bulk quote request. Returns the generated quote number on success. */
export function useQuoteSubmit() {
  return useMutation({ mutationFn: submitQuote });
}
