"use client";

import { ShoppingBag, ArrowDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface ConfigureButtonProps {
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function ConfigureButton({
  label = "Buy Now",
  className,
  showIcon = true,
}: ConfigureButtonProps) {
  const handleClick = () => {
    const element = document.getElementById("configurator-section");
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      // Smooth scroll to configurator
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill bg-[#E31E24] px-6 py-2.5 text-[14px] font-bold text-white shadow-md transition-all hover:bg-[#B5151B] active:scale-95 cursor-pointer",
        className
      )}
    >
      {showIcon && <ShoppingBag size={16} />}
      <span>{label}</span>
      <ArrowDown size={14} className="opacity-90" />
    </button>
  );
}
