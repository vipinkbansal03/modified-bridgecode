"use client";

import { SlidersHorizontal, ArrowDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface ConfigureButtonProps {
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function ConfigureButton({
  label = "Configure Product",
  className,
  showIcon = true,
}: ConfigureButtonProps) {
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

      // Highlight the configurator area briefly to draw user attention
      element.classList.add("ring-2", "ring-[#E31E24]", "ring-offset-4", "transition-all", "duration-500", "rounded-2xl");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-[#E31E24]", "ring-offset-4");
      }, 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill bg-[#E31E24] px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:bg-[#B5151B] active:scale-95 cursor-pointer",
        className
      )}
    >
      {showIcon && <SlidersHorizontal size={16} />}
      <span>{label}</span>
      <ArrowDown size={14} className="opacity-80" />
    </button>
  );
}
