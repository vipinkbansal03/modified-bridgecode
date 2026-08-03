"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API } from "@/lib/apiClient";

type NewsletterInput = string | { email: string };

async function submitNewsletter(input: NewsletterInput): Promise<{ success: boolean; alreadyActive?: boolean }> {
  const email = typeof input === "string" ? input : input.email;
  if (!HAS_LIVE_API) {
    await new Promise((r) => setTimeout(r, 400));
    return { success: true, alreadyActive: false };
  }
  const response = await apiClient.post("/newsletter/subscribe", { email });
  const alreadyActive = !!response.data?.data?.alreadyActive;
  return { success: true, alreadyActive };
}

export function useNewsletterSubmit() {
  return useMutation({ mutationFn: submitNewsletter });
}
