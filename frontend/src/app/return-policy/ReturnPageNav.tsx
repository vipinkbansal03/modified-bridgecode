"use client";

import { useEffect, useState } from "react";

type NavLink = {
  id: string;
  label: string;
  href: string;
};

export function ReturnPageNav({ links }: { links: NavLink[] }) {
  const [activeId, setActiveId] = useState(links[0]?.id || "");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;

      for (const link of links) {
        const element = document.getElementById(link.id);
        if (element) {
          const { top, bottom } = element.getBoundingClientRect();
          const absoluteTop = top + window.scrollY;
          const absoluteBottom = bottom + window.scrollY;

          if (scrollPosition >= absoluteTop && scrollPosition < absoluteBottom) {
            setActiveId(link.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [links]);

  return (
    <nav className="flex flex-col gap-2">
      <p className="text-[12px] font-bold uppercase tracking-wider text-steel-2">
        Jump to section
      </p>
      <div className="mt-2 space-y-1">
        {links.map((link) => {
          const isActive = activeId === link.id;

          return (
            <a
              key={link.id}
              href={link.href}
              className={`block rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors ${
                isActive
                  ? "bg-[#FFF1F1] text-[#E31E24]"
                  : "text-steel hover:bg-grey hover:text-ink"
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
