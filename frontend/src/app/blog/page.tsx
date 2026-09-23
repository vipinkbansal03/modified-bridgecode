"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, AlertCircle, RefreshCw, Newspaper } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useBlogs } from "@/hooks/api/useBlogs";
import { useCmsPage, type CmsSection } from "@/hooks/api/useCmsContent";
import { BlogSearchModal } from "@/components/blog/BlogSearchModal";
import { BlogCard } from "@/components/ui/BlogCard";
import { BackButton } from "@/components/ui/BackButton";

function BlogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || searchParams.get("search") || "";

  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialQuery));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: blogs = [], isLoading, isError, refetch } = useBlogs({ search: debouncedSearch });
  const { data: cmsPage } = useCmsPage("blog");

  const heroBlock = cmsPage?.sections?.find((s: CmsSection) => s.sectionKey === "blog.hero" || s.sectionKey.endsWith(".hero"))?.blocks?.[0];
  const articlesBlock = cmsPage?.sections?.find((s: CmsSection) => s.sectionKey === "blog.articles" || s.sectionKey.includes("article"))?.blocks?.[0];

  const heroKicker = heroBlock?.subtitle || "Resources";
  const heroTitle = heroBlock?.title || cmsPage?.title || "Orthodontic insights, product updates and industry notes.";
  const heroDescription =
    heroBlock?.description ||
    "Explore practical articles from Modern Orthodontics around products, clinical trends, manufacturing, and better buying decisions for dental professionals.";

  const sectionTitle = articlesBlock?.title || "From the blog";
  const sectionSubtitle = articlesBlock?.description || "Latest articles";

  useEffect(() => {
    setSearch(initialQuery);
    if (initialQuery) {
      setIsModalOpen(true);
    }
  }, [initialQuery]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const trimmed = value.trim();
    const newUrl = trimmed ? `/blog?q=${encodeURIComponent(trimmed)}` : "/blog";
    router.replace(newUrl, { scroll: false });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <main className="bg-white">
      {/* Hero Section */}
      <section className="border-b border-line bg-white">
        <Container className="py-6 lg:py-[34px]">
          <div className="max-w-[760px]">
            {/* Standard Back Button */}
            <div className="mb-2.5">
              <BackButton />
            </div>

            {/* Breadcrumb Navigation */}
            <nav className="mb-4 text-[13px] text-steel-2">
              <Link href="/" className="hover:text-brand">Home</Link> /{" "}
              <span className="font-semibold text-[#111827]">Blog</span>
            </nav>

            <span className="mb-3 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
              {heroKicker}
            </span>

            <h1 className="max-w-[720px] text-[clamp(28px,3.8vw,42px)] font-light leading-tight text-ink">
              {heroTitle}
            </h1>

            {heroDescription && (
              <p className="mt-3.5 max-w-[640px] text-[15px] sm:text-[15.5px] leading-relaxed text-steel">
                {heroDescription}
              </p>
            )}
          </div>
        </Container>
      </section>

      {/* Articles Grid Section */}
      <section className="py-10 sm:py-14">
        <Container>
          <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {sectionSubtitle && (
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#E31E24]">
                  {sectionSubtitle}
                </p>
              )}
              <h2 className="mt-1 text-[24px] sm:text-[28px] font-bold text-ink">
                {sectionTitle}
              </h2>
            </div>

            {/* Interactive Search Bar Trigger */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-full border border-line bg-white px-4 text-steel transition-all hover:border-[#E31E24] hover:shadow-sm sm:w-[320px] cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Search size={15} className="flex-none text-steel" />
                <span className="text-[13.5px] text-steel truncate">
                  {search ? search : "Search articles..."}
                </span>
              </div>
              {search ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSearchChange("");
                  }}
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-grey hover:bg-line text-steel hover:text-ink transition-colors"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </span>
              ) : (
                <span className="rounded-md bg-grey px-2 py-0.5 text-[11px] font-medium text-steel">
                  Search
                </span>
              )}
            </button>
          </div>

          <BlogSearchModal
            open={isModalOpen}
            onClose={handleCloseModal}
            search={search}
            debouncedSearch={debouncedSearch}
            onSearchChange={handleSearchChange}
          />

          {isLoading ? (
            <SkeletonGrid count={6} columns={3} />
          ) : isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 px-6 py-14 text-center">
              <AlertCircle size={36} className="mx-auto text-[#E31E24]" />
              <h3 className="mt-4 text-[20px] font-semibold text-ink">
                Unable to load articles right now
              </h3>
              <p className="mt-2 text-[14px] text-steel max-w-[480px] mx-auto">
                We encountered an error while fetching the latest blog posts. Please check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E31E24] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B] cursor-pointer"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          ) : blogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-[#FAFAFA] px-6 py-14 text-center">
              <Newspaper size={40} className="mx-auto text-steel/40" />
              <h3 className="mt-4 text-[20px] font-semibold text-ink">
                {search ? "No matching articles found" : "No articles yet"}
              </h3>
              <p className="mt-2 text-[14px] text-steel max-w-[500px] mx-auto">
                {search ? (
                  <>
                    No blog posts matched your search for &quot;
                    <strong className="text-ink">{search}</strong>&quot;.
                  </>
                ) : (
                  "We're preparing something new. Check back soon for our latest orthodontic insights and updates."
                )}
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B] cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8">
              {blogs.map((blog) => (
                <div key={blog.slug} className="h-full">
                  <BlogCard {...blog} />
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={null}>
      <BlogContent />
    </Suspense>
  );
}

