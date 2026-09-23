"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { STALE } from "@/lib/queryConfig";

export interface TestimonialItem {
  name: string;
  quote: string;
  image?: string;
}

async function fetchTestimonials(): Promise<TestimonialItem[]> {
  try {
    const res = await apiClient.get("/cms/pages/key/testimonials");
    const page = res.data?.data;
    if (page && Array.isArray(page.sections)) {
      const listSec = page.sections.find((s: any) => s.sectionKey === "testimonials.list" || s.sectionKey.includes("list") || s.sectionKey.includes("card"));
      if (listSec && Array.isArray(listSec.blocks) && listSec.blocks.length > 0) {
        const activeBlocks = listSec.blocks.filter((b: any) => b.status !== "INACTIVE");
        if (activeBlocks.length > 0) {
          return activeBlocks.map((b: any) => ({
            name: b.title || "Orthodontic Specialist",
            quote: b.description || "",
            image: b.image || undefined,
          }));
        }
      }
    }
  } catch {
    // Fallback to static JSON
  }

  const { default: raw } = await import("@/data/testimonials.json");
  return raw as TestimonialItem[];
}

export function useTestimonials() {
  return useQuery({ queryKey: ["testimonials"], queryFn: fetchTestimonials, staleTime: STALE.medium });
}

