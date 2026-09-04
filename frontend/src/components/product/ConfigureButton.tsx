"use client";

import { ArrowDown } from "lucide-react";

export function ConfigureButton() {
  const handleClick = () => {
    const element = document.getElementById("configurator-section");
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
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-sm"
    >
      <span>Configure Product</span>
      <ArrowDown size={14} />
    </button>
  );
}
