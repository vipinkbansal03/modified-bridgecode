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

async function fetchBlogs(): Promise<BlogItem[]> {
  const { default: raw } = await import("@/data/blogs.json");
  const fallbackBlogs = (raw as BlogItem[]).map((blog, index) => ({
    ...blog,
    url: `/blog/${blog.slug}`,
    primary: index === 0,
  }));

  if (!HAS_LIVE_API) return fallbackBlogs;

  try {
    const response = await apiClient.get("/blogs", { params: { limit: 12 } });
    const blogs = (response.data.data ?? []) as ApiBlog[];
    if (!blogs.length) return fallbackBlogs;
    return blogs.map(toBlogItem);
  } catch {
    return fallbackBlogs;
  }
}

export function useBlogs() {
  return useQuery({ queryKey: ["blogs"], queryFn: fetchBlogs, staleTime: STALE.long });
}
