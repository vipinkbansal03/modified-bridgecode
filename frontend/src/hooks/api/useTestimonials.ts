"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryConfig";

async function fetchTestimonials() {
  const { default: raw } = await import("@/data/testimonials.json");
  return raw;
}

export function useTestimonials() {
  return useQuery({ queryKey: ["testimonials"], queryFn: fetchTestimonials, staleTime: STALE.never });
}
