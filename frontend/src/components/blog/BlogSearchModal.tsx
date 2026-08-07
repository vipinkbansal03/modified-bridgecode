"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useBlogs } from "@/hooks/api/useBlogs";

interface BlogSearchModalProps {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const SUGGESTED_TOPICS = [
  "Clinical",
  "Manufacturing",
  "OEM",
  "Aesthetics",
  "Alignment",
  "Brackets",
];

export function BlogSearchModal({
  open,
  onClose,
  search,
  onSearchChange,
}: BlogSearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: results = [], isFetching } = useBlogs({ search });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} panelClassName="max-w-2xl rounded-2xl">
      <div className="flex flex-col">
        {/* Header Search Input */}
        <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-4">
          <Search size={18} className="flex-none text-steel" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search articles, topics, keywords..."
            className="w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-steel-2"
          />
          {isFetching ? (
            <Loader2 size={16} className="animate-spin text-steel flex-none" />
          ) : search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-grey hover:bg-line text-steel hover:text-ink transition-colors"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-md px-2 py-1 text-[12px] font-medium text-steel hover:bg-grey hover:text-ink transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Suggested Topics Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#FAFAFA] px-5 py-3">
          <span className="text-[12px] font-semibold text-steel uppercase tracking-wider mr-1">
            Topics:
          </span>
          {SUGGESTED_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => onSearchChange(topic)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                search.toLowerCase() === topic.toLowerCase()
                  ? "bg-[#E31E24] text-white"
                  : "bg-white border border-line text-ink hover:border-[#E31E24] hover:text-[#E31E24]"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Modal Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {search.trim() ? (
            <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-wider text-steel">
              {results.length} {results.length === 1 ? "Result" : "Results"} found for &quot;<span className="text-ink">{search}</span>&quot;
            </div>
          ) : (
            <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-wider text-steel">
              Recent Articles
            </div>
          )}

          {results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[16px] font-semibold text-ink">No matching articles found</p>
              <p className="mt-1 text-[13.5px] text-steel">
                Try searching for a different keyword like &quot;Clinical&quot;, &quot;OEM&quot;, or &quot;Alignment&quot;.
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="mt-4 rounded-full bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-line">
              {results.map((blog) => (
                <Link
                  key={blog.slug}
                  href={blog.url}
                  onClick={onClose}
                  className="group flex flex-col sm:flex-row items-start gap-4 py-4 transition-colors hover:bg-[#FAFAFA] rounded-xl px-2 -mx-2"
                >
                  <div className="relative h-20 w-full sm:w-28 flex-none rounded-lg overflow-hidden bg-grey">
                    <Image
                      src={blog.image}
                      alt={blog.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="112px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11.5px] text-steel mb-1">
                      <span className="font-semibold text-[#E31E24]">
                        {blog.category}
                      </span>
                      {blog.date && (
                        <span className="inline-flex items-center gap-1">
                          &bull; {blog.date}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15px] font-semibold text-ink group-hover:text-[#E31E24] transition-colors line-clamp-1">
                      {blog.title}
                    </h4>
                    <p className="text-[13px] text-steel line-clamp-2 mt-1 leading-snug">
                      {blog.excerpt}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="hidden sm:block flex-none text-steel group-hover:text-[#E31E24] group-hover:translate-x-1 transition-all self-center"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
