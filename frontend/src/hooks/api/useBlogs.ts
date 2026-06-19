"use client";

import { useQuery } from "@tanstack/react-query";
import { HAS_LIVE_API } from "@/lib/apiClient";
import { STALE } from "@/lib/queryConfig";
import type { BlogItem } from "@/types/blog.types";

// Blogs are currently external links to modortho.com — static only until a CMS is wired.
async function fetchBlogs(): Promise<BlogItem[]> {
  const { default: raw } = await import("@/data/blogs.json");
  return raw as BlogItem[];
}

export function useBlogs() {
  return useQuery({ queryKey: ["blogs"], queryFn: fetchBlogs, staleTime: STALE.long });
}
