"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API } from "@/lib/apiClient";
import type { ApiContactSubmit } from "@/types/api.types";

async function submitContact(data: ApiContactSubmit): Promise<{ success: boolean; message: string }> {
  if (!HAS_LIVE_API) {
    await new Promise((r) => setTimeout(r, 600));
    return { success: true, message: "Message received. We'll respond within 24 hours." };
  }
  const res = await apiClient.post("/contact", data);
  return res.data;
}

/** Contact / dealer inquiry form submission. */
export function useContactSubmit() {
  return useMutation({ mutationFn: submitContact });
}
