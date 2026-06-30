"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type TermsPageNavProps = {
  links: {
    id: string;
    label: string;
    href: string;
  }[];
};

export function TermsPageNav({ links }: TermsPageNavProps) {
  const [activeId, setActiveId] = useState(links[0]?.id ?? "");

  useEffect(() => {
    const sections = links
      .map((link) => document.getElementById(link.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-28% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [links]);

  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-steel">On this page</p>
      <nav className="space-y-1">
        {links.map((item) => {
          const isActive = activeId === item.id;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "true" : undefined}
              className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                isActive
                  ? "bg-[#FFF1F1] text-[#E31E24]"
                  : "text-steel hover:bg-[#FAFAFA] hover:text-ink"
              }`}
            >
              {item.label}
              <ArrowRight size={14} className={isActive ? "text-[#E31E24]" : "text-steel"} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
