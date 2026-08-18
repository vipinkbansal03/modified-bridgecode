"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { STALE } from "@/lib/queryConfig";
import type { BlogItem } from "@/types/blog.types";

export type ApiBlog = {
  id?: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  tags?: string[];
  author?: { name: string } | null;
  category?: { id?: string; name: string; slug?: string } | null;
};

function formatBlogDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function toBlogItem(blog: ApiBlog, index: number = 0): BlogItem {
  return {
    image: blog.featuredImage?.trim() || "",
    title: blog.title,
    excerpt: blog.excerpt || "",
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
  const apiParams: Record<string, string | number> = { limit: params?.limit ?? 12 };
  if (params?.search?.trim()) apiParams.search = params.search.trim();
  if (params?.categoryId) apiParams.categoryId = params.categoryId;
  if (params?.page) apiParams.page = params.page;

  const response = await apiClient.get("/blogs", { params: apiParams });
  const blogs = (response.data.data ?? []) as ApiBlog[];
  return blogs.map(toBlogItem);
}

export function useBlogs(params?: BlogQueryParams) {
  return useQuery({
    queryKey: ["blogs", params],
    queryFn: () => fetchBlogs(params),
    staleTime: STALE.short,
  });
}

