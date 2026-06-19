"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API } from "@/lib/apiClient";

// Accept the form's shape { email: string } OR a plain string
type NewsletterInput = string | { email: string };

async function submitNewsletter(input: NewsletterInput): Promise<{ success: boolean }> {
  const email = typeof input === "string" ? input : input.email;
  if (!HAS_LIVE_API) {
    await new Promise((r) => setTimeout(r, 400));
    return { success: true };
  }
  await apiClient.post("/contact", { name: email, email, message: "Newsletter signup", type: "general" });
  return { success: true };
}

export function useNewsletterSubmit() {
  return useMutation({ mutationFn: submitNewsletter });
}
