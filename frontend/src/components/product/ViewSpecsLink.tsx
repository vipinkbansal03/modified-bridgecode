"use client";

import { ChevronDown } from "lucide-react";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

export function ViewSpecsLink() {
  const { t } = useStaticTranslations();

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
      <span>{t("ui.pdp.viewSpecs")}</span>
      <ChevronDown size={14} className="text-[#111827]" />
    </a>
  );
}
