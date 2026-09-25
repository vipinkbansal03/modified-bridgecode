"use client";

import { ChevronDown } from "lucide-react";

export function ViewSpecsLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById("product-specifications");
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <a
      href="#product-specifications"
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-[13px] font-bold text-[#111827] hover:text-[#E31E24] transition-colors underline decoration-dotted underline-offset-4 py-1.5"
    >
      <span>View full specifications</span>
      <ChevronDown size={14} className="text-[#111827]" />
    </a>
  );
}
