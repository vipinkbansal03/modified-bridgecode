"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API } from "@/lib/apiClient";
import { STALE } from "@/lib/queryConfig";
import type { BlogItem } from "@/types/blog.types";

type ApiBlog = {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  tags?: string[];
  category?: { name: string } | null;
};

function formatBlogDate(value?: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toBlogItem(blog: ApiBlog, index: number): BlogItem {
  return {
    image: blog.featuredImage || "/auth/login2.jpg",
    title: blog.title,
    excerpt: blog.excerpt || "Read the latest update from Modern Orthodontics.",
    date: formatBlogDate(blog.publishedAt || blog.createdAt),
    category: blog.category?.name || blog.tags?.[0] || "Resources",
    slug: blog.slug,
    url: `/blog/${blog.slug}`,
    ctaLabel: "Read article",
    primary: index === 0,
  };
}

export type BlogQueryParams = {
  search?: string;
  categoryId?: string;
  limit?: number;
  page?: number;
};

async function fetchBlogs(params?: BlogQueryParams): Promise<BlogItem[]> {
  const { default: raw } = await import("@/data/blogs.json");
  let fallbackBlogs = (raw as BlogItem[]).map((blog, index) => ({
    ...blog,
    url: `/blog/${blog.slug}`,
    primary: index === 0,
  }));

  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    fallbackBlogs = fallbackBlogs.filter(
      (b) => b.title.toLowerCase().includes(q) || b.excerpt.toLowerCase().includes(q)
    );
  }

  if (!HAS_LIVE_API) return fallbackBlogs;

  try {
    const apiParams: Record<string, string | number> = { limit: params?.limit ?? 12 };
    if (params?.search?.trim()) apiParams.search = params.search.trim();
    if (params?.categoryId) apiParams.categoryId = params.categoryId;
    if (params?.page) apiParams.page = params.page;

    const response = await apiClient.get("/blogs", { params: apiParams });
    const blogs = (response.data.data ?? []) as ApiBlog[];

    if (blogs.length > 0) {
      return blogs.map(toBlogItem);
    }

    return fallbackBlogs;
  } catch {
    return fallbackBlogs;
  }
}

export function useBlogs(params?: BlogQueryParams) {
  return useQuery({
    queryKey: ["blogs", params],
    queryFn: () => fetchBlogs(params),
    staleTime: STALE.short,
  });
}
