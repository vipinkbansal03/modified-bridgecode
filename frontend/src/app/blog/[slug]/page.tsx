"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/ui/Container";
import fallbackBlogData from "@/data/blogs.json";
import { apiClient } from "@/lib/apiClient";
import type { BlogItem } from "@/types/blog.types";

const fallbackBlogs = fallbackBlogData as BlogItem[];

type ApiBlog = {
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  tags?: string[];
  author?: { name: string } | null;
  category?: { name: string } | null;
};

function formatBlogDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function fetchBlog(slug: string) {
  const fallbackBlog = fallbackBlogs.find((blog) => blog.slug === slug);
  if (fallbackBlog) {
    return {
      title: fallbackBlog.title,
      slug: fallbackBlog.slug,
      content: fallbackBlog.excerpt,
      excerpt: fallbackBlog.excerpt,
      featuredImage: fallbackBlog.image,
      publishedAt: fallbackBlog.date,
      category: { name: fallbackBlog.category },
      author: { name: "Modern Orthodontics" },
    } satisfies ApiBlog;
  }

  try {
    const response = await apiClient.get(`/blogs/${slug}`);
    return response.data.data as ApiBlog;
  } catch {
    throw new Error("Blog not found");
  }
}

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const {
    data: blog,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => fetchBlog(slug),
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return (
      <main className="bg-white py-16">
        <Container>
          <div className="mx-auto max-w-[920px] animate-pulse">
            <div className="mb-6 h-4 w-28 rounded bg-[#ECECEC]" />
            <div className="h-12 w-3/4 rounded bg-[#ECECEC]" />
            <div className="mt-6 h-[420px] rounded-3xl bg-[#ECECEC]" />
          </div>
        </Container>
      </main>
    );
  }

  if (isError || !blog) {
    return (
      <main className="bg-white py-20">
        <Container>
          <div className="mx-auto max-w-[640px] rounded-2xl border border-line bg-[#FAFAFA] p-8 text-center">
            <h1 className="text-[28px] font-semibold text-ink">
              Blog not found
            </h1>
            <p className="mt-2 text-[14px] text-steel">
              This article may have been removed or unpublished.
            </p>
            <Link
              href="/blog"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E31E24] px-5 py-3 text-[13px] font-semibold text-white"
            >
              <ArrowLeft size={14} />
              Back to blog
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  const date = formatBlogDate(blog.publishedAt || blog.createdAt);
  const paragraphs = blog.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const recentArticles = fallbackBlogs
    .filter((item) => item.slug !== blog.slug)
    .slice(0, 3)
    .map((item) => ({ ...item, url: `/blog/${item.slug}` }));

  return (
    <main className="bg-white">
      <section className="border-b border-line bg-white">
        <Container className="py-16 lg:py-20">
          <div className="max-w-[760px]">
            <Link
              href="/blog"
              className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-steel hover:text-brand"
            >
              <ArrowLeft size={14} />
              Back to blog
            </Link>
            <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
              {(
                blog.category?.name ||
                blog.tags?.[0] ||
                "Resources"
              ).toUpperCase()}
            </span>
            <h1 className="max-w-[640px] break-words text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
              {blog.title}
            </h1>

            {blog.excerpt && (
              <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel">
                {blog.excerpt}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-5 text-[13px] text-steel">
              {date && (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={15} />
                  {date}
                </span>
              )}

              {blog.author?.name && (
                <span>
                  By{" "}
                  <span className="font-medium text-ink">
                    {blog.author.name}
                  </span>
                </span>
              )}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <article className="min-w-0">
              {blog.featuredImage && (
                <div className="relative mb-10 h-[320px] overflow-hidden rounded-3xl bg-grey sm:h-[460px]">
                  <Image
                    src={blog.featuredImage}
                    alt={blog.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 820px, 100vw"
                    priority
                  />
                </div>
              )}

              <div className="max-w-[760px] space-y-6 text-[16px] leading-8 text-[#444]">
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </article>

            <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-line bg-[#FAFAFA] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#E31E24]">
                  Article details
                </p>
                <div className="mt-5 space-y-4 text-[13px] text-steel">
                  {date && (
                    <div className="flex items-start gap-3">
                      <CalendarDays
                        size={16}
                        className="mt-0.5 text-[#E31E24]"
                      />
                      <div>
                        <p className="font-semibold text-ink">Published</p>
                        <p>{date}</p>
                      </div>
                    </div>
                  )}
                  {blog.author?.name && (
                    <div className="flex items-start gap-3">
                      <UserRound size={16} className="mt-0.5 text-[#E31E24]" />
                      <div>
                        <p className="font-semibold text-ink">Author</p>
                        <p>{blog.author.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#E31E24]">
                  Category
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#E31E24]/15 bg-[#E31E24]/5 px-3 py-1.5 text-[12px] font-semibold text-[#E31E24]">
                    {blog.category?.name || blog.tags?.[0] || "Resources"}
                  </span>
                  {blog.tags?.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-line px-3 py-1.5 text-[12px] text-steel"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {recentArticles.length > 0 && (
                <div className="rounded-2xl border border-line bg-white p-5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#E31E24]">
                    Recent articles
                  </p>
                  <div className="mt-4 space-y-4">
                    {recentArticles.map((article) => (
                      <Link
                        key={article.slug}
                        href={article.url}
                        className="group block border-b border-line pb-4 last:border-0 last:pb-0"
                      >
                        <p className="break-words text-[13px] font-semibold leading-snug text-ink group-hover:text-[#E31E24]">
                          {article.title}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-steel group-hover:text-[#E31E24]">
                          Read article
                          <ArrowRight size={12} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </Container>
      </section>
    </main>
  );
}
