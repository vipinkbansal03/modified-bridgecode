"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useBlogs } from "@/hooks/api/useBlogs";

export default function BlogPage() {
  const { data: blogs = [], isLoading } = useBlogs();
  const featuredBlog = blogs[0];
  const otherBlogs = blogs.slice(1);

  return (
    <main className="bg-white">
      <section className="border-b border-line bg-white">
        <Container className="py-16 lg:py-20">
          <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
            Resources
          </span>

          <h1 className="max-w-[50%] text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
            Orthodontic insights, product updates and industry notes.
          </h1>

          <p className="mt-4 max-w-[50%] text-[15.5px] leading-relaxed text-steel">
            Explore practical articles from Modern Orthodontics around products,
            clinical trends, manufacturing, and better buying decisions for
            dental professionals.
          </p>
        </Container>
      </section>

      <section className="py-14 lg:py-20">
        <Container>
          <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#E31E24]">
                Latest articles
              </p>
              <h2 className="mt-2 text-[28px] font-semibold text-ink">
                From the blog
              </h2>
            </div>
            <div className="flex h-11 w-full items-center gap-2 rounded-full border border-line bg-white px-4 text-steel sm:w-[320px]">
              <Search size={15} />
              <span className="text-[13px]">Search coming soon</span>
            </div>
          </div>

          {isLoading ? (
            <SkeletonGrid count={6} columns={3} />
          ) : blogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-[#FAFAFA] px-6 py-14 text-center">
              <h3 className="text-[22px] font-semibold text-ink">
                No blog posts yet
              </h3>
              <p className="mt-2 text-[14px] text-steel">
                Published blog posts will appear here once added from the admin
                panel.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {featuredBlog && (
                <Link
                  href={featuredBlog.url}
                  className="group grid overflow-hidden rounded-3xl border border-line bg-white shadow-[0_18px_55px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1 lg:grid-cols-[1.08fr_0.92fr]"
                >
                  <div className="relative min-h-[320px] bg-grey lg:min-h-[430px]">
                    <Image
                      src={featuredBlog.image}
                      alt={featuredBlog.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(min-width: 1024px) 55vw, 100vw"
                      priority
                    />
                  </div>
                  <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
                    <div className="mb-5 flex flex-wrap items-center gap-3 text-[12px] font-medium text-steel">
                      <span className="rounded-full bg-[#E31E24]/10 px-3 py-1 text-[#E31E24]">
                        {featuredBlog.category}
                      </span>
                      {featuredBlog.date && (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={14} />
                          {featuredBlog.date}
                        </span>
                      )}
                    </div>
                    <h3 className="break-words text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[40px]">
                      {featuredBlog.title}
                    </h3>
                    <p className="mt-4 text-[15px] leading-7 text-steel">
                      {featuredBlog.excerpt}
                    </p>
                    <span className="mt-8 inline-flex items-center gap-2 self-start text-[13px] font-semibold text-[#E31E24]">
                      Read article
                      <ArrowRight size={15} />
                    </span>
                  </div>
                </Link>
              )}

              {otherBlogs.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {otherBlogs.map((blog) => (
                    <Link
                      key={blog.slug}
                      href={blog.url}
                      className="group overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
                    >
                      <div className="relative h-[230px] bg-grey">
                        <Image
                          src={blog.image}
                          alt={blog.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        />
                      </div>
                      <div className="p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-steel">
                          <span className="font-semibold text-[#E31E24]">
                            {blog.category}
                          </span>
                          {blog.date && <span>&bull; {blog.date}</span>}
                        </div>
                        <h3 className="break-words text-[19px] font-semibold leading-snug text-ink">
                          {blog.title}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-[14px] leading-6 text-steel">
                          {blog.excerpt}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink transition-colors group-hover:text-[#E31E24]">
                          Read article
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
